
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [stockInputs, setStockInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

      const items = Array.isArray(result.products)
        ? result.products
        : [];

      setProducts(items);
      setStockInputs((previous) => {
        const next = {};

        for (const product of items) {
          next[product.id] =
            previous[product.id] ?? String(product.stock ?? 0);
        }

        return next;
      });
    } catch (err) {
      setError(err.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  async function saveStock(product) {
    const rawStock = stockInputs[product.id];

    if (
      rawStock === "" ||
      !/^\d+$/.test(String(rawStock)) ||
      !Number.isSafeInteger(Number(rawStock))
    ) {
      setError("Stock must be a non-negative whole number.");
      setMessage("");
      return;
    }

    const stock = Number(rawStock);

    setSavingId(product.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: product.id,
          stock,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save stock.");
      }

      const updatedProduct = result.product;

      if (!updatedProduct) {
        throw new Error(
          "The server did not return the updated product. Refresh inventory to verify."
        );
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === updatedProduct.id ? updatedProduct : item
        )
      );

      setStockInputs((current) => ({
        ...current,
        [updatedProduct.id]: String(updatedProduct.stock ?? 0),
      }));

      setMessage(
        `Stock saved for ${updatedProduct.name || product.name}.`
      );
    } catch (err) {
      setError(err.message || "Unable to save stock.");
    } finally {
      setSavingId(null);
    }
  }

  const cardStyle = {
    background: "#ffffff",
    padding: "18px",
    border: "1px solid #e3e8f0",
    borderRadius: "12px",
  };

  const buttonStyle = {
    padding: "9px 13px",
    background: "#e87528",
    color: "#ffffff",
    border: 0,
    borderRadius: "7px",
    fontWeight: 700,
    cursor: "pointer",
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
          View product stock, change quantities, and save updates to
          your database.
        </p>

        <button
          type="button"
          onClick={() => {
            setMessage("");
            loadInventory();
          }}
          disabled={loading || savingId !== null}
          style={{
            ...buttonStyle,
            cursor:
              loading || savingId !== null ? "wait" : "pointer",
            opacity: loading || savingId !== null ? 0.6 : 1,
          }}
        >
          {loading ? "Loading..." : "Refresh Inventory"}
        </button>

        {error && (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              background: "#fee2e2",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "18px",
            }}
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            style={{
              color: "#166534",
              background: "#dcfce7",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "18px",
            }}
          >
            {message}
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
              <p style={{ color: "#68738a", margin: 0 }}>
                Total products
              </p>
              <h2>{products.length}</h2>
            </div>

            <div>
              <p style={{ color: "#68738a", margin: 0 }}>
                Units in stock
              </p>
              <h2>
                {products.reduce(
                  (total, product) =>
                    total + (Number(product.stock) || 0),
                  0
                )}
              </h2>
            </div>

            <div>
              <p style={{ color: "#68738a", margin: 0 }}>
                Out of stock
              </p>
              <h2>
                {
                  products.filter(
                    (product) => Number(product.stock) === 0
                  ).length
                }
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
                  minWidth: "760px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr style={{ background: "#172033", color: "#ffffff" }}>
                    {[
                      "SKU",
                      "Product",
                      "Price",
                      "Current Stock",
                      "New Stock",
                      "Status",
                      "Action",
                    ].map((heading) => (
                      <th key={heading} style={{ padding: "12px" }}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const currentStock = Number(product.stock) || 0;
                    const inputStock = stockInputs[product.id] ?? "";
                    const isSaving = savingId === product.id;

                    const isValid =
                      String(inputStock) !== "" &&
                      /^\d+$/.test(String(inputStock)) &&
                      Number.isSafeInteger(Number(inputStock));

                    const isChanged =
                      isValid && Number(inputStock) !== currentStock;

                    return (
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
                          ₹
                          {Number(product.price_inr || 0).toLocaleString(
                            "en-IN"
                          )}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {currentStock}
                        </td>

                        <td style={{ padding: "12px" }}>
                          <input
                            type="number"
                            min="0"
                            max="9007199254740991"
                            step="1"
                            inputMode="numeric"
                            aria-label={`New stock for ${product.name || product.sku}`}
                            value={inputStock}
                            disabled={savingId !== null}
                            onChange={(event) => {
                              setStockInputs((current) => ({
                                ...current,
                                [product.id]: event.target.value,
                              }));
                              setError("");
                              setMessage("");
                            }}
                            style={{
                              width: "100px",
                              padding: "9px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              fontSize: "14px",
                            }}
                          />
                        </td>

                        <td style={{ padding: "12px" }}>
                          {currentStock === 0
                            ? "Out of stock"
                            : product.is_active
                              ? "Active"
                              : "Inactive"}
                        </td>

                        <td style={{ padding: "12px" }}>
                          <button
                            type="button"
                            disabled={!isChanged || isSaving || savingId !== null}
                            onClick={() => saveStock(product)}
                            style={{
                              ...buttonStyle,
                              opacity:
                                !isChanged || isSaving || savingId !== null
                                  ? 0.5
                                  : 1,
                              cursor:
                                !isChanged || isSaving || savingId !== null
                                  ? "not-allowed"
                                  : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isSaving ? "Saving..." : "Save Stock"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
            }
                               
