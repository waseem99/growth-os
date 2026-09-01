import { getDatabase } from "@growth-os/db";

export type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, string | number | boolean | null | undefined>;

export function correlationId(request?: Request) {
  const incoming = request?.headers.get("x-request-id")?.trim();
  return incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
}

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function logEvent(level: LogLevel, event: string, context: LogContext = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "growthos-web",
    level,
    event,
    ...context
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export async function reportError(event: string, error: unknown, context: LogContext = {}) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR";
  logEvent("error", event, { ...context, error: message });
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "growthos-web", event, error: message, ...context }),
      signal: AbortSignal.timeout(3_000)
    });
  } catch {
    logEvent("warn", "error_alert_delivery_failed", { originalEvent: event, correlationId: context.correlationId });
  }
}

export async function checkRateLimit(input: { namespace: string; key: string; limit: number; windowSeconds: number }) {
  const now = Date.now();
  const windowMs = input.windowSeconds * 1_000;
  const bucketEpoch = Math.floor(now / windowMs) * windowMs;
  const bucketIso = new Date(bucketEpoch).toISOString();
  const safeKey = `${input.namespace}:${input.key}`.slice(0, 300);
  const { client } = getDatabase();
  try {
    const [row] = await client<{ count: number }[]>`
      INSERT INTO rate_limit_buckets (key, bucket, count)
      VALUES (${safeKey}, ${bucketIso}::timestamptz, 1)
      ON CONFLICT (key, bucket)
      DO UPDATE SET count = rate_limit_buckets.count + 1
      RETURNING count`;
    const count = row?.count ?? input.limit + 1;
    return {
      allowed: count <= input.limit,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      resetAt: new Date(bucketEpoch + windowMs)
    };
  } finally {
    await client.end();
  }
}

export function rateLimitHeaders(result: { limit: number; remaining: number; resetAt: Date }) {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(Math.ceil(result.resetAt.getTime() / 1_000))
  };
}
