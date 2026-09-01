import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { conversions, getDatabase } from "@growth-os/db";
import { conversionInputSchema } from "@growth-os/tracking";
import { verifyTrackingContext } from "../../../lib/tracking-context";
import { checkRateLimit, clientAddress, correlationId, logEvent, rateLimitHeaders, reportError } from "../../../lib/operability";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CONVERSION_INGEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  const requestId = correlationId(request);
  const baseHeaders = { "x-request-id": requestId };
  if (!process.env.CONVERSION_INGEST_SECRET) return NextResponse.json({ error: "INGEST_NOT_CONFIGURED" }, { status: 503, headers: baseHeaders });
  if (!authorized(request)) {
    logEvent("warn", "conversion_auth_rejected", { correlationId: requestId });
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: baseHeaders });
  }

  let rate;
  try {
    rate = await checkRateLimit({ namespace: "conversions", key: clientAddress(request), limit: 60, windowSeconds: 60 });
  } catch (error) {
    await reportError("conversion_rate_limit_failed", error, { correlationId: requestId });
    return NextResponse.json({ error: "INGEST_TEMPORARILY_UNAVAILABLE" }, { status: 503, headers: baseHeaders });
  }
  const headers = { ...baseHeaders, ...rateLimitHeaders(rate) };
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...headers, "retry-after": "60" } });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers });
  }
  const parsed = conversionInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CONVERSION", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400, headers });

  const context = await verifyTrackingContext(parsed.data);
  if (!context) return NextResponse.json({ error: "INVALID_CONTEXT" }, { status: 400, headers });

  const { db, client } = getDatabase();
  try {
    const [inserted] = await db.insert(conversions).values({
      idempotencyKey: parsed.data.idempotencyKey,
      eventName: parsed.data.eventName,
      occurredAt: new Date(parsed.data.occurredAt),
      brandId: context.brandId,
      campaignId: context.campaignId,
      pageId: context.pageId,
      variantId: context.variantId,
      sessionId: parsed.data.sessionId ?? null,
      value: parsed.data.value == null ? null : String(parsed.data.value),
      currency: parsed.data.currency ?? null,
      attribution: parsed.data.attribution,
      properties: { ...parsed.data.properties, versionId: context.versionId }
    }).onConflictDoNothing({ target: conversions.idempotencyKey }).returning({ id: conversions.id });
    logEvent("info", "conversion_accepted", { correlationId: requestId, eventName: parsed.data.eventName, duplicate: !inserted, pageId: context.pageId });
    return NextResponse.json({ accepted: true, duplicate: !inserted }, { status: inserted ? 201 : 200, headers });
  } catch (error) {
    await reportError("conversion_ingest_failed", error, { correlationId: requestId, eventName: parsed.data.eventName, pageId: context.pageId });
    return NextResponse.json({ error: "INGEST_FAILED" }, { status: 503, headers });
  } finally {
    await client.end();
  }
}
