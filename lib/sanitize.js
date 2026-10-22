export const clean = (s, max = 500) =>
  String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

export const cleanPhone = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 15);
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const isUpiId = (s) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(s);
export const cleanUtr = (s) => String(s ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 30).toUpperCase();
