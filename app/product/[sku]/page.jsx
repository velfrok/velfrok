
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }) {
  const sku = decodeURIComponent(params.sku || "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !sku) notFound();

  const supabase = createClient(url, key);

  let { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("sku", sku)
    .eq("is_active", true)
    .maybeSingle();

  if (!product && /^[0-9a-f-]{36}$/i.test(sku)) {
    const result = await supabase
      .from("products")
      .select("*")
      .eq("id", sku)
      .eq("is_active", true)
      .maybeSingle();

    product = result.data;
  }

  if (!product) notFound();

  return (
    <section className="shop-section">
      <p className="eyebrow">VELFROK / PRODUCT</p>
      <Link href="/">← Back to shop</Link>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        gap: "32px",
        marginTop: "24px"
      }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name || "Product"}
            style={{
              width: "100%",
              maxHeight: "560px",
              objectFit: "contain",
              borderRadius: "18px"
            }}
          />
        ) : (
          <div className="product-placeholder">VELFROK</div>
        )}

        <div>
          <h1>{product.name || "Product"}</h1>
          <h2>
            ₹{Number(product.price_inr || 0).toLocaleString("en-IN")}
          </h2>
          <p>{product.description || "An everyday essential from VELFROK."}</p>
          <p>
            {Number(product.stock || 0) > 0
              ? "In stock"
              : "Sold out"}
          </p>
          <Link className="button button-dark" href="/cart">
            View shopping bag
          </Link>
        </div>
      </div>
    </section>
  );
}
