
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const response = await fetch("/api/admin/orders", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load orders.");
        }

        if (active) {
          setOrders(Array.isArray(result.orders) ? result.orders : []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Something went wrong.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, []);

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
          overflowX: "auto",
        }}
      >
        {loading && <p>Loading orders...</p>}

        {!loading && error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        {!loading && !error && orders.length === 0 && (
          <p>No orders found.</p>
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <p>Total orders loaded: {orders.length}</p>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  {["Order Code", "Order ID", "User ID"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #e3e8f0",
                        background: "#f5f7fb",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
                      {order.order_code || "—"}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
                      {order.id || "—"}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
                      {order.user_id || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </main>
  );
}
