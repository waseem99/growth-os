import { eq } from "drizzle-orm";
import { aiJobs, getDatabase, type JsonObject } from "@growth-os/db";
import type { AiAction, AiUsage } from "@growth-os/ai";

const json = (value: unknown) => value as JsonObject;

export async function startAiJob(input: {
  userId: string;
  brandId?: string | null;
  action: AiAction;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { db, client } = getDatabase();
  try {
    const [job] = await db.insert(aiJobs).values({
      userId: input.userId,
      brandId: input.brandId ?? null,
      action: input.action,
      status: "running",
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: json(input.metadata ?? {})
    }).returning({ id: aiJobs.id });
    if (!job) throw new Error("AI_JOB_CREATE_FAILED");
    return job.id;
  } finally { await client.end(); }
}

export async function completeAiJob(jobId: string, input: {
  provider: string;
  model: string;
  latencyMs: number;
  usage?: AiUsage;
  metadata: Record<string, unknown>;
  targetType?: string;
  targetId?: string;
}) {
  const { db, client } = getDatabase();
  try {
    await db.update(aiJobs).set({
      provider: input.provider,
      model: input.model,
      status: "completed",
      completedAt: new Date(),
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: json({ ...input.metadata, latencyMs: input.latencyMs, usage: input.usage ?? null })
    }).where(eq(aiJobs.id, jobId));
  } finally { await client.end(); }
}

export async function completeLocalAiJob(jobId: string, metadata: Record<string, unknown>) {
  const { db, client } = getDatabase();
  try {
    await db.update(aiJobs).set({ provider: "local", model: "deterministic-quality-v1", status: "completed", completedAt: new Date(), metadata: json(metadata) }).where(eq(aiJobs.id, jobId));
  } finally { await client.end(); }
}

export async function failAiJob(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 1600) : "AI_JOB_FAILED";
  const { db, client } = getDatabase();
  try {
    await db.update(aiJobs).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(aiJobs.id, jobId));
  } finally { await client.end(); }
}
