import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { clean } from "@/lib/sanitize";

export async function GET(req) {
  const { user, error } = await requireAdmin(req); if (error) return error;
  const { data } = await supabaseAdmin().from("orders")
    .select("*, payment_intents(token,status,utr,expires_at)")
    .order("created_at", { ascending: false }).limit(200);
  return Response.json({ orders: data });
}

export async function PATCH(req) {
  const { user, error } = await requireAdmin(req); if (error) return error;
  await rateLimitSafe(user);
  const { orderId, paymentStatus, orderStatus } = await req.json();
  const id = clean(orderId, 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const patch = {};
  if (paymentStatus && ["paid", "failed"].includes(paymentStatus)) patch.payment_status = paymentStatus;
  if (orderStatus && ["placed","packed","dispatched","delivered","cancelled"].includes(orderStatus)) patch.status = orderStatus;
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to update" }, { status: 400 });

  const { error: upErr } = await supabaseAdmin().from("orders").update(patch).eq("id", id);
  if (upErr) return Response.json({ error: "Update failed" }, { status: 500 });

  // if paid -> flip the payment token so the customer's page auto-refreshes
  if (patch.payment_status === "paid") {
    await supabaseAdmin().from("payment_intents").update({ status: "paid" }).eq("order_id", id);
    // decrement stock atomically
    const { data: o } = await supabaseAdmin().from("orders").select("items").eq("id", id).single();
    for (const it of o.items) await supabaseAdmin().rpc("decrement_stock", { p_sku: it.sku, p_qty: it.qty });
  }
  await auditLog(user.email, "order.update", { id, ...patch });
  return Response.json({ ok: true });
}
