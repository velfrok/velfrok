
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const cellStyle = {
  padding: "12px",
  textAlign: "left",
  verticalAlign: "top",
  borderBottom: "1px solid #e3e8f0",
  whiteSpace: "nowrap",
};

const buttonStyle = {
  padding: "8px 10px",
  border: "1px solid #d0d5dd",
  borderRadius: "7px",
  background: "#fff",
  color: "#344054",
  cursor: "pointer",
  fontWeight: 700,
  margin: "2px",
};

function Status({ value }) {
  const status = value || "unknown";

  const color =
    status === "paid" || status === "utr_submitted"
      ? "#067647"
      : status === "failed" ||
          status === "abandoned" ||
          status === "expired" ||
          status === "cancelled"
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
      {String(status).replaceAll("_", " ")}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/orders", {
        method: "GET",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load orders.");
      }

      setOrders(Array.isArray(result.orders) ? result.orders : []);
    } catch (err) {
      setError(err.message || "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function performAction(order, action) {
    if (busyId) return;

    const descriptions = {
      paid:
        "Have you independently verified the actual bank/UPI receipt and matched the submitted UTR to this order? Stock will be deducted by the existing payment function.",
      failed:
        "Mark this order's payment as failed? This does not issue a refund.",
      packed:
        "Accept and pack this paid order?",
      cancelled:
        "Cancel this order? Any refund must be arranged manually; this action does not issue a refund.",
      dispatched:
        "Mark this order as dispatched?",
      delivered:
        "Mark this order as delivered?",
    };

    if (!window.confirm(descriptions[action])) return;

    if (action === "paid") {
      const payment = Array.isArray(order.payment_intents)
        ? order.payment_intents.find(
            (item) =>
              item.status === "utr_submitted" &&
              typeof item.utr === "string" &&
              item.utr.trim().length >= 6
          )
        : order.payment_intents;

      if (
        !payment ||
        payment.status !== "utr_submitted" ||
        typeof payment.utr !== "string" ||
        payment.utr.trim().length < 6
      ) {
        setError(
          "Payment approval blocked: a submitted UTR of at least 6 characters was not found. Refresh the order and verify its payment details."
        );
        return;
      }
    }

    setBusyId(order.id);
    setError("");
    setNotice("");

    try {
      const payload =
        action === "paid" || action === "failed"
          ? { orderId: order.id, paymentStatus: action }
          : { orderId: order.id, orderStatus: action };

      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The action was rejected.");
      }

      setNotice(
        action === "paid"
          ? "Payment approval completed. Refreshing order details."
          : action === "cancelled"
            ? "Order cancelled. Any refund must be handled manually."
            : "Order updated successfully."
      );

      await loadOrders();
    } catch (err) {
      setError(
        err.message ||
          "The action could not be completed. Refresh the order before retrying."
      );
    } finally {
      setBusyId("");
    }
  }

  function actionButton(order, label, action, disabled = false) {
    return (
      <button
        key={action}
        type="button"
        style={{
          ...buttonStyle,
          opacity: disabled || busyId ? 0.55 : 1,
          cursor: disabled || busyId ? "not-allowed" : "pointer",
        }}
        disabled={Boolean(busyId) || disabled}
        onClick={() => performAction(order, action)}
      >
        {busyId === order.id ? "Processing..." : label}
      </button>
    );
  }

  function renderActions(order) {
    const actions = [];
    const payment = Array.isArray(order.payment_intents)
      ? order.payment_intents[0]
      : order.payment_intents;

    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "failed" &&
      order.status !== "cancelled" &&
      order.status !== "delivered"
    ) {
      actions.push(
        actionButton(
          order,
          "Mark Paid",
          "paid",
          !Array.isArray(order.payment_intents) &&
            (!payment ||
              payment.status !== "utr_submitted" ||
              typeof payment.utr !== "string" ||
              payment.utr.trim().length < 6)
        )
      );
    }

    if (
      order.payment_status !== "paid" &&
      order.payment_status !== "failed" &&
      order.status !== "cancelled" &&
      order.status !== "delivered"
    ) {
      actions.push(
        actionButton(order, "Mark Payment Failed", "failed")
      );
    }

    if (order.status === "placed") {
      if (order.payment_status === "paid") {
        actions.push(actionButton(order, "Accept / Pack", "packed"));
      }

      actions.push(actionButton(order, "Reject / Cancel", "cancelled"));
    }

    if (order.status === "packed") {
      actions.push(actionButton(order, "Dispatch", "dispatched"));
      actions.push(actionButton(order, "Cancel Order", "cancelled"));
    }

    if (order.status === "dispatched") {
      actions.push(actionButton(order, "Mark Delivered", "delivered"));
    }

    if (actions.length === 0) {
      return <span style={{ color: "#667085" }}>No actions available</span>;
    }

    return <div style={{ minWidth: "170px" }}>{actions}</div>;
  }

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
        Verify bank/UPI receipts independently before approving payments.
        Payment approval uses the existing stock-decrement function.
        Cancellation does not issue refunds; arrange refunds manually.
      </p>

      <button
        type="button"
        style={buttonStyle}
        disabled={loading || Boolean(busyId)}
        onClick={loadOrders}
      >
        Refresh Orders
      </button>

      {error && (
        <p
          role="alert"
          style={{
            color: "#b42318",
            background: "#fef3f2",
            padding: "12px",
            borderRadius: "8px",
            marginTop: "12px",
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          style={{
            color: "#067647",
            background: "#ecfdf3",
            padding: "12px",
            borderRadius: "8px",
            marginTop: "12px",
          }}
        >
          {notice}
        </p>
      )}

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

        {!loading && !error && orders.length === 0 && (
          <p>No orders found.</p>
        )}

        {!loading && orders.length > 0 && (
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
                    "Actions",
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
                      <td style={cellStyle}>{order.id || "—"}</td>
                      <td style={cellStyle}>{order.user_id || "—"}</td>
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
                      <td style={cellStyle}>
                        {renderActions(order)}
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
