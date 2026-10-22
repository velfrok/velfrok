import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Payment page polls this every 3s with its token. When YOU mark "paid"
// in the admin panel, the customer's page updates automatically.
export async function GET(req) {
  try {
    await rateLimit(`pstat:${clientIp(req)}`, 60, 60);
    const token = new URL(req.url).searchParams.get("token");
    if (!/^[0-9a-f-]{36}$/.test(token || "")) return Response.json({ error: "Bad token" }, { status: 400 });

    const { data: pi } = await supabaseAdmin().from("payment_intents")
      .select("status,amount_inr,expires_at,order_id").eq("token", token).maybeSingle();
    if (!pi) return Response.json({ status: "not_found" }, { status: 404 });

    if (pi.status === "opened" && new Date(pi.expires_at) < new Date()) {
      await supabaseAdmin().from("payment_intents").update({ status: "abandoned" }).eq("token", token);
      return Response.json({ status: "expired" }); // customer left => NEVER marked paid
    }
    return Response.json({ status: pi.status, amount: pi.amount_inr });
  } catch (e) { if (e instanceof Response) return e; return Response.json({ error: "err" }, { status: 500 }); }
}
