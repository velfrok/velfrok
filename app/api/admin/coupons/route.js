
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

async function checkAdmin(request) {
  const token = request.cookies.get("sb-access-token")?.value;

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      ),
    };
  }

  const client = supabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  const { data: admin, error: adminError } = await client
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return {
      error: NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      ),
    };
  }

  return { client };
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
        return { error: "Expiration date must be a valid date or empty." };
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
  try {
    const auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    const { data, error } = await auth.client
      .from("coupons")
      .select("code, discount_pct, is_active, expires_at")
      .order("code", { ascending: true });

    if (error) {
      console.error("Admin coupons lookup failed.");

      return NextResponse.json(
        { error: "Unable to load coupons." },
        { status: 500 }
      );
    }

    return NextResponse.json({ coupons: data || [] });
  } catch {
    console.error("Unexpected admin coupons lookup error.");

    return NextResponse.json(
      { error: "Unable to load coupons right now." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request data." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid coupon data." },
        { status: 400 }
      );
    }

    const validation = validateCoupon(body);

    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { data, error } = await auth.client
      .from("coupons")
      .insert(validation.updates)
      .select("code, discount_pct, is_active, expires_at")
      .single();

    if (error) {
      console.error("Admin coupon creation failed.");

      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This coupon code already exists." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to create coupon. Check the database schema." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Coupon created successfully.", coupon: data },
      { status: 201 }
    );
  } catch {
    console.error("Unexpected admin coupon creation error.");

    return NextResponse.json(
      { error: "Unable to create coupon right now." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request data." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid coupon data." },
        { status: 400 }
      );
    }

    const code = normalizeCode(body.code);

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return NextResponse.json(
        { error: "A valid coupon code is required." },
        { status: 400 }
      );
    }

    const validation = validateCoupon(body, true);

    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const updates = { ...validation.updates };

    // Keep the lookup code separate from the new code if it is being renamed.
    const { data, error } = await auth.client
      .from("coupons")
      .update(updates)
      .eq("code", code)
      .select("code, discount_pct, is_active, expires_at")
      .maybeSingle();

    if (error) {
      console.error("Admin coupon update failed.");

      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That coupon code already exists." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to update coupon." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Coupon not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Coupon updated successfully.",
      coupon: data,
    });
  } catch {
    console.error("Unexpected admin coupon update error.");

    return NextResponse.json(
      { error: "Unable to update coupon right now." },
      { status: 500 }
    );
  }
}
