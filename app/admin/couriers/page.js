"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e3e8f0",
  borderRadius: 12,
  padding: 20,
  marginTop: 20,
};

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const btnPrimary = {
  padding: "10px 20px",
  background: "#172033",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const btnDanger = {
  padding: "6px 14px",
  background: "#fff",
  color: "#b42318",
  border: "1px solid #fda29b",
  borderRadius: 7,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const btnSecondary = {
  padding: "6px 14px",
  background: "#fff",
  color: "#344054",
  border: "1px solid #d0d5dd",
  borderRadius: 7,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
  marginRight: 6,
};

export default function CouriersPage() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/couriers", { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load couriers.");
      setCouriers(json.couriers || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg, isError = false) {
    if (isError) { setError(msg); setNotice(""); }
    else { setNotice(msg); setError(""); }
  }

  async function addCourier(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/couriers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add courier.");
      flash("Courier company added.");
      setNewName("");
      await load();
    } catch (e) {
      flash(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id) {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/couriers", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update courier.");
      flash("Courier updated.");
      setEditId(null);
      await load();
    } catch (e) {
      flash(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function removeCourier(id, name) {
    if (!window.confirm(`Remove "${name}" from the courier list?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/couriers?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not remove courier.");
      flash(`"${name}" removed.`);
      await load();
    } catch (e) {
      flash(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#f5f7fb", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <Link href="/admin" style={{ color: "#e87528", fontWeight: 700 }}>
        ← Back to Admin Dashboard
      </Link>

      <h1 style={{ marginTop: 24 }}>Courier Companies</h1>
      <p style={{ color: "#475467", lineHeight: 1.6 }}>
        Manage the courier companies available when dispatching orders.
        These appear in the courier dropdown on the Orders page.
      </p>

      {/* Built-in couriers notice */}
      <div style={{
        background: "#eff8ff",
        border: "1px solid #b2ddff",
        borderRadius: 10,
        padding: "12px 16px",
        marginTop: 16,
        fontSize: 13,
        color: "#0057b8",
        lineHeight: 1.6,
      }}>
        <strong>🔒 Built-in couriers (always available):</strong>{" "}
        Valmo · Blue Dart · Ecom Express · SWA · ElasticRun.
        These 5 are always shown in the dispatch dropdown even without a database table.
        You can add more below.
      </div>

      {error && (
        <p role="alert" style={{ color: "#b42318", background: "#fef3f2", padding: 12, borderRadius: 8, marginTop: 12 }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ color: "#067647", background: "#ecfdf3", padding: 12, borderRadius: 8, marginTop: 12 }}>
          {notice}
        </p>
      )}

      {/* Add new courier */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, marginBottom: 14 }}>Add Courier Company</h2>
        <form onSubmit={addCourier} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            style={{ ...inputStyle, flex: "1 1 220px" }}
            placeholder="e.g. Delhivery, DTDC, FedEx…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            disabled={busy}
            required
          />
          <button type="submit" style={btnPrimary} disabled={busy || !newName.trim()}>
            {busy ? "Adding…" : "+ Add"}
          </button>
        </form>
      </div>

      {/* Courier list */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Active Couriers ({couriers.length})</h2>
          <button style={btnSecondary} onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {loading && <p style={{ color: "#68738a" }}>Loading…</p>}

        {!loading && couriers.length === 0 && (
          <p style={{ color: "#68738a" }}>No courier companies found. Add one above.</p>
        )}

        {!loading && couriers.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {couriers.map((c) => (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 0",
                  borderBottom: "1px solid #f2f4f7",
                  flexWrap: "wrap",
                }}
              >
                {editId === c.id ? (
                  <>
                    <input
                      style={{ ...inputStyle, flex: "1 1 180px" }}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={80}
                      disabled={busy}
                      autoFocus
                    />
                    <button style={btnPrimary} onClick={() => saveEdit(c.id)} disabled={busy || !editName.trim()}>
                      Save
                    </button>
                    <button style={btnSecondary} onClick={() => setEditId(null)} disabled={busy}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                    <span style={{ color: "#98a2b3", fontSize: 12 }}>{c.id}</span>
                    <button
                      style={btnSecondary}
                      onClick={() => { setEditId(c.id); setEditName(c.name); }}
                      disabled={busy}
                    >
                      Rename
                    </button>
                    <button style={btnDanger} onClick={() => removeCourier(c.id, c.name)} disabled={busy}>
                      Remove
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
