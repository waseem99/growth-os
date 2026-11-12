# GrowthOS V2 — Multi-product dynamic campaign implementation

**Project:** `waseem99/growth-os`  
**Epic:** https://github.com/waseem99/growth-os/issues/48  
**Implementation PR:** https://github.com/waseem99/growth-os/pull/49  
**Separate security PR:** https://github.com/waseem99/growth-os/pull/51  
**Staging access blocker:** https://github.com/waseem99/growth-os/issues/52

## Scope and product boundary

GrowthOS is an internal landing-page, campaign and analytics operating portal for **multiple products**. It is not a checkout or payment gateway. Each product has its own brand, domain, page, packages, creatives and measurement configuration. An existing product backend processes checkout and confirms successful conversions.

The requested client URL is `/landing?utm=M&package=1&parameter=ranchers`. Each product can instead use its own approved existing page slug, such as `/ai-games`; creating an actual `/landing` page requires publishing a page under that slug in the portal.

## Implemented in draft PR #49

1. **Storage / ownership:** additive SQL migration `0006_dynamic_campaigns.sql` and Drizzle types define product packages, per-page variations, immutable variation versions and active publication pointers. Composite FKs prevent cross-brand page/campaign assignment and cross-variation version activation. No pre-existing data or public page is mutated by the migration.
2. **Packages admin:** `/packages` provides product-scoped package creation, validated PKR/USD amounts, one-time/recurring billing, draft/active/archived states and audit records. Draft packages cannot be resolved publicly.
3. **Variations admin:** `/variations` provides page, campaign, creative and parameter selection, draft version editing, publishing, pause and rollback; ownership checks on hero assets, parent page publication requirement and audit records. Private noindex draft preview: `/preview/variations/{id}`.
4. **Public URL resolver:** `apps/web/lib/campaign-parameters.ts` handles legacy Meta `utm=M`, proposed TikTok `utm=T` (verify client convention), canonical `utm_source`, `package` and `parameter`. Invalid/duplicate/conflicting queries fail closed. An unknown variation falls back to approved default creative; an inactive/unknown package returns 404 instead of displaying an incorrect price.
5. **Dynamic content:** the public renderer applies published banner/copy overrides on the existing page template, resolves approved package offer versions and shows the selected price. Explicit marketing variations take precedence over randomized A/B assignment.
6. **Approved checkout handoff:** the page uses a validated, administrator-configured HTTPS `subscriptionUrl` from the product settings. It passes package code/ID and acquisition IDs to the product checkout; it does **not** calculate or charge money. If no valid destination is configured, it disables the inert subscription button rather than implying payment works.
7. **Tracking and link generation:** the first-party tracker carries source, variation ID, package ID/code and attribution to analytics and outbound links. The `/variations` UI generates canonical Meta/TikTok campaign links with UTM source/medium/campaign and package code.
8. **Marketing Pixel foundation:** public Meta/TikTok IDs configured at `/integrations` are loaded only after affirmative per-product marketing consent. They report page views, **not** successful purchases. Real provider ID/event verification is still required.
9. **Reporting:** `/analytics/variations` groups first-party views, CTA clicks and checkout starts by product/variation/package/source. Confirmed conversion counts require downstream callback properties that include variation/package identifiers.
10. **Tests:** pure URL parsing, safe overlay and checkout destination unit tests; disposable PostgreSQL migrations/schema validation; production-mode browser E2E tests including two products, package/variation routing and malformed URLs.

## Required next work before client acceptance

- **Provider conversion event mapping and relay:** bind canonical `signup_complete`, `subscription_started`, `purchase` to allowed Meta/TikTok provider-specific successful events per product/package/source. Relay through approved provider APIs and reconcile duplicate browser/server events.
- **Product backend handoff:** each product checkout must validate package pricing and preserve the GrowthOS attribution context, then call `POST /api/conversions` with stable idempotency key, original campaign/page/version IDs, variation and package properties, value/currency, and first/last-touch data. GrowthOS **never processes payment itself**.
- **Real staging:** connected Vercel scope currently cannot access the owner team for GrowthOS; linked Neon org is Vercel-managed and rejected creating an isolated staging project. Follow issue #52. Do not reuse current production Neon main.
- **UAT/video:** on isolated staging, create a new product/page/package/banner variation entirely from the portal, preview, publish, visit exact Meta/TikTok links, verify actual product checkout/callback and provider events, test duplicates/invalid inputs, check roles, responsive layout, SEO, rollback and analytics. Record a walkthrough video and attach a test matrix.
- **Broader operations:** explicit publishing approval policy if required, scheduling, deeper provider diagnostics, export/reporting enhancements, conversion reconciliation and branded multi-language features are still candidates, not proven complete.

## Developer validation and release gate

1. Check both GitHub PRs and their exact SHAs. Do not merge while production release/branch protections are unresolved.
2. Keep the critical dependency security audit enforced; security PR #51 supplies Next.js and Zod updates with reproducible lockfile and directly declared Drizzle dependencies.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:migrate`, `npm run db:verify:schema`, `npm run db:seed`, `npm run db:verify`, `npm run build` and production-mode `npm run test:e2e` on disposable CI Postgres only. Review Lighthouse and CodeQL too.
4. Never run demo seed on Production. Apply migration on isolated staging only after code/schema review; verify both Admin and Web `/api/health` endpoints.
5. Capture CI run, exact SHA, Vercel staging deployment URLs/IDs, test accounts, signed QA cases and the walkthrough. Have client sign off before any production deployment.

## Client acceptance scenarios

- SkillUp variation `ranchers` selects the correct published banner, approved `package=1`, and Meta source using `utm=M`.
- TikTok source resolves the same creative through the agreed TikTok shorthand or `utm_source=tiktok`.
- No new pixel setup or code release is needed for a new banner parameter.
- Cross-product package/banner/campaign references cannot leak into another brand.
- Duplicate query keys, conflicting sources and malformed IDs do not lead to incorrect pricing.
- No `Subscribe` or `Purchase` event is triggered merely by opening a campaign link.
- Backend-confirmed conversions count once, map to the correct provider event and reconcile with product records.

**Status:** PR implementation in progress, production unchanged; **not yet staging-approved or production-ready** until all external integrations and UAT are complete.


## November 12 V2 backend hardening and delivery queue

The V2 branch now includes additional safeguards:
- `apps/web/lib/tracking-context.ts` validates variation, variation version, package ID/code and effective campaign against the canonical product/page. A variation-owned campaign is now accepted only for its own page; unrelated product references are rejected.
- The public `/api/events` endpoint rejects all canonical success events. Only the authenticated `/api/conversions` product server callback records signup, subscription and purchase success.
- Outbound session/campaign IDs are appended to **approved product checkout links only**, never every external link.
- `/tracking-rules` configures product/optional-package mappings to provider-specific Meta `Subscribe`/`Purchase` and TikTok `Subscribe`/`CompletePayment` events. Each source has a separate rule. It stores **no tokens**.
- Migration `0007_conversion_rules` adds product-scoped rules and triggers prohibiting cross-product offer and banner relationships; migration `0008_conversion_deliveries` adds the idempotent delivery ledger.
- An authenticated product callback with `properties.marketingConsent === true`, `properties.testTraffic !== true`, enabled provider integration and matching enabled event rule creates a `pending` provider delivery intent in the **same database transaction** as the canonical conversion. Duplicates cannot enqueue again. No consent, disabled rule or QA traffic creates no provider delivery intent.
- `/tracking-rules/deliveries` distinguishes `pending` from `delivered` provider events. **At this stage no Meta/TikTok server API transport is active.** A pending record is not a verified provider receipt.
- The downstream product must affirm consent from its own trusted session/policy record; it must **not** merely echo an unsigned URL value.

### Recommended per-product server callback secrets

The existing `CONVERSION_INGEST_SECRET` remains as a legacy fallback until each product is migrated. To isolate products, configure a separate secret in staging and later production:

`GROWTHOS_CONVERSION_SECRET_<BRAND_UUID_WITHOUT_HYPHENS_UPPERCASE>`

For example, a brand UUID `00000000-0000-4000-8000-000000000010` corresponds to `GROWTHOS_CONVERSION_SECRET_00000000000040008000000000000010`. When configured, only that product-specific secret is valid for its `brandId` and the shared legacy secret is rejected for that brand. Configure secrets **in the protected hosting environment**, never in repository files, URLs or client JavaScript.

### Backend callback example (for developer testing only)

```json
{
  "idempotencyKey": "stable-backend-transaction-id",
  "eventName": "subscription_started",
  "occurredAt": "2026-11-12T12:00:00.000Z",
  "brandId": "<approved-product-uuid>",
  "campaignId": "<approved-product-campaign-uuid>",
  "pageId": "<published-landing-page-uuid>",
  "versionId": "<published-page-version-uuid>",
  "sessionId": "<growthos-attributed-session-id>",
  "value": 566,
  "currency": "PKR",
  "attribution": {
    "firstTouch": { "source": "meta", "capturedAt": "2026-11-12T11:55:00.000Z" },
    "lastTouch": { "source": "meta", "capturedAt": "2026-11-12T11:55:00.000Z" }
  },
  "properties": {
    "variationId": "<approved-variation-uuid>",
    "variationVersionId": "<approved-variation-version-uuid>",
    "packageId": "<approved-product-package-uuid>",
    "packageCode": "1",
    "marketingConsent": true,
    "testTraffic": false
  }
}
```

All UUID values shown above are placeholders for a real backend integration, not a public browser request. The backend must obtain a verified product transaction and consent record before emitting this callback. For testing QA traffic, send `testTraffic:true`; those records should not create live provider delivery intents.

### Remaining external completion gates

1. Correct Vercel team access and a **separate blank staging database**. Do not use the existing Neon production main. See issue #52.
2. Connect and UAT at least one actual product staging checkout backend and callback. A simulated CI conversion does not prove a real transaction.
3. Configure Meta and TikTok provider credentials through approved secret management, implement/verify the actual provider transport worker, retries, provider receipts and event deduplication. Current database records are pending intents only. See issue #53.
4. Run live browser/mobile UAT of brand creation, variation preview/publish, packages, event rules and rollback; capture tested URLs and a real screen-recording. Sign off staging before any production release.
