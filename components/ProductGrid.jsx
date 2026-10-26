
"use client";

import { useContext, useState } from "react";
import { CartContext } from "@/context/CartContext";

export default function ProductGrid({ products = [] }) {
  const { add } = useContext(CartContext);
  const [addedSku, setAddedSku] = useState("");

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
                    <strong>Image failed to load.</strong>
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
    </div>
  );
}
