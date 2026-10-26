
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load inventory.");
      }

      setProducts(Array.isArray(result.products) ? result.products : []);
    } catch (err) {
      setError(err.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const cardStyle = {
    background: "#ffffff",
    padding: "18px",
    border: "1px solid #e3e8f0",
    borderRadius: "12px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#172033",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{
            color: "#e87528",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← Back to Admin Dashboard
        </Link>

        <h1 style={{ marginTop: "24px" }}>Inventory Management</h1>
        <p style={{ color: "#68738a", lineHeight: 1.6 }}>
          Monitor product stock and availability.
        </p>

        <button
          type="button"
          onClick={loadInventory}
          disabled={loading}
          style={{
            padding: "10px 16px",
            background: "#e87528",
            color: "#ffffff",
            border: 0,
            borderRadius: "8px",
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh Inventory"}
        </button>

        {error && (
          <p role="alert" style={{ color: "#b91c1c", marginTop: "18px" }}>
            {error}
          </p>
        )}

        {!error && !loading && (
          <section
            style={{
              ...cardStyle,
              marginTop: "22px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <p style={{ color: "#68738a", margin: 0 }}>Total products</p>
              <h2>{products.length}</h2>
            </div>

            <div>
              <p style={{ color: "#68738a", margin: 0 }}>Units in stock</p>
              <h2>
                {products.reduce(
                  (total, product) => total + (Number(product.stock) || 0),
                  0
                )}
              </h2>
            </div>

            <div>
              <p style={{ color: "#68738a", margin: 0 }}>Out of stock</p>
              <h2>
                {products.filter(
                  (product) => Number(product.stock) === 0
                ).length}
              </h2>
            </div>
          </section>
        )}

        <section
          style={{
            ...cardStyle,
            marginTop: "22px",
            overflow: "hidden",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Product Stock</h2>

          {loading ? (
            <p>Loading inventory...</p>
          ) : !error && products.length === 0 ? (
            <p>No products found. Add products from the Products page.</p>
          ) : !error ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "600px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ background: "#172033", color: "#ffffff" }}>
                    {["SKU", "Product", "Price", "Stock", "Status"].map(
                      (heading) => (
                        <th key={heading} style={{ padding: "12px" }}>
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      style={{ borderBottom: "1px solid #e3e8f0" }}
                    >
                      <td style={{ padding: "12px" }}>
                        {product.sku || "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {product.name || "—"}
                      </td>
                      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                        ₹{Number(product.price_inr || 0).toLocaleString("en-IN")}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 700,
                          color: Number(product.stock) === 0 ? "#b91c1c" : "#172033",
                        }}
                      >
                        {product.stock ?? 0}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {Number(product.stock) === 0
                          ? "Out of stock"
                          : product.is_active
                            ? "Active"
                            : "Inactive"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
