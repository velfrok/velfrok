
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

export default function CustomerLoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);

    try {
      const supabase = supabaseBrowser();

      if (mode === "signup") {
        const { data, error: authError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (authError) throw authError;

        if (data.session) {
          setMessage("Account created successfully.");
          router.push("/");
          router.refresh();
        } else {
          setMessage(
            "Account request submitted. Check your email for a verification link, then sign in."
          );
        }
      } else {
        const { error: authError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (authError) throw authError;

        setMessage("Signed in successfully.");
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="simple-page">
      <p className="eyebrow">VELFROK CUSTOMER ACCOUNT</p>

      <h1>
        {mode === "login" ? "Welcome back" : "Create your account"}
        <span>.</span>
      </h1>

      <p className="muted">
        Sign in or create an account to continue shopping.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "440px",
          margin: "28px auto",
          padding: "24px",
          border: "1px solid #e5e5e5",
          borderRadius: "12px",
          display: "grid",
          gap: "16px",
        }}
      >
        <label style={{ display: "grid", gap: "8px" }}>
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </label>

        <label style={{ display: "grid", gap: "8px" }}>
          Password
          <input
            type="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            maxLength={128}
            placeholder="At least 6 characters"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#176b38" }}>
            {message}
          </p>
        )}

        <button
          className="button button-dark button-full"
          type="submit"
          disabled={busy}
        >
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <p style={{ textAlign: "center", margin: 0 }}>
          {mode === "login"
            ? "New to VELFROK?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
            style={{
              border: "none",
              background: "none",
              textDecoration: "underline",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>

      <p
        className="muted small-copy"
        style={{ maxWidth: "440px", margin: "0 auto" }}
      >
        This version uses email authentication. Your mobile number is not
        verified by this page. Phone OTP verification can be added when an
        SMS provider is configured.
      </p>
    </section>
  );
}
