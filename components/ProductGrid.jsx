"use client";
import { useContext } from "react";
import { CartContext } from "@/context/CartContext";
export default function ProductGrid({ products = [] }) {
  const { add } = useContext(CartContext);
  if (!products.length) return <section className="products"><p>No products are available yet.</p></section>;
  return <section className="products"><h2>Shop products</h2><div className="grid">{products.map(p => <article className="card" key={p.id || p.sku}>
    {p.image_url ? <img className="card-img" src={p.image_url} alt={p.name || "Product"} loading="lazy" /> : <div className="card-img placeholder" aria-label="No product image">VELFROK</div>}
    <div className="card-body"><h3>{p.name}</h3><p className="price">₹{Number(p.price_inr || 0).toFixed(2)}</p><p>{Number(p.stock || 0) > 0 ? "In stock" : "Out of stock"}</p>
    <button type="button" disabled={!p.sku || Number(p.stock || 0) < 1} onClick={() => add(p)}>Add to cart</button></div>
  </article>)}</div><p><a href="/checkout">Go to checkout</a></p></section>;
}
