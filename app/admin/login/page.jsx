
"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      setStep("otp");
      setMessage(data.message || "Check your email for the verification code.");
    } catch (error) {
      setMessage(error.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      window.location.assign("/admin");
    } catch (error) {
      setMessage(error.message || "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "#f3f4f6",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 28,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 8px", color: "#111827" }}>
          VELFROK Admin
        </h1>

        <p style={{ color: "#6b7280", marginBottom: 24 }}>
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
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button type="submit" disabled={busy} style={buttonStyle}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ color: "#374151", overflowWrap: "anywhere" }}>
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
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              style={inputStyle}
            />

            <button type="submit" disabled={busy || otp.length !== 6} style={buttonStyle}>
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
              style={{
                ...buttonStyle,
                background: "#e5e7eb",
                color: "#111827",
                marginTop: 10,
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {message && (
          <p
            role="status"
            style={{
              marginTop: 18,
              color: "#374151",
              overflowWrap: "anywhere",
            }}
          >
            {message}
          </p>
        )}

        <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af" }}>
          Restricted access for authorized administrators only.
        </p>
      </section>
    </main>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  margin: "8px 0 18px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 16,
};

const buttonStyle = {
  width: "100%",
  padding: 13,
  border: "none",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};
            
