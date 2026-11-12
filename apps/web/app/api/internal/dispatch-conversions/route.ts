import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@growth-os/db";
import { buildProviderTransport, providerAccepted, type DeliveryIntent } from "../../../../lib/provider-transport";
import type { DeliveryProvider } from "../../../../lib/conversion-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Claimed = {
  id: string;
  brand_id: string;
  provider: DeliveryProvider;
  provider_event: string;
  attempt_count: number;
  payload: DeliveryIntent;
};
type Destination = {
  pixel_id: string | null;
  hostname: string | null;
  slug: string | null;
};
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretMatches(input: string, expected: string) {
  if (!input || !expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function tokenFor(brandId: string, provider: DeliveryProvider) {
  if (!ID.test(brandId)) return null;
  const brand = brandId.replace(/-/g, "").toUpperCase();
  const key = `GROWTHOS_${provider.toUpperCase()}_API_TOKEN_${brand}`;
  return process.env[key] || null;
}

/**
 * Called only by an authorized scheduler/operator. Off by default. Claims a
 * bounded batch via SKIP LOCKED; every outcome is recorded with an immutable
 * provider event ID. No dynamic remote URLs or customer PII are logged.
 */
export async function POST(request: Request) {
  const expected = process.env.GROWTHOS_PROVIDER_DISPATCH_SECRET ?? "";
  const received = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!secretMatches(received, expected)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (process.env.GROWTHOS_PROVIDER_DELIVERY_ENABLED !== "true") {
    return NextResponse.json({ error: "PROVIDER_TRANSPORT_DISABLED" }, { status: 503 });
  }

  const { client } = getDatabase();
  const counts = { claimed: 0, delivered: 0, retry: 0, suspended: 0 };
  try {
    const rows = await client<Claimed[]>`
      WITH due AS (
        SELECT id FROM conversion_provider_deliveries
        WHERE (
          status = 'pending'
          OR (status = 'attempting' AND next_attempt_at <= now())
        ) AND next_attempt_at <= now() AND attempt_count < 5
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 5
      )
      UPDATE conversion_provider_deliveries d
      SET status = 'attempting',
          attempt_count = d.attempt_count + 1,
          next_attempt_at = now() + interval '2 minutes',
          updated_at = now()
      FROM due WHERE d.id = due.id
      RETURNING d.id::text, d.brand_id::text, d.provider,
                d.provider_event, d.attempt_count, d.payload
    `;
    counts.claimed = rows.length;

    for (const row of rows) {
      let errorCode: string | null = null;
      let terminal = false;
      let ok = false;
      try {
        if (row.provider !== "meta" && row.provider !== "tiktok") {
          errorCode = "INVALID_PROVIDER";
          terminal = true;
        } else if (row.payload.event !== row.provider_event) {
          errorCode = "EVENT_MAPPING_CHANGED";
          terminal = true;
        } else {
          const [destination] = await client<Destination[]>`
            SELECT i.public_config->>'pixelId' AS pixel_id,
                   d.hostname, lp.slug
            FROM conversion_provider_deliveries q
            JOIN conversions c ON c.id = q.conversion_id
            JOIN landing_pages lp ON lp.id = c.page_id AND lp.brand_id = q.brand_id
            LEFT JOIN domains d ON d.id = lp.domain_id AND d.status = 'verified'
            JOIN integrations i ON i.brand_id = q.brand_id
              AND i.provider = q.provider AND i.status = 'enabled'
            WHERE q.id = ${row.id}::uuid
            LIMIT 1
          `;
          const token = tokenFor(row.brand_id, row.provider);
          if (!token || !destination?.pixel_id || !destination.hostname || !destination.slug) {
            errorCode = "PROVIDER_OR_VERIFIED_DOMAIN_NOT_CONFIGURED";
          } else {
            const req = buildProviderTransport({
              provider: row.provider,
              pixelId: destination.pixel_id, token,
              pageUrl: `https://${destination.hostname}/${destination.slug}`,
              event: row.payload,
              testCode: process.env[`GROWTHOS_${row.provider.toUpperCase()}_TEST_CODE`] ?? null
            });
            if (!req) {
              errorCode = "INVALID_OR_EXPIRED_EVENT_OR_MATCHING";
              terminal = true;
            } else {
              const response = await fetch(req.endpoint, {
                method: "POST",
                headers: req.headers,
                body: JSON.stringify(req.body),
                cache: "no-store",
                signal: AbortSignal.timeout(8000)
              });
              const result: unknown = await response.json().catch(() => null);
              ok = providerAccepted(row.provider, response.status, result);
              if (!ok) {
                errorCode = response.status === 401 || response.status === 403
                  ? "PROVIDER_AUTH_REJECTED"
                  : `PROVIDER_RESPONSE_${response.status}`;
                terminal = response.status === 401 || response.status === 403 ||
                  (response.status >= 400 && response.status < 500 && response.status !== 429);
              }
            }
          }
        }
      } catch {
        errorCode = "PROVIDER_TRANSPORT_ERROR";
      }

      if (ok) {
        await client`
          UPDATE conversion_provider_deliveries SET
            status = 'delivered', delivered_at = now(),
            last_error = NULL, updated_at = now(),
            payload = payload - 'matching'
          WHERE id = ${row.id}::uuid AND status = 'attempting'
            AND attempt_count = ${row.attempt_count}
        `;
        counts.delivered += 1;
      } else if (terminal || row.attempt_count >= 5) {
        await client`
          UPDATE conversion_provider_deliveries SET
            status = ${terminal ? "suspended" : "failed"},
            last_error = ${errorCode ?? "UNSPECIFIED_PROVIDER_ERROR"},
            updated_at = now()
          WHERE id = ${row.id}::uuid AND status = 'attempting'
            AND attempt_count = ${row.attempt_count}
        `;
        counts.suspended += 1;
      } else {
        const retrySeconds = [60, 300, 900, 3600, 3600][Math.min(row.attempt_count - 1, 4)];
        await client`
          UPDATE conversion_provider_deliveries SET
            status = 'pending',
            next_attempt_at = now() + ${retrySeconds} * interval '1 second',
            last_error = ${errorCode ?? "UNSPECIFIED_PROVIDER_ERROR"},
            updated_at = now()
          WHERE id = ${row.id}::uuid AND status = 'attempting'
            AND attempt_count = ${row.attempt_count}
        `;
        counts.retry += 1;
      }
    }
    return NextResponse.json(counts);
  } catch {
    return NextResponse.json({ error: "DISPATCH_FAILED" }, { status: 503 });
  } finally {
    await client.end();
  }
}
