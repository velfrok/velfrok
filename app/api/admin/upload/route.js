import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { auditLog } from "@/lib/audit";

const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 2 * 1024 * 1024; // 2MB

export async function POST(req) {
  const { user, error } = await requireAdmin(req); if (error) return error;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED[file.type]) return Response.json({ error: "Only JPG/PNG/WebP allowed" }, { status: 415 });
  if (file.size > MAX) return Response.json({ error: "Max 2MB" }, { status: 413 });

  // verify magic bytes too (extension can lie)
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpg = head[0] === 0xff && head[1] === 0xd8;
  const isPng = head[0] === 0x89 && head[1] === 0x50;
  const isWebp = head[8] === 0x57 && head[9] === 0x45;
  if (!(isJpg || isPng || isWebp)) return Response.json({ error: "File content is not an image" }, { status: 415 });

  const ext = ALLOWED[file.type];
  const path = `${crypto.randomUUID()}.${ext}`;
  await supabaseAdmin().storage.from("product-images").upload(path, file); // PRIVATE bucket
  const { data: { signedUrl } } = await supabaseAdmin().storage
    .from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365);
  await auditLog(user.email, "file.upload", { path });
  return Response.json({ url: signedUrl });
}
