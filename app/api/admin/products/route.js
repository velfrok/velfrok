
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

export async function GET(request) {
  try {
    const auth = await checkAdmin(request);

    if (auth.error) {
      return auth.error;
    }

    const { data, error } = await auth.client
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin products lookup failed.");

      return NextResponse.json(
        { error: "Unable to load products." },
        { status: 500 }
      );
    }

    return NextResponse.json({ products: data || [] });
  } catch {
    console.error("Unexpected admin products lookup error.");

    return NextResponse.json(
      { error: "Unable to load products right now." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await checkAdmin(request);

    if (auth.error) {
      return auth.error;
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request data." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "SKU, product name, and slug are required." },
        { status: 400 }
      );
    }

    if (
      body.price_inr === "" ||
      body.stock === "" ||
      !Number.isSafeInteger(priceInr) ||
      priceInr < 0 ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      return NextResponse.json(
        { error: "Price and stock must be valid non-negative whole numbers." },
        { status: 400 }
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
        return NextResponse.json(
          { error: "This SKU or slug already exists. Use a different one." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Unable to create product. Check the product fields and database columns." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Product created successfully.", product: data },
      { status: 201 }
    );
  } catch {
    console.error("Unexpected admin product creation error.");

    return NextResponse.json(
      { error: "Unable to create the product right now." },
      { status: 500 }
    );
  }
}
