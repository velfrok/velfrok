import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

function clearAdminCookies(response) {
  response.cookies.set(ACCESS_COOKIE, "", getCookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", getCookieOptions(0));
  response.cookies.set("admin-otp-session", "", {
    ...getCookieOptions(0),
    sameSite: "strict",
  });
}

function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Supabase authentication is not configured.");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Validate an admin access token and refresh it if necessary.
 * Call only from server-side admin routes or middleware.
 */
export async function getAdminSession(request) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return { user: null, response: null };
  }

  const authClient = createAuthClient();
  let session = null;
  let user = null;

  if (accessToken) {
    const result = await authClient.auth.getUser(accessToken);

    if (!result.error && result.data.user) {
      user = result.data.user;
    }
  }

  if (!user && refreshToken) {
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      return {
        user: null,
        response: null,
        clearCookies: true,
      };
    }

    session = data.session;
    user = data.user;
  }

  if (!user) {
    return {
      user: null,
      response: null,
      clearCookies: true,
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Admin authorization is not configured.");
  }

  const adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: admin, error: adminError } = await adminClient
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return {
      user: null,
      response: null,
      clearCookies: true,
    };
  }

  return {
    user,
    session,
    setCookies(response) {
      if (session) {
        response.cookies.set(
          ACCESS_COOKIE,
          session.access_token,
          getCookieOptions(SESSION_MAX_AGE)
        );

        response.cookies.set(
          REFRESH_COOKIE,
          session.refresh_token,
          getCookieOptions(SESSION_MAX_AGE)
        );
      }

      return response;
    },
    clearCookies(response) {
      clearAdminCookies(response);
      return response;
    },
  };
}

export function adminLoginRedirect(request) {
  return NextResponse.redirect(new URL("/admin/login", request.url));
}
