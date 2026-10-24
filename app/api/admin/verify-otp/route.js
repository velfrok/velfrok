
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const otp = String(body.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      return fail("Enter the six-digit verification code.");
    }

    const {
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      ADMIN_OTP_SECRET: otpSecret,
    } = process.env;

    if (!url || !serviceKey || !otpSecret) {
      return fail("Admin verification is not fully configured.", 503);
    }

    const accessToken =
      request.cookies.get("admin-otp-session")?.value;

    if (!accessToken) {
      return fail("Your sign-in session expired. Please sign in again.", 401);
    }

    const adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(accessToken);

    if (
      authError ||
      !user ||
      String(user.email || "").toLowerCase() !== email
    ) {
      const response = fail(
        "Your sign-in session is invalid. Please sign in again.",
        401
      );
      response.cookies.delete("admin-otp-session");
      return response;
    }

    const { data: admin, error: adminError } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return fail("This account is not authorized as an administrator.", 403);
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
      await adminClient
        .from("admin_login_otps")
        .delete()
        .eq("email", email);

      const response = fail(
        "Too many incorrect attempts. Please sign in again.",
        429
      );
      response.cookies.delete("admin-otp-session");
      return response;
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
      response.cookies.delete("admin-otp-session");
      return response;
    }

    const expectedHash = createHmac("sha256", otpSecret)
      .update(email + ":" + otp)
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

    response.cookies.set("sb-access-token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });

    response.cookies.delete("admin-otp-session");

    return response;
  } catch {
    console.error("Unexpected admin OTP verification error.");
    return fail("Unable to verify the code right now.", 500);
  }
}
