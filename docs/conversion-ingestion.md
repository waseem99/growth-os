# GrowthOS conversion ingestion contract

Downstream signup, checkout and subscription applications report completed funnel outcomes to the public renderer's server endpoint:

`POST /api/conversions`

The endpoint is intentionally separate from browser analytics. It requires a server-to-server bearer secret and is idempotent.

## Authentication

Configure `CONVERSION_INGEST_SECRET` in the renderer deployment environment and send:

`Authorization: Bearer <CONVERSION_INGEST_SECRET>`

Never expose this value in browser code, landing-page JSON, integration `publicConfig`, URLs or client logs. If the environment variable is absent, ingestion returns `503 INGEST_NOT_CONFIGURED`.

## Payload

```json
{
  "idempotencyKey": "order_or_event_unique_key_123",
  "eventName": "subscription_started",
  "occurredAt": "2026-09-01T12:00:00.000Z",
  "brandId": "00000000-0000-4000-8000-000000000010",
  "campaignId": "00000000-0000-4000-8000-000000000030",
  "pageId": "00000000-0000-4000-8000-000000000050",
  "versionId": "00000000-0000-4000-8000-000000000051",
  "variantId": null,
  "sessionId": "optional-first-party-session-id",
  "value": 599,
  "currency": "PKR",
  "attribution": {
    "firstTouch": {
      "source": "tiktok",
      "medium": "paid_social",
      "campaign": "launch",
      "term": null,
      "content": "creative_a",
      "creativeId": "creative_a",
      "capturedAt": "2026-09-01T11:30:00.000Z"
    },
    "lastTouch": {
      "source": "tiktok",
      "medium": "paid_social",
      "campaign": "retargeting",
      "term": null,
      "content": "creative_b",
      "creativeId": "creative_b",
      "capturedAt": "2026-09-01T11:50:00.000Z"
    }
  },
  "properties": {
    "plan": "premium"
  }
}
```

Allowed conversion names are `signup_complete`, `purchase` and `subscription_started`. `currency`, when supplied, is a three-letter uppercase ISO-style code. `value` is non-negative.

## Context validation

GrowthOS does not trust client-supplied brand/campaign relationships. The endpoint verifies that `versionId` belongs to `pageId`, that the page belongs to `brandId`, and that any supplied `campaignId` matches the page's campaign. The authoritative IDs are then stored.

## Idempotency

`idempotencyKey` must be stable for one logical downstream outcome. Re-sending the same key is safe: the first accepted request returns HTTP 201 and subsequent duplicates return HTTP 200 with `{ "accepted": true, "duplicate": true }`.

## Attribution relay

The landing-page tracker persists first/last touch using first-party browser storage and decorates navigational HTTP(S) links with non-PII UTM/creative parameters. A downstream application should preserve those parameters in its own first-party session and send the resulting first/last-touch envelope with the conversion. Do not place email, phone, names, payment data or other unnecessary PII in UTM parameters or GrowthOS analytics properties.

For same-page/client flows, custom funnel events can be emitted without coupling application code to the tracker implementation:

```js
window.dispatchEvent(new CustomEvent("growthos:event", {
  detail: { eventName: "signup_start", properties: { step: "account" } }
}));
```

Standard CI never requires the production bearer secret; live server-to-server verification is an environment/deployment boundary.
