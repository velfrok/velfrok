
import { NextResponse } from "next/server";
import {
  getAdminSession,
  adminLoginRedirect,
} from "@/lib/admin-session";

const ALLOWED_ORIGINS = (process.env.NEXT_PUBLIC_SITE_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function clearSessionCookies(response) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("sb-access-token", "", options);
  response.cookies.set("sb-refresh-token", "", options);
  response.cookies.set("admin-otp-session", "", {
    ...options,
    sameSite: "strict",
  });
  response.cookies.set("admin-otp-refresh-session", "", {
    ...options,
    sameSite: "strict",
  });

  return response;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  let response;

  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    try {
      const result = await getAdminSession(req);

      if (!result.user) {
        response = adminLoginRedirect(req);

        if (result.clearCookies) {
          clearSessionCookies(response);
        }

        return response;
      }

      response = NextResponse.next();

      // If the access token was refreshed, save the rotated tokens.
      response = result.setCookies(response);

    } catch {
      console.error("Admin middleware authentication check failed.");
      return adminLoginRedirect(req);
    }
  } else {
    response = NextResponse.next();
  }

  const origin = req.headers.get("origin");

  if (pathname.startsWith("/api/")) {
    if (
      origin &&
      !ALLOWED_ORIGINS.includes(origin) &&
      !origin.includes(".vercel.app")
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    response.headers.set(
      "Access-Control-Allow-Origin",
      origin || ALLOWED_ORIGINS[0] || "*"
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
