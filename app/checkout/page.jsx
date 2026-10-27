
"use client";

import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { CartContext } from "@/context/CartContext";
import { supabaseBrowser } from "@/lib/supabase";

export default function Checkout() {
  const { cart, clear, subtotal } = useContext(CartContext);
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function placeOrder(event) {
    event.preventDefault();
    setErr("");

    if (!cart.length) {
      setErr("Your cart is empty. Add a product before checkout.");
      return;
    }

    // FIX: Capture form values before any asynchronous operation.
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));

    setBusy(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabaseBrowser().auth.getSession();

      if (sessionError || !session) {
        setErr("Please sign in before placing your order.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          items: cart.map((item) => ({
            sku: item.sku,
            qty: item.qty,
          })),
          coupon:
            typeof window !== "undefined"
              ? sessionStorage.getItem("coupon")
              : null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(
          json.error ||
            "We couldn't place your order. Please try again."
        );
        setBusy(false);
        return;
      }

      if (!json.token) {
        setErr(
          "Your order response is incomplete. Please contact support before trying again."
        );
        setBusy(false);
        return;
      }

      clear();
      router.push(`/payment/${json.token}`);
    } catch (error) {
      console.error("Checkout error:", error);
      setErr("A network error occurred. Please try again.");
      setBusy(false);
    }
  }

  if (!cart.length) {
    return (
      <section className="simple-page">
        <p className="eyebrow">CHECKOUT</p>
        <h1>
          Almost there<span>.</span>
        </h1>
        <div className="notice">
          Your bag is empty. <a href="/#shop">Browse products</a> before
          checkout.
        </div>
      </section>
    );
  }

  return (
    <section className="simple-page">
      <p className="eyebrow">SECURE CHECKOUT</p>
      <h1>
        Delivery details<span>.</span>
      </h1>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={placeOrder}>
          <div className="form-grid">
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={80}
              />
            </label>

            <label>
              Mobile number
              <input
                name="phone"
                inputMode="numeric"
                autoComplete="tel"
                pattern="[0-9]{10}"
                minLength={10}
                maxLength={10}
                required
              />
            </label>

            <label className="field-wide">
              Address
              <input
                name="line1"
                autoComplete="street-address"
                required
                maxLength={200}
              />
            </label>

            <label>
              City
              <input
                name="city"
                autoComplete="address-level2"
                required
                maxLength={60}
              />
            </label>

            <label>
              State
              <input
                name="state"
                autoComplete="address-level1"
                required
                maxLength={40}
              />
            </label>

            <label>
              PIN code
              <input
                name="pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
            </label>
          </div>

          {err && (
            <p className="form-error" role="alert">
              {err}
            </p>
          )}

          <button
            className="button button-dark button-full"
            disabled={busy}
            type="submit"
          >
            {busy
              ? "Creating order…"
              : "Place order and continue to payment"}
          </button>

          <p className="muted small-copy">
            Prices and stock are checked again by the server when you place
            the order.
          </p>
        </form>

        <aside className="order-summary">
          <h2>Your order</h2>

          {cart.map((item) => (
            <div className="summary-line" key={item.sku}>
              <span>
                {item.name} × {item.qty}
              </span>
              <strong>
                ₹
                {(
                  Number(item.price_inr || 0) *
                  Number(item.qty || 0)
                ).toLocaleString("en-IN")}
              </strong>
            </div>
          ))}

          <div className="summary-line summary-total">
            <span>Estimated subtotal</span>
            <strong>
              ₹
              {subtotal.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
