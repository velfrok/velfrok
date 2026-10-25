import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    303
  );

  response.cookies.set("sb-access-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("admin-otp-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}
