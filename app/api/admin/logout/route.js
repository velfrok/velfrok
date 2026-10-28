
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    303
  );

  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("sb-access-token", "", {
    ...baseOptions,
    sameSite: "lax",
  });

  response.cookies.set("sb-refresh-token", "", {
    ...baseOptions,
    sameSite: "lax",
  });

  response.cookies.set("admin-otp-session", "", {
    ...baseOptions,
    sameSite: "strict",
  });

  response.cookies.set("admin-otp-refresh-session", "", {
    ...baseOptions,
    sameSite: "strict",
  });

  return response;
}
