
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const cellStyle = {
  padding: "12px",
  textAlign: "left",
  verticalAlign: "top",
  borderBottom: "1px solid #e3e8f0",
  whiteSpace: "nowrap",
};

function Status({ value }) {
  const status = value || "unknown";

  const color =
    status === "paid" || status === "utr_submitted"
      ? "#067647"
      : status === "failed" ||
          status === "abandoned" ||
          status === "expired"
        ? "#b42318"
        : "#6941c6";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "6px",
        background: "#f2f4f7",
        color,
        fontWeight: 700,
        fontSize: "12px",
      }}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

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
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load orders.");
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
        style={{ color: "#e87528", fontWeight: 700 }}
      >
        ← Back to Admin Dashboard
      </Link>

      <h1 style={{ marginTop: "24px" }}>Orders Management</h1>

      <p style={{ color: "#475467", lineHeight: 1.6 }}>
        Review order and payment information below. Verify payments
        directly in your bank or UPI account before approving them.
      </p>

      <section
        style={{
          background: "#fff",
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
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Order Code",
                    "Order ID",
                    "User ID",
                    "Payment Status",
                    "Order Status",
                    "Payment Intent",
                    "Submitted UTR",
                    "Payment Expiry",
                  ].map((heading) => (
                    <th key={heading} style={cellStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => {
                  const payment = Array.isArray(order.payment_intents)
                    ? order.payment_intents[0]
                    : order.payment_intents;

                  return (
                    <tr key={order.id}>
                      <td style={cellStyle}>
                        {order.order_code || "—"}
                      </td>

                      <td style={cellStyle}>
                        {order.id || "—"}
                      </td>

                      <td style={cellStyle}>
                        {order.user_id || "—"}
                      </td>

                      <td style={cellStyle}>
                        <Status value={order.payment_status} />
                      </td>

                      <td style={cellStyle}>
                        <Status value={order.status} />
                      </td>

                      <td style={cellStyle}>
                        <Status value={payment?.status} />
                      </td>

                      <td style={cellStyle}>
                        {payment?.utr || "No UTR submitted"}
                      </td>

                      <td style={cellStyle}>
                        {payment?.expires_at
                          ? new Date(payment.expires_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </section>
    </main>
  );
}
