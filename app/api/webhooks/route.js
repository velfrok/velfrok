import crypto from "crypto";

// When you later add Razorpay/Cashfree, their webhook hits this route.
// Signature is verified BEFORE anything is trusted.
export async function POST(req) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET || "")
    .update(raw).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return Response.json({ error: "Bad signature" }, { status: 401 });

  const event = JSON.parse(raw);
  // mark paid by provider order id, e.g.:
  // await supabaseAdmin().from("orders").update({ payment_status: "paid" }).eq("order_code", event.payload.order_id)
  return Response.json({ ok: true });
}
