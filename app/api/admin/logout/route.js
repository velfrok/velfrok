
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 }
    );
  }

  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    303
  );

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );
  response.headers.set("Pragma", "no-cache");

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error) {
    console.error("[admin-logout] Supabase sign-out failed.");
  }

  const temporaryCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  response.cookies.set(
    "admin-otp-session",
    "",
    temporaryCookieOptions
  );

  response.cookies.set(
    "admin-otp-refresh-session",
    "",
    temporaryCookieOptions
  );

  console.info("[admin-logout] standard Supabase session cleared");

  return response;
}
