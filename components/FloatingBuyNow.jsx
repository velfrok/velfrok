
"use client";

import { useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartContext } from "@/context/CartContext";

export default function FloatingBuyNow() {
  const { count, hydrated } = useContext(CartContext);
  const pathname = usePathname();

  // Show this button only on customer-facing pages.
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    !hydrated ||
    count < 1
  ) {
    return null;
  }

  return (
    <Link
      href="/checkout"
      aria-label={`Buy now. ${count} item${count === 1 ? "" : "s"} in cart`}
      style={{
        position: "fixed",
        right: "18px",
        bottom: "22px",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "11px",
        minHeight: "56px",
        padding: "0 22px",
        borderRadius: "999px",
        background: "#20211e",
        color: "#ffffff",
        textDecoration: "none",
        fontSize: "15px",
        fontWeight: 700,
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "21px" }}>
        🛒
      </span>

      <span>Buy Now</span>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "24px",
          height: "24px",
          padding: "0 5px",
          borderRadius: "999px",
          background: "#ffffff",
          color: "#20211e",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {count}
      </span>
    </Link>
  );
}
