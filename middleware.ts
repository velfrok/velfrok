import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = (process.env.NEXT_PUBLIC_SITE_URL || "").split(",");

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // ── HIDE ADMIN PAGES: /admin/* requires a valid admin session cookie ──
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = req.cookies.get("sb-access-token")?.value;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    let isAdmin = false;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
        isAdmin = !!data;
      }
    }
    if (!isAdmin) return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // ── LOCK DOWN CORS: only your own origins may call APIs ──
  const res = NextResponse.next();
  const origin = req.headers.get("origin");
  if (pathname.startsWith("/api/")) {
    if (origin && !ALLOWED_ORIGINS.includes(origin) && !origin.includes(".vercel.app")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    res.headers.set("Access-Control-Allow-Origin", origin || ALLOWED_ORIGINS[0] || "*");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return res;
}
export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
