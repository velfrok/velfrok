
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient = null;

// Browser client: reuse one client and persist customer sessions.
export const supabaseBrowser = () => {
  // Server-side product queries must not use browser session storage.
  if (typeof window === "undefined") {
    return createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  if (!browserClient) {
    browserClient = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "velfrok-customer-auth",
      },
    });
  }

  return browserClient;
};

// Server-only admin client. Never import into client components.
export const supabaseAdmin = () =>
  createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
