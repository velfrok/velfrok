
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const OTP_ACCESS_COOKIE = "admin-otp-session";
const OTP_REFRESH_COOKIE = "admin-otp-refresh-session";

function fail(message, status = 400) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

function cookieOptions(maxAge, sameSite = "lax") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
    maxAge,
  };
}

function clearTemporaryCookies(response) {
  response.cookies.set(
    OTP_ACCESS_COOKIE,
    "",
    cookieOptions(0, "strict")
  );

  response.cookies.set(
    OTP_REFRESH_COOKIE,
    "",
    cookieOptions(0, "strict")
  );

  return response;
}

function clearAllAuthCookies(response) {
  response.cookies.set(
    ACCESS_COOKIE,
    "",
    cookieOptions(0)
  );

  response.cookies.set(
    REFRESH_COOKIE,
    "",
    cookieOptions(0)
  );

  clearTemporaryCookies(response);
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
      return fail(
        "Verification service temporarily unavailable.",
        503
      );
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
      const response = fail(
        "Your sign-in session expired. Please sign in again.",
        401
      );

      return clearAllAuthCookies(response);
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
      const response = fail(
        "Your sign-in session is invalid. Please sign in again.",
        401
      );

      return clearAllAuthCookies(response);
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
      const response = fail(
        "This account is not authorized as an administrator.",
        403
      );

      return clearAllAuthCookies(response);
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

      const response = fail(
        "Too many incorrect attempts. Please sign in again.",
        429
      );

      return clearAllAuthCookies(response);
    }

    if (
      !record.expires_at ||
      Date.parse(record.expires_at) <= Date.now()
    ) {
      await adminClient
        .from("admin_login_otps")
        .delete()
        .eq("email", email);

      const response = fail(
        "The code has expired. Please sign in again.",
        401
      );

      return clearAllAuthCookies(response);
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

      const response = fail(
        "Could not establish a persistent session. Please sign in again.",
        401
      );

      return clearAllAuthCookies(response);
    }

    const { error: deleteError } = await adminClient
      .from("admin_login_otps")
      .delete()
      .eq("email", email);

    if (deleteError) {
      console.error("Verified OTP cleanup failed.");
      return fail("Could not complete sign-in. Please try again.", 503);
    }

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

    const options = cookieOptions(SESSION_MAX_AGE);

    response.cookies.set(
      ACCESS_COOKIE,
      refreshed.session.access_token,
      options
    );

    response.cookies.set(
      REFRESH_COOKIE,
      refreshed.session.refresh_token,
      options
    );

    clearTemporaryCookies(response);

    console.info("[admin-otp] persistent session cookies issued");

    return response;
  } catch (error) {
    console.error(
      "Unexpected admin OTP verification error:",
      error?.message || "Unknown error"
    );

    return fail("Unable to verify the code right now.", 500);
  }
    }
