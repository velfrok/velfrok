"use client";

import { useEffect, useState } from "react";

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInventory() {
      try {
        const response = await fetch("/api/admin/products", {
          credentials: "same-origin",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load inventory.");
        }

        const items = Array.isArray(data)
          ? data
          : data.products ?? [];

        setProducts(items);
      } catch (err) {
        setError(err.message || "Unable to load inventory.");
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, []);

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Inventory</h1>
      <p>View your product stock and availability.</p>

      {loading && <p>Loading inventory...</p>}

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      {!loading && !error && products.length === 0 && (
        <p>No products found. Add products to see them here.</p>
      )}

      {!loading && !error && products.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 10, borderBottom: "1px solid #ccc" }}>
                  Product
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid #ccc" }}>
                  SKU
                </th>
                <th style={{ padding: 10, borderBottom: "1px solid #ccc" }}>
                  Stock
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={product.id ?? product.sku ?? index}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {product.name ?? product.title ?? "Unnamed product"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {product.sku ?? "—"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {product.stock ?? product.quantity ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
          }
