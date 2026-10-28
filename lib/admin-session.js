
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

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

  response.cookies.set("admin-otp-refresh-session", "", {
    ...getCookieOptions(0),
    sameSite: "strict",
  });
}

function diagnostic(stage) {
  // Never log credentials, cookie values, or user identifiers.
  console.info(`[admin-session] ${stage}`);
}

function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    diagnostic("configuration_missing: Supabase URL or anon key");
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
 * Validate an admin session and refresh tokens if necessary.
 * Call only from server-side admin routes or middleware.
 */
export async function getAdminSession(request) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  diagnostic(
    `cookie_presence: access=${Boolean(accessToken)}, refresh=${Boolean(refreshToken)}`
  );

  if (!accessToken && !refreshToken) {
    diagnostic("session_missing: neither session cookie is present");
    return { user: null, response: null };
  }

  const authClient = createAuthClient();
  let session = null;
  let user = null;

  if (accessToken) {
    try {
      const { data, error } = await authClient.auth.getUser(accessToken);

      if (error) {
        diagnostic(
          `access_validation_failed: ${error.status || "unknown status"}`
        );
      } else if (data.user) {
        user = data.user;
        diagnostic("access_validation_succeeded");
      } else {
        diagnostic("access_validation_failed: no user returned");
      }
    } catch {
      diagnostic("access_validation_exception");
    }
  }

  if (!user && refreshToken) {
    try {
      const { data, error } = await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session || !data.user) {
        diagnostic(
          `refresh_failed: ${error?.status || "no session returned"}`
        );

        return {
          user: null,
          response: null,
          clearCookies: true,
        };
      }

      session = data.session;
      user = data.user;
      diagnostic("refresh_succeeded");
    } catch {
      diagnostic("refresh_exception");

      return {
        user: null,
        response: null,
        clearCookies: true,
      };
    }
  }

  if (!user) {
    diagnostic("authentication_failed: no valid user");

    return {
      user: null,
      response: null,
      clearCookies: true,
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    diagnostic("configuration_missing: admin authorization");
    throw new Error("Admin authorization is not configured.");
  }

  const adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let admin;
  let adminError;

  try {
    const result = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    admin = result.data;
    adminError = result.error;
  } catch {
    diagnostic("admin_lookup_exception");
    throw new Error("Admin authorization lookup failed.");
  }

  if (adminError) {
    diagnostic(
      `admin_lookup_failed: ${adminError.code || "unknown database error"}`
    );

    return {
      user: null,
      response: null,
      clearCookies: true,
    };
  }

  if (!admin) {
    diagnostic("admin_membership_missing");

    return {
      user: null,
      response: null,
      clearCookies: true,
    };
  }

  diagnostic("admin_session_valid");

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
  return NextResponse.redirect(
    new URL("/admin/login", request.url)
  );
}
