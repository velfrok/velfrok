"use client";
import { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { CartContext } from "@/context/CartContext";
import HCaptcha from "@hcaptcha/react-hcaptcha"; // npm i @hcaptcha/react-hcaptcha (in package.json)

export default function Checkout() {
  const { cart, clear } = useContext(CartContext);
  const router = useRouter();
  const [step, setStep] = useState("address"); // address -> creating -> payment
  const [err, setErr] = useState(""); const [ok, setOk] = useState("");

  async function placeOrder(e) {
    e.preventDefault(); setErr(""); setOk("Placing your order…");
    const form = Object.fromEntries(new FormData(e.target));
    const { data: { session } } = await (await import("@/lib/supabase")).supabaseBrowser().auth.getSession();
    if (!session) return setErr("Please login with your mobile number first.");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...form, items: cart, coupon: sessionStorage.getItem("coupon") }),
    });
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Something went wrong");
    setOk("Order created! Opening payment…");
    clear();
    router.push(`/payment/${json.token}`); // 👉 unique payment page for THIS order
  }
  // …render address form with inline error messages (err) and success (ok)…
}
