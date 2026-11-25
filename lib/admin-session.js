
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function log(stage) {
  console.info(`[admin-session] ${stage}`);
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

function applyCookies(response, cookies) {
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options);
  }

  return response;
}

function clearTemporaryCookies(response) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("admin-otp-session", "", options);
  response.cookies.set("admin-otp-refresh-session", "", options);

  return response;
}

export async function getAdminSession(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Supabase authentication is not configured.");
  }

  const pendingCookies = [];

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  function setCookies(response) {
    return applyCookies(response, pendingCookies);
  }

  async function clearCookies(response) {
    // Clear the standard Supabase SSR session using Supabase's
    // own cookie adapter. Do not guess cookie names or chunks.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      log("local_session_clear_failed");
    }

    applyCookies(response, pendingCookies);
    clearTemporaryCookies(response);

    return response;
  }

  log("checking_standard_supabase_session");

  let user = null;

  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error || !data?.user) {
      log("standard_session_missing_or_invalid");

      return {
        user: null,
        clearCookies,
      };
    }

    user = data.user;
    log("standard_session_valid");
  } catch {
    log("standard_session_check_failed");

    return {
      user: null,
      clearCookies,
    };
  }

  const adminClient = createAdminClient();

  const {
    data: admin,
    error: adminError,
  } = await adminClient
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

    return {
      user: null,
      clearCookies,
    };
  }

  log("admin_session_valid");

  return {
    user,
    session: null,
    setCookies,
    clearCookies,
  };
}

export function adminLoginRedirect(request) {
  return NextResponse.redirect(
    new URL("/admin/login", request.url)
  );
}
