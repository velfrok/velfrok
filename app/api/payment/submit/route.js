import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { cleanUtr } from "@/lib/sanitize";

async function verifyCaptcha(tok) {
  const r = await fetch("https://api.hcaptcha.com/siteverify", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: process.env.HCAPTCHA_SECRET, response: tok || "" }),
  });
  return (await r.json()).success === true;
}

export async function POST(req) {
  try {
    const { user, error } = await requireUser(req); if (error) return error;
    await rateLimit(`utr:${clientIp(req)}`, 5, 300); // 5 tries / 5 min (blocks UTR spam)

    const { token, utr, captcha } = await req.json();
    if (!(await verifyCaptcha(captcha))) return Response.json({ error: "CAPTCHA failed" }, { status: 400 });

    const u = cleanUtr(utr);
    if (u.length < 6) return Response.json({ error: "Enter a valid UPI transaction ID (UTR)" }, { status: 400 });

    // token must belong to THIS user (IDOR-safe) and still be open
    const { data: pi } = await supabaseAdmin().from("payment_intents")
      .select("*").eq("token", token).eq("user_id", user.id).maybeSingle();
    if (!pi || pi.status !== "opened") return Response.json({ error: "Invalid or expired payment page" }, { status: 400 });

    // order moves to pending_verification — admin sees it with the UTR.
    // It is NOT "paid" until YOU verify it in the admin panel.
    await supabaseAdmin().from("payment_intents").update({ status: "utr_submitted", utr: u }).eq("token", token);
    await supabaseAdmin().from("orders").update({ payment_status: "pending_verification" }).eq("id", pi.order_id);

    return Response.json({ ok: true, message: "Payment submitted for verification" });
  } catch (e) { if (e instanceof Response) return e; return Response.json({ error: "Server error" }, { status: 500 }); }
}
