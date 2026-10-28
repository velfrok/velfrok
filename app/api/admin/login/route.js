
import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    const ip = clientIp(request);

    try {
      await rateLimit(`admin-login:${ip}`, 10, 60);
    } catch (error) {
      if (error instanceof Response && error.status === 429) {
        return fail("Too many login attempts. Please try again later.", 429);
      }

      console.error("Admin login rate limit check failed.");
      return fail(
        "Login service temporarily unavailable. Please try again later.",
        503
      );
    }

    const body = await request.json();
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
        "Admin login is not fully configured. Please check the server environment variables.",
        503
      );
    }

    const auth = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await auth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session?.access_token) {
      return fail("Invalid email or password.", 401);
    }

    if (!data.session.refresh_token) {
      return fail("Could not establish a secure sign-in session.", 503);
    }

    const adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin membership lookup failed.");
      return fail("Could not verify administrator access.", 503);
    }

    if (!admin) {
      return fail("This account is not authorized as an administrator.", 403);
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = createHmac("sha256", otpSecret)
      .update(email + ":" + otp)
      .digest("hex");

    const { error: saveError } = await adminClient
      .from("admin_login_otps")
      .upsert(
        {
          email,
          user_id: data.user.id,
          otp_hash: otpHash,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          attempts: 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

    if (saveError) {
      console.error("OTP storage failed.");
      return fail("Secure OTP storage is not ready yet.", 503);
    }

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Your VELFROK admin verification code",
        text: `Your verification code is ${otp}. It expires in 10 minutes. If you did not request it, ignore this email.`,
      }),
    });

    if (!mail.ok) {
      await adminClient.from("admin_login_otps").delete().eq("email", email);
      console.error("OTP email delivery failed.");
      return fail(
        "Could not send the verification email. Please check the email sender configuration.",
        502
      );
    }

    const response = NextResponse.json({
      message: "A six-digit verification code has been sent to your email.",
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 600,
    };

    response.cookies.set(
      "admin-otp-session",
      data.session.access_token,
      cookieOptions
    );

    response.cookies.set(
      "admin-otp-refresh-session",
      data.session.refresh_token,
      cookieOptions
    );

    return response;
  } catch {
    console.error("Unexpected admin login error.");
    return fail("Unable to sign in right now. Please try again.", 500);
  }
}
