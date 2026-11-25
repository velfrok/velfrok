
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-session";

export const runtime = "nodejs";

/**
 * Authenticate the request before creating or using the
 * privileged Supabase service-role client.
 */
async function checkAdmin(request) {
  const result = await getAdminSession(request);

  // getAdminSession represents missing or invalid sessions
  // with user: null, not necessarily result.error.
  if (!result?.user) {
    return {
      error: { status: 401 },
      clearCookies: Boolean(result?.clearCookies),
    };
  }

  return {
    client: supabaseAdmin(),
    setCookies: result.setCookies,
    clearCookies: false,
  };
}

function jsonResponse(auth, body, status = 200) {
  const response = NextResponse.json(body, { status });

  if (auth?.setCookies) {
    auth.setCookies(response);
  }

  if (auth?.clearCookies) {
    for (const name of [
      "sb-access-token",
      "sb-refresh-token",
      "admin-otp-session",
      "admin-otp-refresh-session",
    ]) {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
  }

  return response;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function validateCoupon(body, partial = false) {
  const updates = {};

  if (!partial || Object.hasOwn(body, "code")) {
    const code = normalizeCode(body.code);

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return {
        error:
          "Coupon code must be 3–40 characters and contain only letters, numbers, hyphens, or underscores.",
      };
    }

    updates.code = code;
  }

  if (!partial || Object.hasOwn(body, "discount_pct")) {
    const value = body.discount_pct;

    if (
      value === "" ||
      value === null ||
      typeof value === "boolean" ||
      !Number.isInteger(Number(value)) ||
      Number(value) < 1 ||
      Number(value) > 100
    ) {
      return {
        error: "Discount must be a whole number between 1 and 100.",
      };
    }

    updates.discount_pct = Number(value);
  }

  if (!partial || Object.hasOwn(body, "is_active")) {
    if (typeof body.is_active !== "boolean") {
      return { error: "is_active must be true or false." };
    }

    updates.is_active = body.is_active;
  }

  if (!partial || Object.hasOwn(body, "expires_at")) {
    const value = body.expires_at;

    if (value === null || value === "") {
      updates.expires_at = null;
    } else {
      if (typeof value !== "string") {
        return {
          error: "Expiration date must be a valid date or empty.",
        };
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return { error: "Expiration date is invalid." };
      }

      updates.expires_at = date.toISOString();
    }
  }

  return { updates };
}

export async function GET(request) {
  let auth;

  try {
    auth = await checkAdmin(request);

    if (auth.error) {
      return jsonResponse(
        auth,
        { error: "Administrator session is invalid or expired." },
        auth.error.status
      );
    }

    const { data, error } = await auth.client
      .from("coupons")
      .select("code, discount_pct, is_active, expires_at")
      .order("code", { ascending: true });

    if (error) {
      console.error("Admin coupons lookup failed.");

      return jsonResponse(
        auth,
        { error: "Unable to load coupons." },
        500
      );
    }

    return jsonResponse(auth, { coupons: data || [] });
  } catch {
    console.error("Unexpected admin coupons lookup error.");

    return jsonResponse(
      auth,
      { error: "Unable to load coupons right now." },
      500
    );
  }
}

export async function POST(request) {
  let auth;

  try {
    auth = await checkAdmin(request);

    if (auth.error) {
      return jsonResponse(
        auth,
        { error: "Administrator session is invalid or expired." },
        auth.error.status
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        auth,
        { error: "Invalid request data." },
        400
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        auth,
        { error: "Invalid coupon data." },
        400
      );
    }

    const validation = validateCoupon(body);

    if (validation.error) {
      return jsonResponse(auth, { error: validation.error }, 400);
    }

    const { data, error } = await auth.client
      .from("coupons")
      .insert(validation.updates)
      .select("code, discount_pct, is_active, expires_at")
      .single();

    if (error) {
      console.error("Admin coupon creation failed.");

      if (error.code === "23505") {
        return jsonResponse(
          auth,
          { error: "This coupon code already exists." },
          409
        );
      }

      return jsonResponse(
        auth,
        { error: "Unable to create coupon. Check the database schema." },
        500
      );
    }

    return jsonResponse(
      auth,
      {
        message: "Coupon created successfully.",
        coupon: data,
      },
      201
    );
  } catch {
    console.error("Unexpected admin coupon creation error.");

    return jsonResponse(
      auth,
      { error: "Unable to create coupon right now." },
      500
    );
  }
}

export async function PATCH(request) {
  let auth;

  try {
    auth = await checkAdmin(request);

    if (auth.error) {
      return jsonResponse(
        auth,
        { error: "Administrator session is invalid or expired." },
        auth.error.status
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        auth,
        { error: "Invalid request data." },
        400
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(
        auth,
        { error: "Invalid coupon data." },
        400
      );
    }

    const code = normalizeCode(body.code);

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return jsonResponse(
        auth,
        { error: "A valid coupon code is required." },
        400
      );
    }

    const validation = validateCoupon(body, true);

    if (validation.error) {
      return jsonResponse(
        auth,
        { error: validation.error },
        400
      );
    }

    const { data, error } = await auth.client
      .from("coupons")
      .update(validation.updates)
      .eq("code", code)
      .select("code, discount_pct, is_active, expires_at")
      .maybeSingle();

    if (error) {
      console.error("Admin coupon update failed.");

      if (error.code === "23505") {
        return jsonResponse(
          auth,
          { error: "That coupon code already exists." },
          409
        );
      }

      return jsonResponse(
        auth,
        { error: "Unable to update coupon." },
        500
      );
    }

    if (!data) {
      return jsonResponse(
        auth,
        { error: "Coupon not found." },
        404
      );
    }

    return jsonResponse(auth, {
      message: "Coupon updated successfully.",
      coupon: data,
    });
  } catch {
    console.error("Unexpected admin coupon update error.");

    return jsonResponse(
      auth,
      { error: "Unable to update coupon right now." },
      500
    );
  }
}
