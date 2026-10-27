"use client";

import { createContext, useEffect, useMemo, useState } from "react";

const noop = () => {};

export const CartContext = createContext({
cart: [],
add: noop,
clear: noop,
remove: noop,
setQuantity: noop,
count: 0,
subtotal: 0,
hydrated: false,
});

export function CartProvider({ children }) {
const [cart, setCart] = useState([]);
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
try {
const saved = localStorage.getItem("velfrok-cart");

  if (saved) {
    const parsed = JSON.parse(saved);

    if (Array.isArray(parsed)) {
      setCart(parsed.filter((item) => item && item.sku));
    }
  }
} catch {
  localStorage.removeItem("velfrok-cart");
} finally {
  setHydrated(true);
}

}, []);

useEffect(() => {
if (!hydrated) return;

try {
  localStorage.setItem("velfrok-cart", JSON.stringify(cart));
} catch {}

}, [cart, hydrated]);

const value = useMemo(() => {
const add = (product) => {
if (!product?.sku || Number(product.stock || 0) < 1) return;

  setCart((old) => {
    const found = old.find((item) => item.sku === product.sku);

    if (found) {
      return old.map((item) =>
        item.sku === product.sku
          ? {
              ...item,
              qty: Math.min(10, Number(item.qty || 1) + 1),
            }
          : item
      );
    }

    return [
      ...old,
      {
        sku: product.sku,
        qty: 1,
        name: product.name || "Product",
        price_inr: Number(product.price_inr || 0),
        image_url: product.image_url || "",
        stock: Number(product.stock || 0),
      },
    ];
  });
};

const remove = (sku) => {
  setCart((old) => old.filter((item) => item.sku !== sku));
};

const setQuantity = (sku, quantity) => {
  const qty = Math.floor(Number(quantity));

  if (!Number.isFinite(qty) || qty < 1) {
    return remove(sku);
  }

  setCart((old) =>
    old.map((item) =>
      item.sku === sku
        ? {
            ...item,
            qty: Math.min(
              10,
              qty,
              Math.max(1, Number(item.stock || 10))
            ),
          }
        : item
    )
  );
};

const clear = () => setCart([]);

const count = cart.reduce(
  (sum, item) => sum + Number(item.qty || 0),
  0
);

const subtotal = cart.reduce(
  (sum, item) =>
    sum + Number(item.price_inr || 0) * Number(item.qty || 0),
  0
);

return {
  cart,
  add,
  clear,
  remove,
  setQuantity,
  count,
  subtotal,
  hydrated,
};

}, [cart, hydrated]);

return (
<CartContext.Provider value={value}>
{children}
</CartContext.Provider>
);
}
