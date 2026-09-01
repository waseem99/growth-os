import { NextResponse } from "next/server";
import { analyticsEvents, getDatabase } from "@growth-os/db";
import { analyticsEventInputSchema } from "@growth-os/tracking";
import { verifyTrackingContext } from "../../../lib/tracking-context";
import { checkRateLimit, clientAddress, correlationId, logEvent, rateLimitHeaders, reportError } from "../../../lib/operability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = correlationId(request);
  let rate;
  try {
    rate = await checkRateLimit({ namespace: "events", key: clientAddress(request), limit: 120, windowSeconds: 60 });
  } catch (error) {
    await reportError("analytics_rate_limit_failed", error, { correlationId: requestId });
    return NextResponse.json({ error: "INGEST_TEMPORARILY_UNAVAILABLE" }, { status: 503, headers: { "x-request-id": requestId } });
  }
  const headers = { "x-request-id": requestId, ...rateLimitHeaders(rate) };
  if (!rate.allowed) {
    logEvent("warn", "analytics_rate_limited", { correlationId: requestId });
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...headers, "retry-after": "60" } });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers });
  }
  const parsed = analyticsEventInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_EVENT", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400, headers });

  const context = await verifyTrackingContext(parsed.data);
  if (!context) return NextResponse.json({ error: "INVALID_CONTEXT" }, { status: 400, headers });

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
    logEvent("info", "analytics_event_accepted", { correlationId: requestId, eventName: parsed.data.eventName, duplicate: !inserted, pageId: context.pageId });
    return NextResponse.json({ accepted: true, duplicate: !inserted }, { status: inserted ? 201 : 200, headers });
  } catch (error) {
    await reportError("analytics_ingest_failed", error, { correlationId: requestId, eventName: parsed.data.eventName, pageId: context.pageId });
    return NextResponse.json({ error: "INGEST_FAILED" }, { status: 503, headers });
  } finally {
    await client.end();
  }
}
