"use client";

import { useContext, useState } from "react";
import { CartContext } from "@/context/CartContext";

export default function ProductGrid({ products = [] }) {
  const { add } = useContext(CartContext);
  const [addedSku, setAddedSku] = useState("");

  if (!products.length) {
    return (
      <div className="empty-products">
        <div className="empty-icon" aria-hidden="true">✳</div>
        <h3>Your next favourite belongs here.</h3>
        <p>There are no active products to show yet.</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product, index) => {
        const inStock = Number(product.stock || 0) > 0;
        return (
          <article className="product-card" key={product.id || product.sku} style={{ "--card-index": index }}>
            <a className="product-image-wrap" href={`/product/${encodeURIComponent(product.sku || product.id)}`} aria-label={`View ${product.name}`}>
              {product.image_url
                ? <img className="product-image" src={product.image_url} alt={product.name || "Product"} loading="lazy" />
                : <div className="product-placeholder"><span>VELFROK</span><i>Everyday essentials</i></div>}
              <span className={`stock-pill ${inStock ? "in-stock" : "out-stock"}`}>{inStock ? "Available" : "Sold out"}</span>
            </a>
            <div className="product-info">
              <p className="product-kicker">EVERYDAY ESSENTIAL</p>
              <h3>{product.name || "Untitled product"}</h3>
              <div className="product-bottom">
                <p className="product-price">₹{Number(product.price_inr || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                <button
                  className={`add-button ${addedSku === product.sku ? "is-added" : ""}`}
                  type="button"
                  disabled={!product.sku || !inStock}
                  onClick={() => { add(product); setAddedSku(product.sku); setTimeout(() => setAddedSku(""), 1400); }}
                >
                  {addedSku === product.sku ? "Added ✓" : "Add to bag +"}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
