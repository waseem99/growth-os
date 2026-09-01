import { NextResponse } from "next/server";
import { analyticsEvents, getDatabase } from "@growth-os/db";
import { analyticsEventInputSchema } from "@growth-os/tracking";
import { verifyTrackingContext } from "../../../lib/tracking-context";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = analyticsEventInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_EVENT", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });

  const context = await verifyTrackingContext(parsed.data);
  if (!context) return NextResponse.json({ error: "INVALID_CONTEXT" }, { status: 400 });

  const { db, client } = getDatabase();
  try {
    const [inserted] = await db.insert(analyticsEvents).values({
      eventId: parsed.data.eventId,
      eventName: parsed.data.eventName,
      occurredAt: new Date(parsed.data.occurredAt),
      brandId: context.brandId,
      campaignId: context.campaignId,
      pageId: context.pageId,
      versionId: context.versionId,
      variantId: context.variantId,
      creativeId: parsed.data.creativeId ?? null,
      sessionId: parsed.data.sessionId,
      anonymousId: parsed.data.anonymousId,
      userId: parsed.data.userId ?? null,
      source: parsed.data.source ?? null,
      medium: parsed.data.medium ?? null,
      campaignName: parsed.data.campaignName ?? null,
      term: parsed.data.term ?? null,
      content: parsed.data.content ?? null,
      properties: parsed.data.properties
    }).onConflictDoNothing({ target: analyticsEvents.eventId }).returning({ id: analyticsEvents.id });
    return NextResponse.json({ accepted: true, duplicate: !inserted }, { status: inserted ? 201 : 200 });
  } finally {
    await client.end();
  }
}
