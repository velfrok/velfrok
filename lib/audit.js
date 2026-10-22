import { supabaseAdmin } from "./supabase";
export async function auditLog(email, action, detail = {}, ip = "") {
  await supabaseAdmin().from("admin_audit_log")
    .insert({ admin_email: email, action, detail, ip });
}
