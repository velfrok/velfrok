
"use client";

import { useContext, useState } from "react";
import { CartContext } from "@/context/CartContext";

export default function ProductGrid({ products = [] }) {
  const { add } = useContext(CartContext);
  const [addedSku, setAddedSku] = useState("");
  const [popupProduct, setPopupProduct] = useState(null);

  if (!products.length) {
    return (
      <div className="empty-products">
        <div className="empty-icon" aria-hidden="true">
          ✳
        </div>
        <h3>Your next favourite belongs here.</h3>
        <p>There are no active products to show yet.</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product, index) => {
        const inStock = Number(product.stock || 0) > 0;
        const imageUrl =
          typeof product.image_url === "string"
            ? product.image_url.trim()
            : "";

        return (
          <article
            className="product-card"
            key={product.id || product.sku || index}
            style={{ "--card-index": index }}
          >
            <a
              className="product-image-wrap"
              href={`/product/${encodeURIComponent(
                product.sku || product.id
              )}`}
              aria-label={`View ${product.name || "product"}`}
            >
              {imageUrl ? (
                <>
                  <img
                    className="product-image"
                    src={imageUrl}
                    alt={product.name || "Product"}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const diagnostic =
                        event.currentTarget.parentElement?.querySelector(
                          ".image-diagnostic"
                        );

                      if (diagnostic) {
                        diagnostic.style.display = "block";
                      }
                    }}
                    onLoad={(event) => {
                      event.currentTarget.style.display = "block";
                      const diagnostic =
                        event.currentTarget.parentElement?.querySelector(
                          ".image-diagnostic"
                        );

                      if (diagnostic) {
                        diagnostic.style.display = "none";
                      }
                    }}
                  />

                  <div
                    className="image-diagnostic"
                    style={{
                      display: "none",
                      padding: "12px",
                      background: "#fff",
                      color: "#111",
                      fontSize: "12px",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <strong>VELFROK DIAGNOSTIC TEST 726</strong>
                    <p>Product: {product.name || "Unnamed product"}</p>
                    <p>Image URL: {imageUrl}</p>
                  </div>
                </>
              ) : (
                <div className="product-placeholder">
                  <span>VELFROK</span>
                  <i>Everyday essentials</i>
                </div>
              )}

              <span
                className={`stock-pill ${
                  inStock ? "in-stock" : "out-stock"
                }`}
              >
                {inStock ? "Available" : "Sold out"}
              </span>
            </a>

            <div className="product-info">
              <p className="product-kicker">EVERYDAY ESSENTIAL</p>

              <h3>{product.name || "Untitled product"}</h3>

              <div className="product-bottom">
                <p className="product-price">
                  ₹
                  {Number(
                    product.price_inr || 0
                  ).toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </p>

                <button
                  className={`add-button ${
                    addedSku === product.sku ? "is-added" : ""
                  }`}
                  type="button"
                  disabled={!product.sku || !inStock}
                  onClick={() => {
                    add(product);
                    setAddedSku(product.sku);
                    setPopupProduct(product);
                    setTimeout(() => setAddedSku(""), 1400);
                  }}
                >
                  {addedSku === product.sku
                    ? "Added ✓"
                    : "Add to bag +"}
                </button>
              </div>
            </div>
          </article>
        );
      })}

      {/* Customer storefront add-to-cart popup */}
      {popupProduct && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPopupProduct(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Product added to cart"
            style={{
              background: "#fff",
              color: "#222",
              borderRadius: "16px",
              padding: "28px 22px",
              width: "100%",
              maxWidth: "360px",
              textAlign: "center",
              boxShadow: "0 15px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: "42px",
                marginBottom: "10px",
                color: "#183f32",
              }}
            >
              ✓
            </div>

            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "21px",
              }}
            >
              Added to your bag!
            </h2>

            <p
              style={{
                margin: "0 0 22px",
                color: "#666",
              }}
            >
              {popupProduct.name} has been added to your cart.
            </p>

            <a
              href="/cart"
              style={{
                display: "block",
                background: "#183f32",
                color: "#fff",
                padding: "13px",
                borderRadius: "8px",
                textDecoration: "none",
                marginBottom: "10px",
              }}
            >
              View Cart
            </a>

            <button
              type="button"
              onClick={() => setPopupProduct(null)}
              style={{
                background: "transparent",
                border: "none",
                padding: "10px",
                cursor: "pointer",
                color: "#555",
              }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
