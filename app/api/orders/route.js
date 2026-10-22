import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { clean, cleanPhone, cleanUtr } from "@/lib/sanitize";
import { newPaymentToken } from "@/lib/payment-token";

export async function POST(req) {
  try {
    const { user, error } = await requireUser(req); if (error) return error;
    await rateLimit(`order:${user.id}`, 5, 600); // max 5 orders / 10 min

    const body = await req.json();
    const items = (body.items || []).map(i => ({
      sku: clean(i.sku, 40), qty: Math.max(1, Math.min(10, Number(i.qty) || 1)),
    }));
    if (!items.length) return Response.json({ error: "Cart empty" }, { status: 400 });

    const address = {
      name: clean(body.name, 80), phone: cleanPhone(body.phone),
      line1: clean(body.line1, 200), city: clean(body.city, 60),
      pincode: clean(body.pincode, 6), state: clean(body.state, 40),
    };
    if (!address.name || address.phone.length !== 10 || !/^\d{6}$/.test(address.pincode))
      return Response.json({ error: "Invalid address" }, { status: 400 });

    const db = supabaseAdmin();
    // prices ALWAYS recomputed server-side from DB — never trust frontend prices
    const { data: prods } = await db.from("products")
      .select("sku,name,price_inr,stock").in("sku", items.map(i => i.sku)).eq("is_active", true);
    if (!prods?.length) return Response.json({ error: "Products unavailable" }, { status: 400 });

    let subtotal = 0; const lineItems = [];
    for (const it of items) {
      const p = prods.find(x => x.sku === it.sku);
      if (!p || p.stock < it.qty) return Response.json({ error: `${it.sku} out of stock` }, { status: 409 });
      subtotal += p.price_inr * it.qty;
      lineItems.push({ sku: p.sku, name: p.name, price: p.price_inr, qty: it.qty });
    }

    // coupon applied server-side only
    let discount = 0; let couponCode = null;
    if (body.coupon) {
      const code = clean(body.coupon, 20).toUpperCase();
      const { data: c } = await db.from("coupons").select("*").eq("code", code).eq("is_active", true)
        .gte("expires_at", new Date().toISOString()).maybeSingle();
      if (c) { discount = Math.round(subtotal * c.discount_pct / 100); couponCode = code; }
    }

    const orderCode = `VFK-${Date.now().toString(36).toUpperCase()}`;
    const { data: order } = await db.from("orders").insert({
      order_code: orderCode, user_id: user.id, items: lineItems,
      subtotal_inr: subtotal, discount_inr: discount,
      total_inr: subtotal - discount, coupon_code: couponCode, shipping_address: address,
    }).select().single();

    // 🔑 UNIQUE TOKEN for this payment page
    const token = newPaymentToken();
    await db.from("payment_intents").insert({
      token, order_id: order.id, user_id: user.id, amount_inr: order.total_inr,
    });

    return Response.json({ ok: true, orderCode: order.order_code, token });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json({ error: "Server error" }, { status: 500 }); // debug OFF in prod
  }
}

export async function GET(req) {
  const { user, error } = await requireUser(req); if (error) return error;
  const { data } = await supabaseAdmin().from("orders")
    .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  return Response.json({ orders: data });
}
