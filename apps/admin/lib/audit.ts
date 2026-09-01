import { auditLogs, getDatabase, type JsonObject } from "@growth-os/db";

export type AuditInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  correlationId?: string | null;
};

const safeJson = (value?: Record<string, unknown> | null) => value ? value as JsonObject : null;

export async function writeAudit(input: AuditInput) {
  const { db, client } = getDatabase();
  try {
    await db.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      action: input.action.slice(0, 160),
      entityType: input.entityType.slice(0, 120),
      entityId: input.entityId.slice(0, 240),
      before: safeJson(input.before),
      after: safeJson(input.after),
      correlationId: (input.correlationId || crypto.randomUUID()).slice(0, 128)
    });
  } finally {
    await client.end();
  }
}

export function auditSummary(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
