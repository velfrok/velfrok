const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function rateLimit(key, limit = 10, windowSec = 60) {
  const r = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "text/plain" },
    body: JSON.stringify([
      ["INCR", `rl:${key}`],
      ["EXPIRE", `rl:${key}`, windowSec, "NX"],
    ]),
  });
  const [count] = await r.json();
  if (count > limit) throw new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  return count;
}
export const clientIp = (req) =>
  req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
