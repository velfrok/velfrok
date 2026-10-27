
"use client";

import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { CartContext } from "@/context/CartContext";
import { supabaseBrowser } from "@/lib/supabase";

export default function Checkout() {
  const { cart, clear, subtotal, setQuantity, remove } =
    useContext(CartContext);

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

    // Capture form values before awaiting the authentication session.
    const form = Object.fromEntries(
      new FormData(event.currentTarget)
    );

    // Snapshot the current cart for this order request.
    const orderItems = cart.map((item) => ({
      sku: item.sku,
      qty: Number(item.qty),
    }));

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
          items: orderItems,
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
          "The payment session could not be created. Please contact support."
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
          Your bag<span>.</span>
        </h1>

        <div className="notice">
          Your bag is empty.{" "}
          <a href="/#shop">Browse products</a> to add items.
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
            disabled={busy || !cart.length}
            type="submit"
          >
            {busy
              ? "Creating order…"
              : "Place order and continue to payment"}
          </button>

          <p className="muted small-copy">
            Prices and stock are checked again by the server when
            you place your order.
          </p>
        </form>

        <aside className="order-summary">
          <h2>Your order</h2>

          <div className="checkout-items">
            {cart.map((item) => {
              const quantity = Number(item.qty || 1);
              const stockLimit = Math.min(
                10,
                Math.max(1, Number(item.stock || 1))
              );

              return (
                <article
                  className="checkout-item"
                  key={item.sku}
                >
                  <div className="checkout-item-info">
                    <strong>{item.name}</strong>
                    <p>
                      ₹
                      {Number(
                        item.price_inr || 0
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div
                    className="checkout-quantity"
                    aria-label={`Quantity controls for ${item.name}`}
                  >
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      disabled={busy || quantity <= 1}
                      onClick={() => {
                        setQuantity(item.sku, quantity - 1);
                        setErr("");
                      }}
                    >
                      −
                    </button>

                    <span aria-live="polite">{quantity}</span>

                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      disabled={busy || quantity >= stockLimit}
                      onClick={() => {
                        setQuantity(item.sku, quantity + 1);
                        setErr("");
                      }}
                    >
                      +
                    </button>
                  </div>

                  <strong className="checkout-item-total">
                    ₹
                    {(
                      Number(item.price_inr || 0) * quantity
                    ).toLocaleString("en-IN")}
                  </strong>

                  <button
                    className="text-button checkout-remove"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      remove(item.sku);
                      setErr("");
                    }}
                  >
                    Remove
                  </button>
                </article>
              );
            })}
          </div>

          <div className="summary-line summary-total">
            <span>Estimated subtotal</span>
            <strong>
              ₹
              {subtotal.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>

          <p className="muted small-copy">
            Change quantities or remove items before placing
            your order. Final prices and stock are verified
            by the server.
          </p>
        </aside>
      </div>

      <style jsx>{`
        .checkout-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin: 16px 0;
        }

        .checkout-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding-bottom: 14px;
          border-bottom: 1px solid #e5e5e5;
        }

        .checkout-item-info {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .checkout-item-info strong {
          display: block;
        }

        .checkout-item-info p {
          margin: 5px 0 0;
        }

        .checkout-quantity {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .checkout-quantity button {
          width: 34px;
          height: 34px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #fff;
          color: #111827;
          font-size: 21px;
          cursor: pointer;
        }

        .checkout-quantity button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .checkout-quantity span {
          min-width: 18px;
          text-align: center;
          font-weight: 600;
        }

        .checkout-item-total {
          grid-column: 1 / -1;
          text-align: right;
        }

        .checkout-remove {
          grid-column: 1 / -1;
          justify-self: start;
          color: #b42318;
        }

        @media (max-width: 480px) {
          .checkout-item {
            gap: 8px;
          }

          .checkout-quantity {
            gap: 7px;
          }

          .checkout-quantity button {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>
    </section>
  );
}
