import { supabaseAdmin } from "./supabase";

// Verifies the user's JWT on EVERY protected API route. Never trust the frontend.
export async function requireUser(req) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export async function requireAdmin(req) {
  const r = await requireUser(req);
  if (r.error) return r;
  const { data } = await supabaseAdmin()
    .from("admins").select("user_id").eq("user_id", r.user.id).maybeSingle();
  if (!data) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user: r.user };
}
