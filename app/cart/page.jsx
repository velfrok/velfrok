"use client";

import { useContext } from "react";
import { CartContext } from "@/context/CartContext";

export default function CartPage() {
  const { cart, setQuantity, remove, subtotal } = useContext(CartContext);

  return (
    <section className="simple-page">
      <p className="eyebrow">YOUR SELECTION</p>
      <h1>Your bag<span>.</span></h1>
      {!cart.length ? (
        <div className="empty-products">
          <h2>Your bag is waiting.</h2>
          <p>Explore the collection and add something useful.</p>
          <a className="button button-dark" href="/#shop">Continue shopping</a>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map(item => (
              <article className="cart-item" key={item.sku}>
                <div className="cart-thumb">
                  {item.image_url ? <img src={item.image_url} alt="" /> : <span>V</span>}
                </div>
                <div className="cart-item-main">
                  <h2>{item.name}</h2>
                  <p>₹{Number(item.price_inr || 0).toLocaleString("en-IN")}</p>
                  <button className="text-button" onClick={() => remove(item.sku)} type="button">Remove</button>
                </div>
                <label className="quantity-control">Qty
                  <input aria-label={`Quantity for ${item.name}`} type="number" min="1" max={Math.min(10, Number(item.stock || 10))} value={item.qty} onChange={e => setQuantity(item.sku, e.target.value)} />
                </label>
              </article>
            ))}
          </div>
          <aside className="order-summary">
            <h2>Order summary</h2>
            <div className="summary-line"><span>Subtotal</span><strong>₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
            <p className="muted">Shipping and final charges, if any, are confirmed at checkout.</p>
            <a className="button button-dark button-full" href="/checkout">Continue to checkout</a>
          </aside>
        </div>
      )}
    </section>
  );
}
