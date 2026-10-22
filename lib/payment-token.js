import { randomUUID } from "crypto";
export const newPaymentToken = () => randomUUID();
export const isExpired = (row) => new Date(row.expires_at) < new Date();
