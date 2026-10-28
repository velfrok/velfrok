
"use client";

import { useState } from "react";
import Link from "next/link";

export default function CouponsPage() {
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    setMessage(
      "Preview only. No coupon has been saved. Real coupon saving will be enabled after API verification."
    );
  }

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        color: "#1f2937",
      }}
    >
      <Link
        href="/admin"
        style={{
          display: "inline-block",
          marginBottom: "20px",
          color: "#e87528",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        ← Back to Admin Dashboard
      </Link>

      <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>
        Coupons Management
      </h1>

      <p style={{ color: "#6b7280", marginBottom: "24px" }}>
        Manage discount coupons for your store.
      </p>

      <section
        style={{
          padding: "20px",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          background: "#fff",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ fontSize: "19px", marginTop: 0 }}>
          Create Coupon — Preview
        </h2>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="couponCode"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Coupon code
          </label>

          <input
            id="couponCode"
            value={couponCode}
            onChange={(event) =>
              setCouponCode(event.target.value.toUpperCase())
            }
            placeholder="e.g. SAVE10"
            required
            maxLength={40}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          />

          <label
            htmlFor="discount"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Discount percentage
          </label>

          <input
            id="discount"
            type="number"
            min="1"
            max="100"
            step="1"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "12px 18px",
              border: "none",
              borderRadius: "8px",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Preview Coupon
          </button>
        </form>

        {message && (
          <p
            role="status"
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "8px",
              background: "#fef3c7",
              color: "#92400e",
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}
      </section>

      <section
        style={{
          padding: "16px",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          background: "#f9fafb",
          lineHeight: 1.6,
        }}
      >
        <strong>Important:</strong> This page is currently a UI preview. It
        does not create, save, activate, or apply real coupons. The existing
        database and API must be tested before real coupon management is enabled.
      </section>
    </main>
  );
}
