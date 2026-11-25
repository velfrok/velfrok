
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function rateLimit(key, limit = 10, windowSec = 60) {
  if (!URL || !TOKEN) {
    console.error("Upstash rate limit configuration is missing.");
    throw new Error("Rate limiting is not configured");
  }

  let response;

  try {
    response = await fetch(`${URL.replace(/\/+$/, "")}/pipeline`, {
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
  } catch (error) {
  console.error("Upstash request failed before HTTP response.", {
    name: error?.name,
    causeCode: error?.cause?.code,
  });

  throw new Error("Rate limit network request failed");
}

  if (!response.ok) {
    console.error(
      "Upstash rate limit request failed. HTTP status:",
      response.status
    );
    throw new Error("Rate limit service unavailable");
  }

  let results;

  try {
    results = await response.json();
  } catch {
    console.error("Upstash returned an invalid JSON response.");
    throw new Error("Invalid rate limit response");
  }

  const count = results?.[0]?.result;

  if (!Number.isInteger(count) || count < 1) {
    console.error("Upstash returned an invalid rate limit count.");
    throw new Error("Invalid rate limit response");
  }

  if (count > limit) {
    throw new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
      }),
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
