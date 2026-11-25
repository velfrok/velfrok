
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-session";
import { auditLog } from "@/lib/audit";
import { clean } from "@/lib/sanitize";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Default courier companies seeded in memory if DB table is unavailable.
const DEFAULT_COURIERS = [
  { id: "valmo",       name: "Valmo" },
  { id: "bluedart",   name: "Blue Dart" },
  { id: "ecom",       name: "Ecom Express" },
  { id: "swa",        name: "SWA" },
  { id: "elasticrun", name: "ElasticRun" },
];

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function applySession(response, auth) {
  if (auth?.clearCookies) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };
    response.cookies.set("sb-access-token", "", options);
    response.cookies.set("sb-refresh-token", "", options);
    response.cookies.set("admin-otp-session", "", { ...options, sameSite: "strict" });
    response.cookies.set("admin-otp-refresh-session", "", { ...options, sameSite: "strict" });
  } else if (auth?.setCookies) {
    return auth.setCookies(response);
  }
  return response;
}

function reply(auth, body, status = 200) {
  return applySession(NextResponse.json(body, { status }), auth);
}

async function checkAdmin(request) {
  let session;
  try {
    session = await getAdminSession(request);
  } catch {
    return { error: fail("Unable to verify administrator access.", 503) };
  }
  if (!session.user) {
    return { error: applySession(fail("Your session is invalid. Please sign in again.", 401), session) };
  }
  return { user: session.user, session, client: supabaseAdmin() };
}

/** GET /api/admin/couriers — list all active courier companies */
export async function GET(request) {
  let auth;
  try {
    auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    // Try fetching from DB table.
    const { data, error } = await auth.client
      .from("courier_companies")
      .select("id, name, active")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      // Table may not exist yet — return only defaults.
      return reply(auth.session, { couriers: DEFAULT_COURIERS });
    }

    // Always merge: DEFAULT_COURIERS are always present.
    // If the DB already has an entry with the same id, the DB version wins
    // (so admins can rename them). Extra DB entries are appended after defaults.
    const dbMap = new Map((data || []).map((c) => [c.id, c]));

    const merged = [
      // Built-in defaults first (use DB version if it exists so renames are saved)
      ...DEFAULT_COURIERS.map((d) => dbMap.get(d.id) || d),
      // Any extra couriers added by the admin that aren't in the defaults
      ...(data || []).filter((c) => !DEFAULT_COURIERS.some((d) => d.id === c.id)),
    ];

    return reply(auth.session, { couriers: merged });
  } catch {
    return reply(auth?.session, { couriers: DEFAULT_COURIERS });
  }
}

/** POST /api/admin/couriers — add a new courier company */
export async function POST(request) {
  let auth;
  try {
    auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    try {
      await rateLimit(`admin-couriers:${auth.user.id}:${clientIp(request)}`, 20, 60);
    } catch {
      return reply(auth.session, { error: "Too many requests." }, 429);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(auth.session, { error: "Invalid request data." }, 400);
    }

    const name = clean(String(body?.name || ""), 80).trim();
    if (!name || name.length < 2) {
      return reply(auth.session, { error: "Courier name must be at least 2 characters." }, 400);
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const { data, error } = await auth.client
      .from("courier_companies")
      .upsert({ id, name, active: true }, { onConflict: "id" })
      .select("id, name, active")
      .maybeSingle();

    if (error) {
      console.error("Courier insert failed:", error.message);
      return reply(auth.session, { error: "Could not add courier company." }, 500);
    }

    await auditLog(auth.user.email, "courier.add", { id, name });
    return reply(auth.session, { courier: data }, 201);
  } catch {
    return reply(auth?.session, { error: "Could not add courier company." }, 500);
  }
}

/** PATCH /api/admin/couriers — rename or deactivate a courier */
export async function PATCH(request) {
  let auth;
  try {
    auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(auth.session, { error: "Invalid request data." }, 400);
    }

    const id = clean(String(body?.id || ""), 80).trim();
    if (!id) return reply(auth.session, { error: "Missing courier ID." }, 400);

    const updates = {};
    if (typeof body.name === "string") {
      const name = clean(body.name, 80).trim();
      if (name.length < 2) return reply(auth.session, { error: "Name too short." }, 400);
      updates.name = name;
    }
    if (typeof body.active === "boolean") {
      updates.active = body.active;
    }
    if (!Object.keys(updates).length) {
      return reply(auth.session, { error: "Nothing to update." }, 400);
    }

    const { error } = await auth.client
      .from("courier_companies")
      .update(updates)
      .eq("id", id);

    if (error) {
      return reply(auth.session, { error: "Could not update courier company." }, 500);
    }

    await auditLog(auth.user.email, "courier.update", { id, ...updates });
    return reply(auth.session, { ok: true });
  } catch {
    return reply(auth?.session, { error: "Could not update courier company." }, 500);
  }
}

/** DELETE /api/admin/couriers?id=xxx — soft-delete (deactivate) a courier */
export async function DELETE(request) {
  let auth;
  try {
    auth = await checkAdmin(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const id = clean(url.searchParams.get("id") || "", 80).trim();
    if (!id) return reply(auth.session, { error: "Missing courier ID." }, 400);

    const { error } = await auth.client
      .from("courier_companies")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      return reply(auth.session, { error: "Could not remove courier company." }, 500);
    }

    await auditLog(auth.user.email, "courier.delete", { id });
    return reply(auth.session, { ok: true });
  } catch {
    return reply(auth?.session, { error: "Could not remove courier company." }, 500);
  }
}
