
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = (process.env.NEXT_PUBLIC_SITE_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    const loginUrl = new URL("/admin/login", req.url);
    const token = req.cookies.get("sb-access-token")?.value;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Fail closed if configuration or session is missing.
    if (!token || !supabaseUrl || !serviceKey) {
      return NextResponse.redirect(loginUrl);
    }

    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.redirect(loginUrl);
      }

      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !admin) {
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      console.error("Admin middleware authentication check failed.");
      return NextResponse.redirect(loginUrl);
    }
  }

  const res = NextResponse.next();
  const origin = req.headers.get("origin");

  if (pathname.startsWith("/api/")) {
    if (
      origin &&
      !ALLOWED_ORIGINS.includes(origin) &&
      !origin.includes(".vercel.app")
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    res.headers.set(
      "Access-Control-Allow-Origin",
      origin || ALLOWED_ORIGINS[0] || "*"
    );
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS"
    );
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
