import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import {
  conversions, conversionEventRules, conversionProviderDeliveries, getDatabase, integrations
} from "@growth-os/db";
import { conversionInputSchema } from "@growth-os/tracking";
import { verifyTrackingContext } from "../../../lib/tracking-context";
import { deliveryPayload, deliveryProvider } from "../../../lib/conversion-delivery";
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
    // Canonical conversion and provider delivery intent must commit atomically.
    // The outbox is NOT a delivery receipt; actual provider transport is disabled
    // until credentials, consent proof and staging verification are available.
    const provider = deliveryProvider({
      source: parsed.data.attribution.lastTouch?.source ?? parsed.data.attribution.firstTouch?.source,
      marketingConsent: parsed.data.properties.marketingConsent,
      testTraffic: parsed.data.properties.testTraffic
    });
    const inserted = await db.transaction(async (tx) => {
      const [saved] = await tx.insert(conversions).values({
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
        properties: {
          ...parsed.data.properties, versionId: context.versionId,
          variationId: context.variationId, packageId: context.packageId,
          packageCode: context.packageCode
        }
      }).onConflictDoNothing({ target: conversions.idempotencyKey }).returning({ id: conversions.id });
      if (!saved) return false;

      if (provider) {
        const eligiblePackages = context.packageId
          ? or(isNull(conversionEventRules.packageId), eq(conversionEventRules.packageId, context.packageId))
          : isNull(conversionEventRules.packageId);
        const [rules, providerIntegration] = await Promise.all([
          tx.select({
            packageId: conversionEventRules.packageId,
            providerEvent: conversionEventRules.providerEvent
          }).from(conversionEventRules).where(and(
            eq(conversionEventRules.brandId, context.brandId),
            eq(conversionEventRules.provider, provider),
            eq(conversionEventRules.canonicalEvent, parsed.data.eventName),
            eq(conversionEventRules.status, "enabled"),
            eligiblePackages
          )),
          tx.select({ id: integrations.id }).from(integrations).where(and(
            eq(integrations.brandId, context.brandId),
            eq(integrations.provider, provider),
            eq(integrations.status, "enabled")
          )).limit(1)
        ]);
        const configuredRule = rules.find((item) => item.packageId === context.packageId)
          ?? rules.find((item) => item.packageId === null);
        if (configuredRule && providerIntegration.length) {
          const payload = deliveryPayload({
            conversionId: saved.id,
            providerEvent: configuredRule.providerEvent,
            occurredAt: parsed.data.occurredAt,
            value: parsed.data.value ?? null,
            currency: parsed.data.currency ?? null,
            pageId: context.pageId,
            variationId: context.variationId,
            packageCode: context.packageCode
          });
          await tx.insert(conversionProviderDeliveries).values({
            conversionId: saved.id,
            brandId: context.brandId,
            provider,
            providerEvent: configuredRule.providerEvent,
            providerEventId: payload.event_id,
            payload
          }).onConflictDoNothing({
            target: [conversionProviderDeliveries.conversionId, conversionProviderDeliveries.provider]
          });
        }
      }
      return true;
    });
    logEvent("info", "conversion_accepted", {
      correlationId: requestId, eventName: parsed.data.eventName,
      duplicate: !inserted, pageId: context.pageId
    });
    return NextResponse.json({ accepted: true, duplicate: !inserted }, {
      status: inserted ? 201 : 200, headers
    });
  } catch (error) {
    await reportError("conversion_ingest_failed", error, {
      correlationId: requestId, eventName: parsed.data.eventName, pageId: context.pageId
    });
    return NextResponse.json({ error: "INGEST_FAILED" }, { status: 503, headers });
  } finally {
    await client.end();
  }
}
