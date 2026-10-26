
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function rateLimit(key, limit = 10, windowSec = 60) {
  if (!URL || !TOKEN) {
    throw new Error("Rate limiting is not configured");
  }

  const response = await fetch(`${URL.replace(/\/+$/, "")}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", `velfrok-preview:rl:${key}`],
      ["EXPIRE", `velfrok-preview:rl:${key}`, windowSec, "NX"],
    ]),
    cache: "no-store",
  });

    if (!response.ok) {
    console.error(
      "Upstash rate limit request failed. HTTP status:",
      response.status
    );
    throw new Error("Rate limit service unavailable");
  }

  const results = await response.json();
  const count = results?.[0]?.result;

  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Invalid rate limit response");
  }

  if (count > limit) {
    throw new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return count;
}

export function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
