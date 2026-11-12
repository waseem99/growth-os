# GrowthOS V2 — Staging Environment & Client Acceptance Plan

**Owner:** GrowthOS engineering / product owner
**Tracking:** https://github.com/waseem99/growth-os/issues/48
**Release candidate:** Draft PR https://github.com/waseem99/growth-os/pull/49
**Environment blocker:** https://github.com/waseem99/growth-os/issues/52
**External conversions:** https://github.com/waseem99/growth-os/issues/53

This plan is a release gate, **not proof that staging exists**. The current connected Vercel account has no access to the GrowthOS-owning team, and the existing Neon main is production. Until an authorized owner provisions isolation, the GitHub CI database is the only tested environment.

## 1. Infrastructure owner checklist (required before browser UAT)

- [ ] Grant the connected Vercel integration access to the team hosting the existing GrowthOS Admin and public renderer projects. Confirm **both** project IDs, repository connections, production aliases and team slug from the owner's dashboard.
- [ ] Create separate staging Admin and public Web projects for `apps/admin` and `apps/web`, linked to a tested feature SHA, without claiming existing production aliases or automatic promotion.
- [ ] Provision a **blank** isolated staging Neon project/database through the owning Vercel team. The current Vercel-managed production Neon `main` MUST NOT be used as disposable QA, and no production DB snapshots with real user PII should be copied into staging.
- [ ] Use separate staging Blob storage, OAuth callbacks, admin session/cookie domain, encryption/auth secret and provider credentials. Disable live payment webhooks and provider sends.
- [ ] Allow only explicit QA user identities. Confirm the staging hostname is excluded from search indexing.
- [ ] Verify `/api/health` on Admin and Web, exact deployment SHA and schema migrations 0001–0008 on **staging only**.
- [ ] Confirm no staging URL uses production aliases and no staging secret matches production.

## 2. GitHub release candidate

- Use a **single fixed head SHA** from Draft PR #49 (do not use moving `main`).
- Record security audit, lint, typecheck, unit tests, migration/schema verification, build, production-mode Playwright E2E and mobile Lighthouse runs tied to that exact SHA.
- Do not bypass the security audit or silently skip Playwright/Lighthouse failures.
- CI fixtures are synthetic and are not proof of an actual product signup or provider event receipt.

## 3. Multi-product portal acceptance

For at least **two independently configured products**, first create everything through GrowthOS Admin:
1. Create product branding/defaults, a verified staging domain, at least one campaign and a reusable default landing page.
2. Define package codes `1` and `2` with approved price, currency, billing terms and approved product backend destination. Ensure the external product checkout enforces authoritative pricing.
3. Upload a product-specific banner and create variation key `ranchers` (or brand-specific alternative).
4. Select the correct campaign and asset, preview the **draft privately**, publish and open the generated public URL.
5. Verify `?utm=M&package=1&parameter=ranchers` and canonical `utm_source=meta` resolve to the correct **product, banner, package, source and public URL**.
6. Confirm default URL has the approved default banner; unknown variation falls back safely; unknown/inactive/cross-product packages never silently show another product price.
7. Save a new variation version, publish, pause and roll back. Verify the published page and the audit trail.
8. A marketing operator must never be able to select another product's campaign or banner; a forged API request must be rejected by server and database validation.
9. Verify mobile/desktop rendering, copy contrast, SEO/canonical/noindex on draft, form/CTA behavior, page speed, broken asset links and unexpected third-party trackers.

## 4. Attribution and conversion validation

- Confirm the product-side CTA points only to the approved product HTTPS destination. GrowthOS does not process any payment, bank or wallet transaction.
- Verify only approved checkout links receive session/package/variation identifiers, never arbitrary external links.
- Product backend must validate actual successful purchase/subscription or registration from its own records. A visit/click alone must not fire `Purchase` or `Subscribe`.
- The backend provides a stable transaction idempotency key, original product/page/version/variation/package identifiers, actual amount/currency, and source/UTM context in the authenticated `POST /api/conversions` callback.
- Test separate product-specific callback secrets. Product A must be unable to record conversions for Product B.
- Test successful and failed/cancelled checkout, duplicate callback, wrong package, wrong variation version, revoked consent, missing matching signals and conflicting source.
- Confirm *exactly one* canonical conversion for a duplicated confirmed transaction. A consent-confirmed event without valid matching may be a real conversion but must **not** enqueue a doomed provider intent.
- Report views, CTA clicks, checkout starts and confirmed conversions by product/campaign/variation/package/source; reconcile totals against product backend records.

## 5. Meta and TikTok Test Events (staging only)

- Configure dedicated test pixels and provider credentials under staging server-side secrets, with the product's confirmed consent and approved pseudonymous matching fields.
- Configure provider-specific mapping under `/tracking-rules`; verify disabled rules do not enqueue events.
- Only in authorized staging, enable `GROWTHOS_PROVIDER_DELIVERY_ENABLED=true` and configure `GROWTHOS_PROVIDER_DISPATCH_SECRET`; trigger the dispatcher through an authorized operator/scheduler.
- Require provider Test Events receipts tied to the stable event ID and dashboard statuses, not only HTTP 200.
- Verify 401/403 (terminal), 429/5xx (retry), network errors (retry), disabled/missing integration (no delivery), missing matching (no queue), and deduplication by provider event ID.
- Confirm matching data is removed after verified provider delivery and never written into analytics, query strings, error responses or logs.
- Leave provider dispatch disabled after staging verification unless the product owner explicitly approves the rollout.

## 6. Required evidence pack

| Evidence | Acceptance requirement |
| --- | --- |
| Exact SHA and PRs | Immutable release code identity |
| Vercel project/deployment IDs and staging URLs | Staging isolated from production |
| Neon staging project/branch and migration list | Schema 0001–0008 verified on isolated DB |
| Portal UAT | Each case Pass/Fail with screenshots for two products |
| Product transaction receipt | Backend-confirmed staging success and cancellation |
| Callback proof | Source/variation/package/value/currency and idempotent conversion |
| Provider receipts | Meta/TikTok Test Events identifiers and delivery status |
| Security & performance | Permissions, tenant isolation, consent, audit, mobile LCP/CLS/SEO |
| Video | Full admin-to-public workflow, not only static screenshots |
| Rollback plan | Previous SHA/deployment/config rollback steps |
| Approval | Product owner and technical lead explicit sign-off |

## Release decision

Do **not** merge or deploy to production until every P0 acceptance test passes on isolated staging. Escalate blocked external credentials or provider receipts as unmet acceptance, not skipped success. No automated reminders or future deployment are assumed; the owner must authorize the release.
