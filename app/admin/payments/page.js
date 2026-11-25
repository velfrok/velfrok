
"use client";

import { useEffect, useState } from "react";

export default function PaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPayments() {
      try {
        const response = await fetch("/api/admin/orders", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load payment data (HTTP ${response.status}).`
          );
        }

        const result = await response.json();
        setOrders(Array.isArray(result.orders) ? result.orders : []);
      } catch (err) {
        setError(err.message || "Unable to load payments.");
      } finally {
        setLoading(false);
      }
    }

    loadPayments();
  }, []);

  function getPaymentIntent(order) {
    const payment = order.payment_intents;

    if (Array.isArray(payment)) return payment[0] || {};

    return payment || {};
  }

  function getPaymentStatus(order) {
    const payment = getPaymentIntent(order);

    return (
      payment.status ||
      order.payment_status ||
      order.paymentStatus ||
      "Not available"
    );
  }

  function getOrderReference(order) {
    return order.order_number || order.order_code || order.id || "—";
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  const paymentCount = orders.filter((order) => {
    const payment = getPaymentIntent(order);

    return (
      payment.status ||
      payment.utr ||
      order.payment_status ||
      order.paymentStatus
    );
  }).length;

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "20px",
        color: "#1f2937",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <button
        type="button"
        onClick={() => {
          window.location.href = "/admin/";
        }}
        style={{
          display: "inline-block",
          marginBottom: "20px",
          padding: "10px 16px",
          background: "#111827",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
        }}
      >
        ← Back to Admin Panel
      </button>

      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: "28px" }}>
          Payments Management
        </h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          View payment information linked to existing orders.
        </p>
      </div>

      <section
        style={{
          padding: "18px",
          marginBottom: "22px",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          background: "#fff",
        }}
      >
        <p style={{ margin: "0 0 6px", color: "#6b7280" }}>
          Orders with payment information
        </p>
        <strong style={{ fontSize: "30px" }}>
          {loading ? "…" : paymentCount}
        </strong>
        <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280" }}>
          Read-only view. No payment or order status is changed.
        </p>
      </section>

      {loading && <p>Loading payment information…</p>}

      {!loading && error && (
        <div
          role="alert"
          style={{
            padding: "14px",
            borderRadius: "8px",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            background: "#fff",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: "850px",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ background: "#111827", color: "#fff" }}>
                {[
                  "Order Reference",
                  "Payment Status",
                  "Order Status",
                  "UTR / Reference",
                  "Payment Expiry",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "13px",
                      fontSize: "13px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "22px", textAlign: "center" }}
                  >
                    No orders or payment information found.
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const payment = getPaymentIntent(order);

                  return (
                    <tr
                      key={order.id || index}
                      style={{ borderTop: "1px solid #e5e7eb" }}
                    >
                      <td style={{ padding: "13px" }}>
                        {getOrderReference(order)}
                      </td>
                      <td style={{ padding: "13px" }}>
                        {getPaymentStatus(order)}
                      </td>
                      <td style={{ padding: "13px" }}>
                        {order.status || "—"}
                      </td>
                      <td style={{ padding: "13px" }}>
                        {payment.utr || order.utr || "—"}
                      </td>
                      <td style={{ padding: "13px" }}>
                        {formatDate(payment.expires_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <p
        style={{
          marginTop: "16px",
          color: "#6b7280",
          fontSize: "13px",
          lineHeight: 1.5,
        }}
      >
        Note: This page displays payment details returned with existing orders.
        It does not display payment-intent records that are not linked to those
        orders.
      </p>
    </main>
  );
}
