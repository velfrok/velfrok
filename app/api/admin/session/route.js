
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

export async function GET(request) {
  try {
    const result = await getAdminSession(request);

    if (!result.user) {
      const response = jsonResponse(
        {
          authenticated: false,
          message: "Admin session is missing or invalid.",
        },
        401
      );

      if (typeof result.clearCookies === "function") {
        await result.clearCookies(response);
      }

      return response;
    }

    const response = jsonResponse({
      authenticated: true,
      message: "Admin session is valid.",
    });

    if (typeof result.setCookies === "function") {
      result.setCookies(response);
    }

    return response;
  } catch (error) {
    console.error(
      "[admin-session-route] verification failed:",
      error?.message || "Unknown error"
    );

    return jsonResponse(
      {
        authenticated: false,
        message: "Session verification is temporarily unavailable.",
      },
      503
    );
  }
}
