import Image from "next/image";
import { notFound } from "next/navigation";
import AddToBagButton from "@/components/AddToBagButton";
import { supabaseBrowser } from "@/lib/supabase";

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;
  const normalizedSlug = decodeParam(slug);

  if (!normalizedSlug) {
    notFound();
  }

  const { data, error } = await supabaseBrowser()
    .from("products")
    .select("*")
    .or(`slug.eq.${normalizedSlug},sku.eq.${normalizedSlug}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return (
    <section className="simple-page product-detail-page">
      <div className="product-detail">
        <div className="product-image-panel">
          <Image
            src={data.image_url || "/placeholder.webp"}
            alt={data.name || "Product image"}
            width={800}
            height={800}
            className="detail-image"
          />
        </div>

        <div className="product-info-panel">
          <p className="eyebrow">EVERYDAY ESSENTIAL</p>
          <h1>{data.name || "Product"}</h1>

          <div className="price-row">
            <strong>₹{Number(data.price_inr || 0).toLocaleString("en-IN")}</strong>
            {Number(data.mrp_inr || 0) > Number(data.price_inr || 0) && (
              <s>₹{Number(data.mrp_inr || 0).toLocaleString("en-IN")}</s>
            )}
          </div>

          <p className="muted">
            {data.description || "Thoughtfully selected for daily routines."}
          </p>

          <AddToBagButton product={data} />

          <div className="detail-meta">
            <span>{Number(data.stock || 0) > 0 ? "In stock" : "Sold out"}</span>
            <span>SKU: {data.sku || "—"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function decodeParam(value) {
  if (!value) return "";

  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}
