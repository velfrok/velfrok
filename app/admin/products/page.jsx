
import Link from "next/link";

export default function AdminProductsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#172033",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{
            color: "#e87528",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Back to Admin Dashboard
        </Link>

        <h1 style={{ marginTop: 28 }}>Products</h1>

        <p style={{ color: "#68738a", lineHeight: 1.6 }}>
          Manage your VELFROK product listings and images.
        </p>

        <section
          style={{
            marginTop: 24,
            padding: 22,
            background: "#fff",
            border: "1px solid #e3e8f0",
            borderRadius: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Product management</h2>
          <p style={{ color: "#68738a", lineHeight: 1.6 }}>
            This page is ready for the product management features to be
            connected.
          </p>
          <Link
            href="/admin"
            style={{
              display: "inline-block",
              background: "#172033",
              color: "#fff",
              padding: "11px 16px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Return to Dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
