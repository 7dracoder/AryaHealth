import { ensureDatabase, getD1 } from "@/db/runtime";
import { sha256 } from "./crypto";

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super("Rate limit exceeded");
    this.retryAfter = retryAfter;
  }
}

export async function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  await ensureDatabase();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "local";
  const key = await sha256(`${bucket}|${ip.split(",")[0]?.trim()}`);
  const now = Math.floor(Date.now() / 1000);
  const resetBefore = now - windowSeconds;
  const db = getD1();

  await db
    .prepare(`INSERT INTO rate_limits (key, count, window_started_at)
      VALUES (?1, 1, ?2)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN window_started_at <= ?3 THEN 1 ELSE count + 1 END,
        window_started_at = CASE WHEN window_started_at <= ?3 THEN ?2 ELSE window_started_at END`)
    .bind(key, now, resetBefore)
    .run();

  const row = await db
    .prepare("SELECT count, window_started_at FROM rate_limits WHERE key = ?1")
    .bind(key)
    .first<{ count: number; window_started_at: number }>();

  if (row && row.count > limit) {
    throw new RateLimitError(Math.max(1, row.window_started_at + windowSeconds - now));
  }
}

export function rateLimitResponse(error: RateLimitError): Response {
  return Response.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "retry-after": String(error.retryAfter) } },
  );
}
