"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

export default function CustomerAccountNav() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (!error) {
        setSignedIn(Boolean(data.session));
      }

      setChecking(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(Boolean(session));
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    if (busy) return;

    setBusy(true);

    try {
      const { error } = await supabaseBrowser().auth.signOut();

      if (error) throw error;

      setSignedIn(false);
      router.replace("/");
      router.refresh();
    } catch {
      alert("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = {
    display: "inline-block",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 600,
    padding: "10px 18px",
    border: "1px solid #111827",
    borderRadius: "8px",
    fontSize: "14px",
    background: "#ffffff",
    cursor: "pointer",
  };

  return (
    <nav
      aria-label="Customer account navigation"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
      }}
    >
      {checking ? (
        <span>Checking account…</span>
      ) : signedIn ? (
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          style={buttonStyle}
        >
          {busy ? "Signing out…" : "Logout"}
        </button>
      ) : (
        <a href="/login" style={buttonStyle}>
          Sign in
        </a>
      )}
    </nav>
  );
}
