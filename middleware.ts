
import { NextResponse } from "next/server";
import {
  getAdminSession,
  adminLoginRedirect,
} from "@/lib/admin-session";

const ALLOWED_ORIGINS = (process.env.NEXT_PUBLIC_SITE_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;

  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname;

    return (
      hostname === "vercel.app" ||
      hostname.endsWith(".vercel.app")
    );
  } catch {
    return false;
  }
}

export async function middleware(req: Request & { nextUrl: URL }) {
  const pathname = req.nextUrl.pathname;
  const origin = req.headers.get("origin");

  if (pathname.startsWith("/api/")) {
    if (!isAllowedOrigin(origin)) {
      return new NextResponse("Forbidden", {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    if (req.method === "OPTIONS") {
      const preflight = new NextResponse(null, {
        status: 204,
      });

      if (origin) {
        preflight.headers.set(
          "Access-Control-Allow-Origin",
          origin
        );
        preflight.headers.set(
          "Access-Control-Allow-Credentials",
          "true"
        );
        preflight.headers.set("Vary", "Origin");
      }

      preflight.headers.set(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS"
      );

      preflight.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      preflight.headers.set(
        "Access-Control-Max-Age",
        "600"
      );

      return preflight;
    }
  }

  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    try {
      const result = await getAdminSession(req);

      if (!result.user) {
        const response = adminLoginRedirect(req);

        if (typeof result.clearCookies === "function") {
          await result.clearCookies(response);
        }

        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Pragma", "no-cache");

        return response;
      }

      const response = NextResponse.next();

      if (typeof result.setCookies === "function") {
        result.setCookies(response);
      }

      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Pragma", "no-cache");

      return response;
    } catch (error) {
      console.error(
        "Admin middleware authentication check failed:",
        error instanceof Error ? error.message : "Unknown error"
      );

      return NextResponse.json(
        {
          error:
            "Admin session verification is temporarily unavailable. Please retry.",
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }
  }

  const response = NextResponse.next();

  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");

    if (origin) {
      response.headers.set(
        "Access-Control-Allow-Origin",
        origin
      );
      response.headers.set(
        "Access-Control-Allow-Credentials",
        "true"
      );
      response.headers.set("Vary", "Origin");
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
