"use client";
import { useEffect, useState, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID;
const NAME = process.env.NEXT_PUBLIC_UPI_NAME;

export default function PaymentPage({ params }) {
  const [status, setStatus] = useState("loading");
  const [utr, setUtr] = useState(""); const [captcha, setCaptcha] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [secs, setSecs] = useState(1200);
  const token = params.token;

  // 🔁 Polls the server every 3s — when you mark "paid" in admin, this auto-flips
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch(`/api/payment/status?token=${token}`);
      const j = await r.json();
      setStatus(j.status);
      if (j.status === "paid") { setMsg("Payment confirmed! ✅"); clearInterval(t); }
      if (j.status === "expired") clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [token]);

  const upiLink = `upi://pay?pa=${UPI_ID}&pn=${NAME}&am=${amount}&cu=INR&tn=Velfrok ${token.slice(0,8)}`;

  async function submitUtr() {
    setErr("");
    const { data: { session } } = await (await import("@/lib/supabase")).supabaseBrowser().auth.getSession();
    const res = await fetch("/api/payment/submit", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token, utr, captcha }),
    });
    const j = await res.json();
    res.ok ? setMsg(j.message) : setErr(j.error);
  }

  return (
    <main className="pay">
      <h1>Pay ₹{amount}</h1>
      {secs > 0 && status !== "paid" ? <p>⏱ This payment page expires in {Math.floor(secs/60)}:{secs%60}</p>
        : <p className="err">Expired — please place the order again.</p>}
      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`}
           alt="UPI QR code" width={220} height={220} />
      <p>Or pay to UPI ID: <strong>{UPI_ID}</strong></p>
      <p className="note">Reference code: <strong>{token.slice(0, 8).toUpperCase()}</strong> — mention nothing; we match automatically.</p>

      {status === "utr_submitted" && <div className="ok">✅ Received! Verifying shortly…</div>}
      {status === "paid" && <div className="ok big">🎉 Payment confirmed — your order is being packed!</div>}

      {status === "opened" && (
        <form onSubmit={e => { e.preventDefault(); submitUtr(); }}>
          <input value={utr} onChange={e => setUtr(e.target.value)}
            placeholder="Enter UPI Transaction ID (UTR)" required />
          
          <I have paid — Submit UTR</button>
        </form>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  );
}
