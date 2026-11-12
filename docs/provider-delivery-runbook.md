# GrowthOS V2 — Secure Meta/TikTok Provider Delivery Runbook

**State:** Implemented in draft feature PR #49. **OFF BY DEFAULT.** No live API calls and no production changes. Real provider receipts require staging environment and customer/product credential setup.

## Responsibilities and trust boundary

GrowthOS is a multi-product landing-page, campaign, attribution and reporting portal. It does **not** process payments. An existing SkillUp, Jalwa, Game Arena or other product backend:

1. Validates the selected package, price and actual customer completion using its own authoritative records.
2. Confirms lawful marketing consent from the product's own consent/session records. **Never copy the consent flag from URL parameters.**
3. Calls GrowthOS `POST /api/conversions` with the exact product credentials, stable transaction idempotency key, validated product/page/variation/package identifiers, actual value and currency, verified attribution, and `marketingConsent: true` only when affirmative consent was recorded.
4. May supply `properties.providerMatching` with *only* a SHA-256 lowercase hex digest of a product user ID and a bounded real visitor user agent, plus opt-in browser pixel IDs. Do not include email, phone, IP, raw user ID or sensitive purchase descriptors. Product owners remain responsible for consent, legal basis and data retention.
5. GrowthOS stores a canonical conversion **once**. If the provider configuration/rule permits, GrowthOS records **one pending delivery intent** in the same transaction. Pending is not delivered.

## Outbox and provider adapter

- `conversion_provider_deliveries` enforces uniqueness by conversion + provider and also provider + stable event ID.
- `POST /api/internal/dispatch-conversions` is protected by `GROWTHOS_PROVIDER_DISPATCH_SECRET`. No public GET or unauthenticated POST is supported.
- `GROWTHOS_PROVIDER_DELIVERY_ENABLED=true` must be explicitly set; otherwise the route responds `503 PROVIDER_TRANSPORT_DISABLED`.
- The dispatcher claims at most five due intents using PostgreSQL `FOR UPDATE SKIP LOCKED`, with a two-minute processing lease. The provider event ID remains constant across retries.
- Metadata is loaded from **the matching product's verified hostname** and enabled provider integration, never from user-controlled destination URLs. Provider destinations are hard-coded:
  - Meta Conversions API `https://graph.facebook.com/v25.0/<pixel-id>/events`.
  - TikTok Events API 2.0 `https://business-api.tiktok.com/open_api/v1.3/event/track/`.
- A Meta result is considered delivered only after an HTTP 2xx response with `events_received >= 1`. TikTok requires HTTP 2xx and response `code === 0`.
- Provider HTTP requests require the officially specified static API URLs. **HTTP redirects are rejected** so bearer credentials cannot follow a redirect to another origin.
- An authenticated product conversion with affirmative marketing consent **but missing or malformed provider matching** is still recorded as a confirmed canonical conversion. It does **not** create a pending provider delivery job. This prevents undeliverable queue pollution. A later callback with the same transaction ID is idempotent and does not retroactively enqueue an event; ensure the product sends valid consent and matching evidence with its first success callback.
- Provider-transport tests use an injected local mock HTTP function. They verify accepted and rejected provider acknowledgments, 401/403 permanent failures, 429/5xx retryability, exception handling, strict endpoint validation and redirect rejection; no real provider request is made during GitHub CI.
- Retryable failures get bounded 60s/5m/15m/1h backoff, a total of five attempts, and then terminal `failed`; permanent input/auth rejection becomes `suspended`. Failed or suspended rows are **not** provider receipts.
- On delivery success, the queue erases its `matching` field to minimize retention of pseudonymous data. Do not log tokens, matching information or raw provider responses.
- Do **not** enable an automated dispatcher schedule until real staging provider Test Events has been checked, including duplicate rejection and a fail/retry scenario.

## Required server configuration (all secrets in hosting secret manager)

```
# Scheduler/worker authentication (not public or checked into Git)
GROWTHOS_PROVIDER_DISPATCH_SECRET=<random-server-only-secret>

# Must remain false or absent until staging UAT and explicit approval
GROWTHOS_PROVIDER_DELIVERY_ENABLED=false

# Per-product provider access tokens (UUID uppercase, without hyphens)
GROWTHOS_META_API_TOKEN_<BRAND_UUID_32HEX>=<provider-token>
GROWTHOS_TIKTOK_API_TOKEN_<BRAND_UUID_32HEX>=<provider-token>

# Optional provider Test Events codes (staging only)
GROWTHOS_META_TEST_CODE=<test-code>
GROWTHOS_TIKTOK_TEST_CODE=<test-code>
```

The product-specific conversion callback secret is a **different credential**: `GROWTHOS_CONVERSION_SECRET_<BRAND_UUID_32HEX>`. It cannot access the provider dispatcher.

Enable a provider Pixel in GrowthOS `/integrations`, configure an approved package event mapping in `/tracking-rules`, and have the product backend send `POST /api/conversions`. The `/tracking-rules/deliveries` portal lists pending, delivered, suspended and failed events, without exposing match data.

## Product callback — optional provider matching block

This is included *inside* the authenticated product backend's conversion callback's `properties` object:

```json
{
  "marketingConsent": true,
  "testTraffic": false,
  "variationId": "<product-owned-uuid>",
  "variationVersionId": "<product-owned-uuid>",
  "packageId": "<product-owned-uuid>",
  "packageCode": "1",
  "providerMatching": {
    "externalIdSha256": "<sha256-of-stable-product-user-id-in-hex>",
    "clientUserAgent": "Mozilla/5.0 ...",
    "fbp": "fb.1.123456789.111",
    "fbc": "fb.1.123456789.abcdef",
    "ttp": "ttclid-cookie-value",
    "ttclid": "ad-click-id"
  }
}
```

`externalIdSha256` and `clientUserAgent` are required for the current provider transport. Other values are optional and platform-specific; unsupported fields are discarded. Product backends must only include browser signals they have lawfully collected under the confirmed consent policy. This block is **not** copied into the general-purpose canonical conversion record.

The adapter strips the query and fragment from the configured verified landing page URL before sending; the outgoing provider event contains only the documented event and matching fields.

## Safe acceptance matrix

- [ ] Dedicated empty staging Neon database and isolated Vercel Admin/Web deployments
- [ ] Product-specific callback secrets configured; another product's secret receives 401
- [ ] Meta/TikTok test pixel IDs and Test Events codes available; no production ad accounts used during initial tests
- [ ] Unknown/invalid provider credential blocked, no send
- [ ] No consent, QA testTraffic, absent matching, stale event and non-verified domain cannot produce a provider delivery
- [ ] Product confirmed actual successful transaction; correct value, currency, package code and variation ID
- [ ] No duplicate canonical conversions/outbox rows on callback retries
- [ ] Provider response validates its body, not HTTP status alone
- [ ] Provider `delivered` row has a correlated Test Events receipt
- [ ] Failure or API rejection visible in diagnostics; bounded retries and deduplication tested
- [ ] Matching data removed after delivery and provider credentials absent from all logs
- [ ] QA video, exact SHA and deployment IDs shared; client approval before live enablement

**Environment restriction:** Existing Vercel `growth-os-admin` team is not accessible to the current connected Vercel account, and the Vercel-managed Neon project cannot be replaced with a new staging project from this connection. See #52. Actual product callbacks/provider receipt verification tracked in #53.
