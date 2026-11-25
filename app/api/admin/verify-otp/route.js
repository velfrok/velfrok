
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const OTP_ACCESS_COOKIE = "admin-otp-session";
const OTP_REFRESH_COOKIE = "admin-otp-refresh-session";

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

function clearTemporaryCookies(response) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  };

  response.cookies.set(OTP_ACCESS_COOKIE, "", options);
  response.cookies.set(OTP_REFRESH_COOKIE, "", options);

  return response;
}

function createAuthClient(url, key) {
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
      await rateLimit(`admin-otp-verify:${ip}`, 10, 60);
    } catch (error) {
      if (error instanceof Response && error.status === 429) {
        return fail(
          "Too many verification requests. Please try again later.",
          429
        );
      }

      console.error("Admin OTP rate limit check failed.");
      return fail("Verification service temporarily unavailable.", 503);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid request.");
    }

    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return fail("Enter the six-digit verification code.");
    }

    const {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      ADMIN_OTP_SECRET: otpSecret,
    } = process.env;

    if (!url || !anon || !serviceKey || !otpSecret) {
      return fail("Admin verification is not fully configured.", 503);
    }

    const accessToken =
      request.cookies.get(OTP_ACCESS_COOKIE)?.value;

    const refreshToken =
      request.cookies.get(OTP_REFRESH_COOKIE)?.value;

    if (!accessToken || !refreshToken) {
      return fail(
        "Your sign-in session expired. Please sign in again.",
        401
      );
    }

    const authClient = createAuthClient(url, anon);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (
      authError ||
      !user ||
      String(user.email || "").toLowerCase() !== email
    ) {
      return fail(
        "Your sign-in session is invalid. Please sign in again.",
        401
      );
    }

    const adminClient = createAuthClient(url, serviceKey);

    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
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

    const { data: record, error: otpError } = await adminClient
      .from("admin_login_otps")
      .select("email,user_id,otp_hash,expires_at,attempts")
      .eq("email", email)
      .maybeSingle();

    if (otpError) {
      console.error("Admin OTP lookup failed.");
      return fail("OTP storage is unavailable.", 503);
    }

    if (!record || record.user_id !== user.id) {
      return fail(
        "The code is invalid or expired. Please sign in again.",
        401
      );
    }

    if (Number(record.attempts || 0) >= 5) {
      await adminClient
        .from("admin_login_otps")
        .delete()
        .eq("email", email);

      return fail(
        "Too many incorrect attempts. Please sign in again.",
        429
      );
    }

    if (
      !record.expires_at ||
      Date.parse(record.expires_at) <= Date.now()
    ) {
      await adminClient
        .from("admin_login_otps")
        .delete()
        .eq("email", email);

      return fail(
        "The code has expired. Please sign in again.",
        401
      );
    }

    const expectedHash = createHmac("sha256", otpSecret)
      .update(`${email}:${otp}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const actualBuffer = Buffer.from(
      String(record.otp_hash || ""),
      "hex"
    );

    const matches =
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer);

    if (!matches) {
      await adminClient
        .from("admin_login_otps")
        .update({
          attempts: Number(record.attempts || 0) + 1,
        })
        .eq("email", email);

      return fail("Incorrect verification code. Try again.", 401);
    }

    // Rotate the temporary OTP session before creating the
    // standard Supabase SSR persistent cookie session.
    const {
      data: refreshed,
      error: refreshError,
    } = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (
      refreshError ||
      !refreshed?.session ||
      !refreshed?.user ||
      refreshed.user.id !== user.id ||
      String(refreshed.user.email || "").toLowerCase() !== email
    ) {
      console.error("Admin session refresh failed.");

      return fail(
        "Could not establish a persistent session. Please sign in again.",
        401
      );
    }

    const { error: deleteError } = await adminClient
      .from("admin_login_otps")
      .delete()
      .eq("email", email);

    if (deleteError) {
      console.error("Verified OTP cleanup failed.");
      return fail("Could not complete sign-in. Please try again.", 503);
    }

    // This response receives the standard Supabase SSR auth cookies.
    const response = NextResponse.json(
      { message: "Verification successful." },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: sessionData, error: sessionError } =
      await supabase.auth.setSession({
        access_token: refreshed.session.access_token,
        refresh_token: refreshed.session.refresh_token,
      });

    if (
      sessionError ||
      !sessionData?.session ||
      sessionData.user?.id !== user.id
    ) {
      console.error("Standard Supabase SSR session creation failed.");

      return fail(
        "Could not save your administrator session.",
        500
      );
    }

    clearTemporaryCookies(response);

    console.info(
      "[admin-otp] standard Supabase SSR session cookies issued"
    );

    return response;
  } catch (error) {
    console.error(
      "Unexpected admin OTP verification error:",
      error?.message || "Unknown error"
    );

    return fail("Unable to verify the code right now.", 500);
  }
}
