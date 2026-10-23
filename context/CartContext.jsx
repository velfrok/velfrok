"use client";
import { createContext, useEffect, useMemo, useState } from "react";
export const CartContext = createContext({ cart: [], add: () => {}, clear: () => {} });
export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  useEffect(() => {
    try { const saved = localStorage.getItem("velfrok-cart"); if (saved) setCart(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("velfrok-cart", JSON.stringify(cart)); } catch {} }, [cart]);
  const value = useMemo(() => ({
    cart,
    add(product) { setCart(old => { const found = old.find(i => i.sku === product.sku); return found ? old.map(i => i.sku === product.sku ? { ...i, qty: Math.min(10, i.qty + 1) } : i) : [...old, { sku: product.sku, qty: 1, name: product.name, price_inr: product.price_inr }]; }); },
    clear() { setCart([]); }
  }), [cart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
