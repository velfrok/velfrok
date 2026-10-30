
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    303
  );

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );
  response.headers.set("Pragma", "no-cache");

  const permanentCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  const temporaryCookieOptions = {
    ...permanentCookieOptions,
    sameSite: "strict",
  };

  response.cookies.set(
    "sb-access-token",
    "",
    permanentCookieOptions
  );

  response.cookies.set(
    "sb-refresh-token",
    "",
    permanentCookieOptions
  );

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

  console.info("[admin-logout] session cookies cleared");

  return response;
}
