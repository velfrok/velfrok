
export const metadata = {
  title: "Inventory | VELFROK Admin",
};

export default function InventoryPage() {
  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>Inventory Management</h1>

      <p>
        Manage your VELFROK product stock and availability.
      </p>

      <a
        href="/admin"
        style={{
          display: "inline-block",
          padding: "10px 16px",
          background: "#111827",
          color: "#ffffff",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        Back to Admin Dashboard
      </a>

      <section
        style={{
          marginTop: "24px",
          padding: "20px",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
        }}
      >
        <h2>Stock Overview</h2>
        <p>
          Inventory management is being set up.
        </p>
        <p>
          Product stock records will appear here after
          the database connection is implemented.
        </p>
      </section>
    </main>
  );
}
