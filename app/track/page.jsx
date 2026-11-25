"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ── Courier tracking URLs ─────────────────────────────────────────
// Just paste the AWB into the official tracking page manually.
const COURIER_TRACKING = {
  valmo:       { name: "Valmo",        url: "https://www.valmo.in/tracking" },
  bluedart:    { name: "Blue Dart",    url: "https://www.bluedart.com/tracking" },
  ecom:        { name: "Ecom Express", url: "https://ecomexpress.in/tracking/" },
  swa:         { name: "SWA",          url: "https://www.swadelivery.com/tracking" },
  elasticrun:  { name: "ElasticRun",   url: "https://www.elasticrun.in/track" },
};

function getCourierInfo(courierKey) {
  if (!courierKey) return null;
  const key = String(courierKey).toLowerCase().replace(/[\s-]+/g, "");
  // Exact match first
  if (COURIER_TRACKING[key]) return COURIER_TRACKING[key];
  // Fuzzy match — find any key that starts with the input or vice-versa
  const found = Object.entries(COURIER_TRACKING).find(
    ([k]) => k.startsWith(key) || key.startsWith(k)
  );
  return found ? found[1] : { name: courierKey, url: null };
}

const ORDER_STEPS = ["placed", "packed", "dispatched", "delivered"];

function StatusBadge({ value }) {
  const s = (value || "unknown").toLowerCase();
  const color =
    s === "delivered"
      ? "#067647"
      : s === "dispatched"
        ? "#0057b8"
        : s === "cancelled" || s === "failed"
          ? "#b42318"
          : "#6941c6";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 20,
        background: "#f2f4f7",
        color,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}

function Timeline({ status }) {
  const idx = ORDER_STEPS.indexOf((status || "").toLowerCase());
  if (idx < 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "24px 0", flexWrap: "wrap" }}>
      {ORDER_STEPS.map((step, i) => {
        const done = i <= idx;
        const isLast = i === ORDER_STEPS.length - 1;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: done ? "#172033" : "#e3e8f0",
                  color: done ? "#fff" : "#98a2b3",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14,
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, color: done ? "#172033" : "#98a2b3", fontWeight: done ? 700 : 400 }}>
                {step[0].toUpperCase() + step.slice(1)}
              </span>
            </div>
            {!isLast && (
              <div
                style={{
                  width: 48, height: 3, margin: "0 4px",
                  background: i < idx ? "#172033" : "#e3e8f0",
                  marginBottom: 18,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrackButton({ awb, courierKey }) {
  const [copied, setCopied] = useState(false);
  const info = getCourierInfo(courierKey);

  async function handleTrack() {
    // 1. Copy AWB to clipboard
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback for older browsers
      try {
        const el = document.createElement("textarea");
        el.value = awb;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // clipboard unavailable — still open the page
      }
    }

    // 2. Open courier tracking page
    if (info?.url) {
      window.open(info.url, "_blank", "noopener,noreferrer");
    }
  }

  if (!awb) return null;

  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e3e8f0",
        borderRadius: 12,
        padding: 20,
        marginTop: 20,
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15 }}>
        📦 Shipment Details
      </p>

      {info && (
        <p style={{ margin: "0 0 4px", color: "#475467", fontSize: 14 }}>
          Courier: <strong>{info.name}</strong>
        </p>
      )}

      <p style={{ margin: "0 0 16px", color: "#475467", fontSize: 14 }}>
        AWB / Tracking No:{" "}
        <strong style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: 1 }}>
          {awb}
        </strong>
      </p>

      <button
        onClick={handleTrack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          background: "#172033",
          color: "#fff",
          border: 0,
          borderRadius: 10,
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
      >
        {copied ? "✅ AWB Copied! Tracking page opened →" : "🔍 Track Shipment"}
      </button>

      {copied && (
        <p style={{ marginTop: 10, color: "#067647", fontSize: 13 }}>
          AWB number copied to clipboard. Paste it on the tracking page to check your shipment.
        </p>
      )}

      {!info?.url && (
        <p style={{ marginTop: 10, color: "#b54708", fontSize: 13 }}>
          Tracking page not available for this courier. Please contact us with your AWB: <strong>{awb}</strong>
        </p>
      )}
    </div>
  );
}

export default function TrackPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchCode, setSearchCode] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load orders.");
      setOrders(Array.isArray(json.orders) ? json.orders : []);
    } catch (e) {
      setError(e.message || "Could not load your orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = searchCode.trim()
    ? orders.filter((o) =>
        (o.order_code || "").toLowerCase().includes(searchCode.toLowerCase())
      )
    : orders;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#172033",
        fontFamily: "Arial, sans-serif",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link href="/" style={{ color: "#e87528", fontWeight: 700, textDecoration: "none" }}>
          ← Back to Store
        </Link>

        <h1 style={{ marginTop: 20, marginBottom: 6 }}>Track Your Orders</h1>
        <p style={{ color: "#475467", marginBottom: 24 }}>
          Click <strong>Track Shipment</strong> on a dispatched order — your AWB number will be
          copied automatically and the courier's tracking page will open.
        </p>

        {/* Search box */}
        <input
          placeholder="Search by order code (e.g. VFK-…)"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid #d0d5dd",
            borderRadius: 10,
            fontSize: 14,
            marginBottom: 20,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {error && (
          <p
            role="alert"
            style={{ color: "#b42318", background: "#fef3f2", padding: 12, borderRadius: 8 }}
          >
            {error}
          </p>
        )}

        {loading && <p style={{ color: "#68738a" }}>Loading your orders…</p>}

        {!loading && !error && filtered.length === 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e3e8f0",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              color: "#68738a",
            }}
          >
            {orders.length === 0
              ? "You have no orders yet."
              : "No orders match your search."}
          </div>
        )}

        {filtered.map((order) => (
          <div
            key={order.id}
            style={{
              background: "#fff",
              border: "1px solid #e3e8f0",
              borderRadius: 14,
              padding: "20px 20px 16px",
              marginBottom: 16,
              boxShadow: "0 2px 8px #17203308",
            }}
          >
            {/* Order header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <div>
                <span style={{ fontWeight: 800, fontSize: 16 }}>
                  {order.order_code || order.id}
                </span>
                <span style={{ marginLeft: 10 }}>
                  <StatusBadge value={order.status} />
                </span>
              </div>
              <span style={{ color: "#98a2b3", fontSize: 12 }}>
                {order.created_at
                  ? new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
              </span>
            </div>

            <p style={{ color: "#475467", fontSize: 13, margin: "4px 0 0" }}>
              ₹{(order.total_inr || 0).toLocaleString("en-IN")}
              {order.payment_status && (
                <span style={{ marginLeft: 8 }}>
                  · <StatusBadge value={order.payment_status} />
                </span>
              )}
            </p>

            {/* Timeline */}
            <Timeline status={order.status} />

            {/* Track button — shown only for dispatched / delivered orders with AWB */}
            {order.awb_number && (
              <TrackButton
                awb={order.awb_number}
                courierKey={order.courier_company}
              />
            )}

            {/* Dispatched but no AWB yet */}
            {order.status === "dispatched" && !order.awb_number && (
              <p style={{ color: "#b54708", fontSize: 13, marginTop: 12 }}>
                Your order has been dispatched. Tracking details will appear here shortly.
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
