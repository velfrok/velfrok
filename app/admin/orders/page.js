
import Link from "next/link";

export default function OrdersPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px",
        background: "#f5f7fb",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
      }}
    >
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

      <h1 style={{ marginTop: "24px" }}>Orders Management</h1>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e3e8f0",
          borderRadius: "12px",
          padding: "20px",
          marginTop: "20px",
        }}
      >
        <p>Orders page created successfully.</p>
        <p>
          Order data will be connected after we verify the
          Supabase database schema.
        </p>
      </section>
    </main>
  );
}
