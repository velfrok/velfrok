
"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendRequest(url, body) {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Request failed. Please try again.");
    }

    return data;
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const data = await sendRequest("/api/admin/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      setStep("otp");
      setMessage(data.message || "Check your email for the verification code.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (busy || otp.length !== 6) return;

    setBusy(true);
    setMessage("");

    try {
      await sendRequest("/api/admin/verify-otp", {
        email: email.trim().toLowerCase(),
        otp,
      });

      window.location.replace("/admin");
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.heading}>VELFROK Admin</h1>

        <p style={styles.description}>
          {step === "login"
            ? "Sign in with your administrator account."
            : "Enter the six-digit code sent to your email."}
        </p>

        {step === "login" ? (
          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Admin email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
            />

            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
            />

            <button type="submit" disabled={busy} style={styles.button}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={styles.description}>
              Verification email: <strong>{email}</strong>
            </p>

            <label htmlFor="admin-otp">Six-digit verification code</label>
            <input
              id="admin-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              style={styles.input}
            />

            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              style={styles.button}
            >
              {busy ? "Verifying..." : "Verify and continue"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("login");
                setOtp("");
                setMessage("");
              }}
              style={styles.backButton}
            >
              Back to sign in
            </button>
          </form>
        )}

        {message && (
          <p role="status" style={styles.message}>
            {message}
          </p>
        )}

        <p style={styles.footer}>
          Restricted access for authorized administrators only.
        </p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "#f3f4f6",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 28,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },
  heading: {
    margin: "0 0 8px",
    color: "#111827",
  },
  description: {
    color: "#6b7280",
    marginBottom: 24,
    overflowWrap: "anywhere",
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    margin: "8px 0 18px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    width: "100%",
    padding: 13,
    border: "none",
    borderRadius: 8,
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  backButton: {
    width: "100%",
    padding: 13,
    marginTop: 10,
    border: "none",
    borderRadius: 8,
    background: "#e5e7eb",
    color: "#111827",
    fontSize: 16,
    cursor: "pointer",
  },
  message: {
    marginTop: 18,
    color: "#374151",
    overflowWrap: "anywhere",
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: "#9ca3af",
  },
};
