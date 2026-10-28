
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

const TEMP_COOKIE_NAMES = [
  "admin-otp-session",
  "admin-otp-refresh-session",
];

function send(body, status = 200, session = null) {
  const response = NextResponse.json(body, { status });

  if (session?.setCookies) {
    session.setCookies(response);
  }

  if (session?.clearCookies === true) {
    response.cookies.set("sb-access-token", "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
    response.cookies.set("sb-refresh-token", "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });

    for (const name of TEMP_COOKIE_NAMES) {
      response.cookies.set(name, "", {
        ...COOKIE_OPTIONS,
        sameSite: "strict",
        maxAge: 0,
      });
    }
  }

  return response;
}

function fail(message, status, session) {
  return send({ error: message }, status, session);
}

async function authenticate(request) {
  let session;

  try {
    session = await getAdminSession(request);
  } catch {
    console.error("[admin-products] Session verification failed.");

    return {
      error: send(
        { error: "Unable to verify administrator access." },
        503
      ),
    };
  }

  if (!session?.user) {
    console.warn(
      "[admin-products] Request rejected: no valid admin session."
    );

    return {
      error: fail("Please sign in again.", 401, session),
    };
  }

  try {
    return {
      user: session.user,
      session,
      client: supabaseAdmin(),
    };
  } catch {
    console.error(
      "[admin-products] Admin database client unavailable."
    );

    return {
      error: fail(
        "The product service is temporarily unavailable.",
        503,
        session
      ),
    };
  }
}

async function readJson(request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { error: "Invalid request data." };
    }

    return { body };
  } catch {
    return { error: "Invalid request data." };
  }
}

function nonNegativeInteger(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) && number >= 0
    ? number
    : null;
}

function duplicateError(error) {
  return error?.code === "23505";
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
      console.error(
        "[admin-products] Product query failed:",
        error.code || "unknown"
      );

      return fail("Unable to load products.", 500, auth.session);
    }

    return send(
      { products: data || [] },
      200,
      auth.session
    );
  } catch {
    console.error(
      "[admin-products] Unexpected product query failure."
    );

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

  const parsed = await readJson(request);
  if (parsed.error) {
    return fail(parsed.error, 400, auth.session);
  }

  try {
    const body = parsed.body;

    const sku =
      typeof body.sku === "string" ? body.sku.trim() : "";
    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const slug =
      typeof body.slug === "string" ? body.slug.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";
    const imageUrl =
      typeof body.image_url === "string"
        ? body.image_url.trim()
        : "";
    const category =
      typeof body.category === "string"
        ? body.category.trim()
        : "";

    const priceInr = nonNegativeInteger(body.price_inr);
    const stock = nonNegativeInteger(body.stock);

    if (!sku || !name || !slug) {
      return fail(
        "SKU, product name, and slug are required.",
        400,
        auth.session
      );
    }

    if (priceInr === null || stock === null) {
      return fail(
        "Price and stock must be non-negative whole numbers.",
        400,
        auth.session
      );
    }

    if (
      body.is_active !== undefined &&
      typeof body.is_active !== "boolean"
    ) {
      return fail(
        "is_active must be true or false.",
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
      if (duplicateError(error)) {
        return fail(
          "This SKU or slug already exists. Use a different one.",
          409,
          auth.session
        );
      }

      console.error(
        "[admin-products] Product insert failed:",
        error.code || "unknown"
      );

      return fail(
        "Unable to create product. Check the product fields and database columns.",
        500,
        auth.session
      );
    }

    return send(
      {
        message: "Product created successfully.",
        product: data,
      },
      201,
      auth.session
    );
  } catch {
    console.error(
      "[admin-products] Unexpected product creation failure."
    );

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

  const parsed = await readJson(request);
  if (parsed.error) {
    return fail(parsed.error, 400, auth.session);
  }

  try {
    const body = parsed.body;
    const id =
      typeof body.id === "string" ? body.id.trim() : "";

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
        if (
          updates[field] !== null &&
          typeof updates[field] !== "string"
        ) {
          return fail(
            \`\${field} must be text or null.\`,
            400,
            auth.session
          );
        }

        updates[field] =
          typeof updates[field] === "string"
            ? updates[field].trim() || null
            : null;
      }
    }

    for (const field of ["price_inr", "stock"]) {
      if (field in updates) {
        const value = nonNegativeInteger(updates[field]);

        if (value === null) {
          return fail(
            \`\${field} must be a non-negative whole number.\`,
            400,
            auth.session
          );
        }

        updates[field] = value;
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
      if (duplicateError(error)) {
        return fail(
          "That SKU or slug is already used by another product.",
          409,
          auth.session
        );
      }

      console.error(
        "[admin-products] Product update failed:",
        error.code || "unknown"
      );

      return fail("Unable to update product.", 500, auth.session);
    }

    if (!data) {
      return fail("Product not found.", 404, auth.session);
    }

    return send(
      {
        message: "Product updated successfully.",
        product: data,
      },
      200,
      auth.session
    );
  } catch {
    console.error(
      "[admin-products] Unexpected product update failure."
    );

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

  const parsed = await readJson(request);
  if (parsed.error) {
    return fail(parsed.error, 400, auth.session);
  }

  try {
    const id =
      typeof parsed.body.id === "string"
        ? parsed.body.id.trim()
        : "";

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
      console.error(
        "[admin-products] Product deletion failed:",
        error.code || "unknown"
      );

      return fail("Unable to delete product.", 500, auth.session);
    }

    if (!data) {
      return fail("Product not found.", 404, auth.session);
    }

    return send(
      {
        message: "Product deleted successfully.",
        id: data.id,
      },
      200,
      auth.session
    );
  } catch {
    console.error(
      "[admin-products] Unexpected product deletion failure."
    );

    return fail(
      "Unable to delete the product right now.",
      500,
      auth.session
    );
  }
}
