
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function clearTemporaryCookies(response) {
  for (const name of ["admin-otp-session", "admin-otp-refresh-session"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
}

export async function POST(request) {
  try {
    const ip = clientIp(request);

    try {
      await rateLimit(`admin-otp-verify:${ip}`, 10, 60);
    } catch (error) {
      if (error instanceof Response && error.status === 429) {
        return fail("Too many verification requests. Please try again later.", 429);
      }

      console.error("Admin OTP rate limit check failed.");
      return fail(
        "Verification service temporarily unavailable. Please try again later.",
        503
      );
    }

    const body = await request.json();
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

    const accessToken = request.cookies.get("admin-otp-session")?.value;
    const refreshToken = request.cookies.get("admin-otp-refresh-session")?.value;

    if (!accessToken || !refreshToken) {
      const response = fail(
        "Your sign-in session expired. Please sign in again.",
        401
      );
      clearTemporaryCookies(response);
      return response;
    }

    const authClient = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

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
      clearTemporaryCookies(response);
      return response;
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
      clearTemporaryCookies(response);
      return response;
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
      return fail("The code is invalid or expired. Please sign in again.", 401);
    }

    if (Number(record.attempts || 0) >= 5) {
      await adminClient.from("admin_login_otps").delete().eq("email", email);

      const response = fail(
        "Too many incorrect attempts. Please sign in again.",
        429
      );
      clearTemporaryCookies(response);
      return response;
    }

    if (!record.expires_at || Date.parse(record.expires_at) <= Date.now()) {
      await adminClient.from("admin_login_otps").delete().eq("email", email);

      const response = fail(
        "The code has expired. Please sign in again.",
        401
      );
      clearTemporaryCookies(response);
      return response;
    }

    const expectedHash = createHmac("sha256", otpSecret)
      .update(email + ":" + otp)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const actualBuffer = Buffer.from(String(record.otp_hash || ""), "hex");

    const matches =
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer);

    if (!matches) {
      await adminClient
        .from("admin_login_otps")
        .update({ attempts: Number(record.attempts || 0) + 1 })
        .eq("email", email);

      return fail("Incorrect verification code. Try again.", 401);
    }

    // Verify the refresh token before establishing the persistent session.
    const { data: refreshed, error: refreshError } =
      await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (
      refreshError ||
      !refreshed.session ||
      !refreshed.user ||
      refreshed.user.id !== user.id
    ) {
      console.error("Admin session refresh failed.");
      const response = fail(
        "Could not establish a persistent session. Please sign in again.",
        401
      );
      clearTemporaryCookies(response);
      return response;
    }

    const { error: deleteError } = await adminClient
      .from("admin_login_otps")
      .delete()
      .eq("email", email);

    if (deleteError) {
      console.error("Verified OTP cleanup failed.");
      return fail("Could not complete sign-in. Please try again.", 503);
    }

    const response = NextResponse.json({
      message: "Verification successful.",
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    };

    response.cookies.set(
      "sb-access-token",
      refreshed.session.access_token,
      cookieOptions
    );

    response.cookies.set(
      "sb-refresh-token",
      refreshed.session.refresh_token,
      cookieOptions
    );

    clearTemporaryCookies(response);

    return response;
  } catch {
    console.error("Unexpected admin OTP verification error.");
    return fail("Unable to verify the code right now.", 500);
  }
}
