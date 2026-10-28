
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

function json(body, status = 200, session = null) {
  const response = NextResponse.json(body, { status });

  if (session?.clearCookies) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };

    response.cookies.set("sb-access-token", "", options);
    response.cookies.set("sb-refresh-token", "", options);
    response.cookies.set("admin-otp-session", "", {
      ...options,
      sameSite: "strict",
    });
    response.cookies.set("admin-otp-refresh-session", "", {
      ...options,
      sameSite: "strict",
    });
  } else if (session?.setCookies) {
    session.setCookies(response);
  }

  return response;
}

async function authenticate(request) {
  try {
    const session = await getAdminSession(request);

    if (!session.user) {
      return {
        error: json(
          { error: "Please sign in again." },
          401,
          session
        ),
      };
    }

    return {
      user: session.user,
      session,
      client: supabaseAdmin(),
    };
  } catch {
    console.error("Admin products authentication check failed.");

    return {
      error: NextResponse.json(
        { error: "Unable to verify administrator access." },
        { status: 503 }
      ),
    };
  }
}

function fail(message, status, session) {
  return json({ error: message }, status, session);
}

export async function GET(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;

  try {
    const { data, error } = await auth.client
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin products lookup failed.");

      return fail("Unable to load products.", 500, auth.session);
    }

    return json(
      { products: data || [] },
      200,
      auth.session
    );
  } catch {
    console.error("Unexpected admin products lookup error.");

    return fail(
      "Unable to load products right now.",
      500,
      auth.session
    );
  }
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid request data.", 400, auth.session);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid request data.", 400, auth.session);
    }

    const sku = String(body.sku || "").trim();
    const name = String(body.name || "").trim();
    const slug = String(body.slug || "").trim();
    const description = String(body.description || "").trim();
    const imageUrl = String(body.image_url || "").trim();
    const category = String(body.category || "").trim();

    const priceInr = Number(body.price_inr);
    const stock = Number(body.stock);

    if (!sku || !name || !slug) {
      return fail(
        "SKU, product name, and slug are required.",
        400,
        auth.session
      );
    }

    if (
      body.price_inr === "" ||
      body.price_inr === null ||
      body.stock === "" ||
      body.stock === null ||
      !Number.isSafeInteger(priceInr) ||
      priceInr < 0 ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      return fail(
        "Price and stock must be valid non-negative whole numbers.",
        400,
        auth.session
      );
    }

    const product = {
      sku,
      name,
      slug,
      description: description || null,
      price_inr: priceInr,
      stock,
      image_url: imageUrl || null,
      category: category || null,
      is_active: body.is_active === true,
    };

    const { data, error } = await auth.client
      .from("products")
      .insert(product)
      .select("*")
      .single();

    if (error) {
      console.error("Admin product creation failed.");

      if (error.code === "23505") {
        return fail(
          "This SKU or slug already exists. Use a different one.",
          409,
          auth.session
        );
      }

      return fail(
        "Unable to create product. Check the product fields and database columns.",
        500,
        auth.session
      );
    }

    return json(
      {
        message: "Product created successfully.",
        product: data,
      },
      201,
      auth.session
    );
  } catch {
    console.error("Unexpected admin product creation error.");

    return fail(
      "Unable to create the product right now.",
      500,
      auth.session
    );
  }
}

export async function PATCH(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid request data.", 400, auth.session);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid request data.", 400, auth.session);
    }

    const id = String(body.id || "").trim();

    if (!id) {
      return fail("Product ID is required.", 400, auth.session);
    }

    const allowedFields = [
      "sku",
      "name",
      "slug",
      "description",
      "price_inr",
      "stock",
      "image_url",
      "category",
      "is_active",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return fail(
        "No product changes were provided.",
        400,
        auth.session
      );
    }

    for (const field of ["sku", "name", "slug"]) {
      if (field in updates) {
        if (
          typeof updates[field] !== "string" ||
          !updates[field].trim()
        ) {
          return fail(
            `${field} cannot be empty.`,
            400,
            auth.session
          );
        }

        updates[field] = updates[field].trim();
      }
    }

    for (const field of ["description", "image_url", "category"]) {
      if (field in updates) {
        if (typeof updates[field] !== "string") {
          return fail(
            `${field} must be text.`,
            400,
            auth.session
          );
        }

        updates[field] = updates[field].trim() || null;
      }
    }

    for (const field of ["price_inr", "stock"]) {
      if (field in updates) {
        const value = updates[field];

        if (
          value === "" ||
          value === null ||
          typeof value === "boolean" ||
          !Number.isSafeInteger(Number(value)) ||
          Number(value) < 0
        ) {
          return fail(
            `${field} must be a non-negative whole number.`,
            400,
            auth.session
          );
        }

        updates[field] = Number(value);
      }
    }

    if (
      "is_active" in updates &&
      typeof updates.is_active !== "boolean"
    ) {
      return fail(
        "is_active must be true or false.",
        400,
        auth.session
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await auth.client
      .from("products")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Admin product update failed.");

      if (error.code === "23505") {
        return fail(
          "That SKU or slug is already used by another product.",
          409,
          auth.session
        );
      }

      return fail("Unable to update product.", 500, auth.session);
    }

    if (!data) {
      return fail("Product not found.", 404, auth.session);
    }

    return json(
      {
        message: "Product updated successfully.",
        product: data,
      },
      200,
      auth.session
    );
  } catch {
    console.error("Unexpected admin product update error.");

    return fail(
      "Unable to update the product right now.",
      500,
      auth.session
    );
  }
}

export async function DELETE(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid request data.", 400, auth.session);
    }

    const id = String(body?.id || "").trim();

    if (!id) {
      return fail("Product ID is required.", 400, auth.session);
    }

    const { data, error } = await auth.client
      .from("products")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Admin product deletion failed.");

      return fail("Unable to delete product.", 500, auth.session);
    }

    if (!data) {
      return fail("Product not found.", 404, auth.session);
    }

    return json(
      { message: "Product deleted successfully.", id: data.id },
      200,
      auth.session
    );
  } catch {
    console.error("Unexpected admin product deletion error.");

    return fail(
      "Unable to delete the product right now.",
      500,
      auth.session
    );
  }
}
