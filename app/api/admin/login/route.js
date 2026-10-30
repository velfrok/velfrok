
import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function fail(message, status = 400) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

function createClientWithoutSession(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function POST(request) {
  try {
    const ip = clientIp(request);

    try {
      await rateLimit(`admin-login:${ip}`, 10, 60);
    } catch (error) {
      if (error instanceof Response && error.status === 429) {
        return fail(
          "Too many login attempts. Please try again later.",
          429
        );
      }

      console.error("Admin login rate limit check failed.");

      return fail(
        "Login service temporarily unavailable.",
        503
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid login request.");
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = body.password;

    if (!email || typeof password !== "string" || !password) {
      return fail("Enter your email and password.");
    }

    const {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      RESEND_API_KEY: resendKey,
      ADMIN_OTP_FROM: fromEmail,
      ADMIN_OTP_SECRET: otpSecret,
    } = process.env;

    if (
      !url ||
      !anon ||
      !serviceKey ||
      !resendKey ||
      !fromEmail ||
      !otpSecret
    ) {
      return fail(
        "Admin login is not fully configured. Check the server environment variables.",
        503
      );
    }

    const authClient = createClientWithoutSession(url, anon);

    const {
      data: signInData,
      error: signInError,
    } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (
      signInError ||
      !signInData?.user ||
      !signInData?.session?.access_token ||
      !signInData?.session?.refresh_token
    ) {
      return fail("Invalid email or password.", 401);
    }

    const adminClient = createClientWithoutSession(
      url,
      serviceKey
    );

    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", signInData.user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin membership lookup failed.");
      return fail("Could not verify administrator access.", 503);
    }

    if (!admin) {
      return fail(
        "This account is not authorized as an administrator.",
        403
      );
    }

    const otp = String(randomInt(100000, 1000000));

    const otpHash = createHmac("sha256", otpSecret)
      .update(`${email}:${otp}`)
      .digest("hex");

    const now = new Date();

    const { error: saveError } = await adminClient
      .from("admin_login_otps")
      .upsert(
        {
          email,
          user_id: signInData.user.id,
          otp_hash: otpHash,
          expires_at: new Date(
            now.getTime() + 10 * 60 * 1000
          ).toISOString(),
          attempts: 0,
          created_at: now.toISOString(),
        },
        {
          onConflict: "email",
        }
      );

    if (saveError) {
      console.error("OTP storage failed.");
      return fail("Secure OTP storage is unavailable.", 503);
    }

    let mail;

    try {
      mail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Your VELFROK admin verification code",
          text:
            `Your verification code is ${otp}. ` +
            "It expires in 10 minutes. " +
            "If you did not request it, ignore this email.",
        }),
        cache: "no-store",
      });
    } catch {
      await adminClient
        .from("admin_login_otps")
        .delete()
        .eq("email", email);

      console.error("OTP email request failed.");

      return fail(
        "Could not send the verification email.",
        502
      );
    }

    if (!mail.ok) {
      await adminClient
        .from("admin_login_otps")
        .delete()
        .eq("email", email);

      console.error("OTP email delivery failed.");

      return fail(
        "Could not send the verification email. Check the sender configuration.",
        502
      );
    }

    const response = NextResponse.json(
      {
        message:
          "A six-digit verification code has been sent to your email.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );

    const temporaryCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60,
    };

    response.cookies.set(
      "admin-otp-session",
      signInData.session.access_token,
      temporaryCookieOptions
    );

    response.cookies.set(
      "admin-otp-refresh-session",
      signInData.session.refresh_token,
      temporaryCookieOptions
    );

    console.info("[admin-login] temporary OTP session cookies issued");

    return response;
  } catch (error) {
    console.error(
      "Unexpected admin login error:",
      error?.message || "Unknown error"
    );

    return fail("Unable to sign in right now. Please try again.", 500);
  }
}
