"use client";

import { useContext } from "react";
import Link from "next/link";
import { CartContext } from "@/context/CartContext";

export default function CartPage() {
  const { cart, subtotal, remove, setQuantity, clear } = useContext(CartContext);

  if (!cart.length) {
    return (
      <section className="simple-page">
        <p className="eyebrow">YOUR BAG</p>
        <h1>
          Your bag is empty<span>.</span>
        </h1>
        <p className="muted">Add a few everyday essentials to continue.</p>
        <Link href="/" className="button button-dark">
          Continue shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="simple-page">
      <p className="eyebrow">YOUR BAG</p>
      <h1>
        Your order<span>.</span>
      </h1>

      <div className="cart-layout">
        <div className="cart-items">
          {cart.map((item) => {
            const quantity = Number(item.qty || 1);
            const stockLimit = Math.min(10, Math.max(1, Number(item.stock || 1)));

            return (
              <article className="cart-item" key={item.sku}>
                <div>
                  <strong>{item.name}</strong>
                  <p>₹{Number(item.price_inr || 0).toLocaleString("en-IN")}</p>
                </div>

                <div
                  className="quantity-controls"
                  aria-label={`Quantity controls for ${item.name}`}
                >
                  <button
                    type="button"
                    aria-label={`Decrease ${item.name} quantity`}
                    onClick={() => setQuantity(item.sku, quantity - 1)}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${item.name} quantity`}
                    onClick={() => setQuantity(item.sku, quantity + 1)}
                    disabled={quantity >= stockLimit}
                  >
                    +
                  </button>
                </div>

                <strong>
                  ₹{(Number(item.price_inr || 0) * quantity).toLocaleString("en-IN")}
                </strong>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => remove(item.sku)}
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>

        <aside className="cart-summary">
          <h2>Summary</h2>
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>
              ₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </strong>
          </div>

          <Link href="/checkout" className="button button-dark button-full">
            Proceed to checkout
          </Link>

          <button type="button" className="text-button" onClick={clear}>
            Clear bag
          </button>
        </aside>
      </div>
    </section>
  );
}
