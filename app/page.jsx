
import ProductGrid from "@/components/ProductGrid";
import { supabaseBrowser } from "@/lib/supabase";

export const revalidate = 60;

export default async function Home() {
  let products = [];
  let loadError = false;

  try {
    const { data, error } = await supabaseBrowser()
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) loadError = true;
    products = data || [];
  } catch {
    loadError = true;
  }

  return (
    <>
      {/* Customer Login Link */}
      <nav
        aria-label="Account navigation"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "12px 20px",
          borderBottom: "1px solid #eeeeee",
          background: "#ffffff",
        }}
      >
        <a
          href="/login"
          style={{
            display: "inline-block",
            color: "#111827",
            textDecoration: "none",
            fontWeight: 600,
            padding: "10px 20px",
            border: "1px solid #111827",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          Login
        </a>
      </nav>

      {/* Homepage Hero */}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">THE EVERYDAY EDIT</p>

          <h1>
            Little things.
            <br />
            <em>Better living.</em>
          </h1>

          <p className="hero-description">
            Useful everyday essentials, selected to make your routine feel a
            little easier.
          </p>

          <a className="button button-dark" href="#shop">
            Explore the collection{" "}
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div
          className="hero-art"
          aria-label="VELFROK everyday essentials"
        >
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-stamp">
            GOOD
            <br />
            THINGS
            <br />
            DAILY
          </div>
          <div className="hero-caption">
            Curated for your everyday.
          </div>
        </div>
      </section>

      {/* Store Benefits */}
      <section className="trust-strip" aria-label="Store benefits">
        <span>Thoughtfully selected</span>
        <span>Everyday essentials</span>
        <span>Simple, useful, reliable</span>
      </section>

      {/* Product Collection */}
      <section id="shop" className="shop-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE COLLECTION</p>
            <h2>
              Shop essentials<span>.</span>
            </h2>
          </div>

          <p>Find your next everyday favourite.</p>
        </div>

        {loadError && (
          <p className="notice" role="status">
            Products could not be loaded right now. Please check back shortly.
          </p>
        )}

                <ProductGrid products={products} />
      </section>
    </>
  );
}
