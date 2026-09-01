export type AdminLogLevel = "info" | "warn" | "error";

type AdminLogContext = Record<string, string | number | boolean | null | undefined>;

export function adminCorrelationId() {
  return crypto.randomUUID();
}

export function logAdminEvent(level: AdminLogLevel, event: string, context: AdminLogContext = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "growthos-admin",
    level,
    event,
    ...context
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export async function reportAdminError(event: string, error: unknown, context: AdminLogContext = {}) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_ERROR";
  logAdminEvent("error", event, { ...context, error: message });
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "growthos-admin", event, error: message, ...context }),
      signal: AbortSignal.timeout(3_000)
    });
  } catch {
    logAdminEvent("warn", "error_alert_delivery_failed", {
      originalEvent: event,
      correlationId: context.correlationId
    });
  }
}
