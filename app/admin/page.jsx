
"use client";

import Link from "next/link";

const sections = [
  ["Products", "Manage product listings and images", "/admin/products"],
  ["Inventory", "Monitor stock and availability", "/admin/inventory"],
  ["Orders", "Review and update customer orders", "/admin/orders"],
  ["Payments", "Review payment records", "/admin/payments"],
  ["Customers", "View customer records", "/admin/customers"],
  ["Coupons", "Manage discounts and offers", "/admin/coupons"],
];

export default function AdminDashboard() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f5f7fb",
      color: "#172033",
      padding: "24px",
      fontFamily: "Arial, sans-serif"
    }}>
      <header style={{
        maxWidth: 1100,
        margin: "0 auto 36px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <Link href="/" style={{
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: 3,
          textDecoration: "none",
          color: "#172033"
        }}>
          VELFROK<span style={{ color: "#e87528" }}>.</span>
        </Link>
        <span style={{ color: "#68738a" }}>Admin panel</span>
      </header>

      <section style={{ maxWidth: 1100, margin: "auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>
          Store dashboard
        </h1>
        <p style={{ color: "#68738a", marginBottom: 28 }}>
          Manage your VELFROK store from one place.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}>
          {sections.map(([title, description, href]) => (
            <Link key={title} href={href} style={{
              background: "#fff",
              border: "1px solid #e3e8f0",
              borderRadius: 16,
              padding: 22,
              minHeight: 110,
              textDecoration: "none",
              color: "#172033",
              boxShadow: "0 4px 15px #17203308"
            }}>
              <h2 style={{ fontSize: 19, margin: "0 0 10px" }}>
                {title} →
              </h2>
              <p style={{
                color: "#68738a",
                fontSize: 14,
                lineHeight: 1.5,
                margin: 0
              }}>
                {description}
              </p>
            </Link>
          ))}
        </div>

        <p style={{
          marginTop: 28,
          color: "#68738a",
          fontSize: 13
        }}>
          Secure administration · VELFROK
        </p>
      </section>
    </main>
  );
}
