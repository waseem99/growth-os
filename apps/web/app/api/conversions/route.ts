import { NextResponse } from "next/server";
import { conversions, getDatabase } from "@growth-os/db";
import { conversionInputSchema } from "@growth-os/tracking";
import { verifyTrackingContext } from "../../../lib/tracking-context";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CONVERSION_INGEST_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!process.env.CONVERSION_INGEST_SECRET) return NextResponse.json({ error: "INGEST_NOT_CONFIGURED" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = conversionInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CONVERSION", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });

  const versionId = typeof parsed.data.properties.versionId === "string" ? parsed.data.properties.versionId : null;
  if (!versionId) return NextResponse.json({ error: "VERSION_ID_REQUIRED_IN_PROPERTIES" }, { status: 400 });
  const context = await verifyTrackingContext({ ...parsed.data, versionId });
  if (!context) return NextResponse.json({ error: "INVALID_CONTEXT" }, { status: 400 });

  const { db, client } = getDatabase();
  try {
    const [inserted] = await db.insert(conversions).values({
      idempotencyKey: parsed.data.idempotencyKey,
      eventName: parsed.data.eventName,
      occurredAt: new Date(parsed.data.occurredAt),
      brandId: context.brandId,
      campaignId: context.campaignId,
      pageId: context.pageId,
      variantId: parsed.data.variantId ?? null,
      sessionId: parsed.data.sessionId ?? null,
      value: parsed.data.value == null ? null : String(parsed.data.value),
      currency: parsed.data.currency ?? null,
      attribution: parsed.data.attribution,
      properties: parsed.data.properties
    }).onConflictDoNothing({ target: conversions.idempotencyKey }).returning({ id: conversions.id });
    return NextResponse.json({ accepted: true, duplicate: !inserted }, { status: inserted ? 201 : 200 });
  } finally {
    await client.end();
  }
}
