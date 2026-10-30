
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function cookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

function log(stage) {
  console.info(`[admin-session] ${stage}`);
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

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Admin authorization is not configured.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function clearAdminCookies(response) {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
  response.cookies.set("admin-otp-session", "", {
    ...cookieOptions(0),
    sameSite: "strict",
  });
  response.cookies.set("admin-otp-refresh-session", "", {
    ...cookieOptions(0),
    sameSite: "strict",
  });

  return response;
}

export async function getAdminSession(request) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value || null;

  log(
    `cookie_presence: access=${Boolean(accessToken)}, refresh=${Boolean(refreshToken)}`
  );

  if (!accessToken && !refreshToken) {
    log("session_missing");
    return { user: null, clearCookies: false };
  }

  const authClient = createAuthClient();
  let user = null;
  let refreshedSession = null;

  if (accessToken) {
    try {
      const { data, error } = await authClient.auth.getUser(accessToken);

      if (!error && data?.user) {
        user = data.user;
        log("access_token_valid");
      } else {
        log("access_token_invalid_or_expired");
      }
    } catch {
      log("access_token_validation_error");
    }
  }

  if (!user && refreshToken) {
    try {
      const { data, error } = await authClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data?.session || !data?.user) {
        log("refresh_failed");
        return { user: null, clearCookies: true };
      }

      user = data.user;
      refreshedSession = data.session;
      log("refresh_succeeded");
    } catch {
      log("refresh_error");
      return { user: null, clearCookies: true };
    }
  }

  if (!user) {
    log("no_valid_user");
    return { user: null, clearCookies: true };
  }

  const adminClient = createAdminClient();

  const { data: admin, error: adminError } = await adminClient
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    log("admin_membership_lookup_failed");
    throw new Error("Could not verify administrator access.");
  }

  if (!admin) {
    log("admin_membership_missing");
    return { user: null, clearCookies: true };
  }

  log("admin_session_valid");

  return {
    user,
    session: refreshedSession,

    setCookies(response) {
      if (refreshedSession) {
        response.cookies.set(
          ACCESS_COOKIE,
          refreshedSession.access_token,
          cookieOptions()
        );

        response.cookies.set(
          REFRESH_COOKIE,
          refreshedSession.refresh_token,
          cookieOptions()
        );
      }

      return response;
    },

    clearCookies(response) {
      return clearAdminCookies(response);
    },
  };
}

export function adminLoginRedirect(request) {
  return NextResponse.redirect(
    new URL("/admin/login", request.url)
  );
}
