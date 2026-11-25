"use client";

import { useContext } from "react";
import { CartContext } from "@/context/CartContext";

export default function AddToBagButton({ product }) {
  const { add } = useContext(CartContext);

  return (
    <button
      type="button"
      className="button button-dark button-full"
      onClick={() => add(product)}
      disabled={Number(product.stock || 0) < 1}
    >
      {Number(product.stock || 0) < 1 ? "Sold out" : "Add to bag"}
    </button>
  );
}
