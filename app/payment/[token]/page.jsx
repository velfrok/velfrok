"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabaseBrowser } from "@/lib/supabase";

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "";
const UPI_NAME = process.env.NEXT_PUBLIC_UPI_NAME || "VELFROK";

export default function PaymentPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [status, setStatus] = useState("loading");
  const [amount, setAmount] = useState(null);
  const [utr, setUtr] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(1200);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`/api/payment/status?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await response.json();
        if (!alive) return;
        if (!response.ok) {
          setStatus(data.status || "error");
          setErr(data.error || "Unable to load payment details.");
          return;
        }
        setStatus(data.status);
        if (typeof data.amount === "number" && Number.isFinite(data.amount)) setAmount(data.amount);
        if (data.status === "paid") setMsg("Payment confirmed. Thank you!");
        if (data.status === "expired" || data.status === "abandoned") setErr("This payment link has expired. Please contact support.");
      } catch {
        if (alive) setErr("Connection problem while checking payment status.");
      }
    };
    poll();
    timer = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(timer); };
  }, [token]);

  useEffect(() => {
    if (status === "paid" || status === "expired" || status === "abandoned") return;
    const timer = setInterval(() => setSecs(old => Math.max(0, old - 1)), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const upiLink = UPI_ID && amount !== null
    ? `upi://pay?${new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, am: String(amount), cu: "INR", tn: `Velfrok ${token.slice(0, 8)}` }).toString()}`
    : "";

  async function submitUtr(event) {
    event.preventDefault();
    setErr("");
    setMsg("");
    setSubmitting(true);
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession();
      if (!session) {
        setErr("Please sign in with the account used to place this order.");
        setSubmitting(false);
        return;
      }
      const response = await fetch("/api/payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token, utr, captcha }),
      });
      const data = await response.json();
      if (!response.ok) setErr(data.error || "Payment reference could not be submitted.");
      else setMsg(data.message || "Payment reference submitted for verification.");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="payment-wrap">
      <div className="payment-card">
        <p className="eyebrow">SECURE PAYMENT</p>
        <h1>Complete your payment<span>.</span></h1>
        {amount === null ? <p className="payment-amount">Loading order total…</p> : <p className="payment-amount">₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>}
        {secs > 0 && !["paid", "expired", "abandoned"].includes(status)
          ? <p className="muted">Time remaining: {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</p>
          : status !== "paid" && <p className="form-error">This payment session may have expired. Refresh status before paying.</p>}
        {upiLink && <a className="button button-dark button-full" href={upiLink}>Open UPI app to pay</a>}
        {upiLink && <img className="payment-qr" src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}`} alt="UPI payment QR code" width="240" height="240" />}
        {UPI_ID && <p className="muted">UPI ID: <strong>{UPI_ID}</strong></p>}
        <p className="muted small-copy">Payment reference: {token.slice(0, 8).toUpperCase()}</p>
        {status === "utr_submitted" && <p className="notice">Your payment reference was received and is awaiting verification.</p>}
        {status === "paid" && <p className="notice success-notice">{msg || "Payment confirmed."}</p>}
        {status === "opened" && (
          <form className="utr-form" onSubmit={submitUtr}>
            <label>UPI transaction reference (UTR)<input value={utr} onChange={e => setUtr(e.target.value)} required minLength="6" maxLength="40" autoComplete="off" /></label>
            <HCaptcha sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || ""} onVerify={setCaptcha} onExpire={() => setCaptcha("")} />
            <button className="button button-dark button-full" type="submit" disabled={!captcha || !utr.trim() || submitting}>{submitting ? "Submitting…" : "Submit payment reference"}</button>
          </form>
        )}
        {msg && status !== "paid" && <p className="notice">{msg}</p>}
        {err && <p className="form-error" role="alert">{err}</p>}
        {!UPI_ID && <p className="form-error">Payment configuration is incomplete. Please contact the store administrator.</p>}
      </div>
    </section>
  );
}
