# GrowthOS V2 — Operator/developer handover (15 November 2026)

**Purpose:** One actionable handover for the Cod 4 test portal. The user has approved the engineering work; this is not approval to charge customers, launch ads, or alter legacy production domains.

## System topology

- Source: `waseem99/growth-os`, workspaces `apps/admin` and `apps/web`. Track feature [PR #49](https://github.com/waseem99/growth-os/pull/49) and security [PR #51](https://github.com/waseem99/growth-os/pull/51).
- Test Admin: [growth-os-admin-cod-5.vercel.app](https://growth-os-admin-cod-5.vercel.app), project `prj_1t1v7A0qzQ4AY9IcRwVUwyn6MKVZ`, root `apps/admin`.
- Test renderer: [growth-os-web-cod-5.vercel.app](https://growth-os-web-cod-5.vercel.app), project `prj_RyNe7rXDoo3HjE4Pm13iEG3DSPTt`, root `apps/web`.
- Both are in Vercel team `cod-5` and use the same **testing-only** Neon branch `br-soft-pine-b36ucy54` and migrations `0001–0008`. **Do not** connect them to original Neon `main` or any existing live brand alias.
- Admin media: Vercel Blob linked; `BLOB_READ_WRITE_TOKEN` present in Admin environment. Do not copy the credential to Web or GitHub.
- Current deployed Cod4 test commit: `71e7aa963b4b555b7022c7cdba22cf318dab92b7` (Admin `dpl_FnhEoGq96VNno9G657nDg9MhzEhu`, Web `dpl_3xn3xtLFnHpM79uvTo6tTUjuJc5q`); earlier stable fallback SHA was `84521d5c2d122dbc32725bbc5544c6fc4e8737f8`. Latest V2 code SHA `bcdcbbc9f71bc5caa71b02234eff55d15f75ee53` passed full and focused CI before it was included in the Cod4 deploy merge.

## Operator-owned feature checklist

1. Login at `/login` using an authorized allowlisted internal account; owner/admin/editor/analyst permissions enforced by the database role. Never reuse generated test credentials outside Cod4. Verify `/brands`, `/campaigns`, `/packages`, `/pages`, `/variations`, `/assets`, `/analytics`, `/tracking-rules`, `/audit`, and `/users`.
2. Create the brand, verified hostname and staging campaign. Confirm that a public host actually resolves to that brand and that Admin/Web use the same database.
3. Save a draft product package with correct product-approved `currency`, `initialAmount`/`recurringAmount`, `billingInterval`, `packageCode`; activate **only after** the product backend confirms pricing parity. GrowthOS is not a payment processor.
4. Upload a small non-sensitive image via `/assets`, then verify Blob `head()`, corresponding `assets` DB row, correct product ownership and successful render. If a client/server error occurs, capture request ID, exact test URL and redacted diagnostics, not cookies or tokens.
5. Create and publish a page using the approved brand domain and campaign. Preview a draft; create a variation such as `parameter=ranchers`; publish v1, verify URL, publish v2, pause and rollback. Confirm all audit entries and public versions.
6. For each of two products, check Meta/TikTok URL parsing (`utm=M`, `utm=T`, `utm_source`), unknown parameter fallback, cross-product package rejection, mobile 390×844 and 1440px desktop layout, canonical/noindex, and asset path.
7. On the analytics dashboard, compare raw `analytics_events`, `conversions` and `conversion_provider_deliveries` by product, campaign, package and source. **Never** include `testTraffic=true` in real performance or revenue.
8. Only a **product-authoritative successful transaction or registration** should call authenticated `POST /api/conversions`; checkout-start is funnel telemetry and is not revenue. Replays of the same idempotency key must not double count.
9. Leave `GROWTHOS_PROVIDER_DELIVERY_ENABLED=false` until approved Meta/TikTok test pixels and consented, verified Events Manager receipts are attached to issue #53.

## Environment variable checklist (names only)

| App | Keys |
| --- | --- |
| Admin | `DATABASE_URL`, `AUTH_SECRET`, `INTERNAL_ADMIN_EMAIL`, `INTERNAL_ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_WEB_URL`, `ALLOW_DEMO_SEED=0` |
| Web | `DATABASE_URL`, `CONVERSION_INGEST_SECRET` or per-brand server secrets, `GROWTHOS_PROVIDER_DELIVERY_ENABLED=false`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_WEB_URL`, `ALLOW_DEMO_SEED=0` |
| Optional verified providers only | `GROWTHOS_PROVIDER_DISPATCH_SECRET`, provider API credentials, approved pixel IDs and matching consents; never store provider secrets in `publicConfig` or use `NEXT_PUBLIC_*` |
| SkillUp product API | See [SkillUp relay runbook](https://github.com/SkillStep/skillup-platform/blob/feat/growthos-verified-checkout-conversions-20261113/docs/payments/GROWTHOS_CONVERSION_RELAY.md) for product-authoritative JazzCash event evidence and disabled-by-default relay settings |

## External sign-offs / hard dependencies

- **SkillUp product owner + finance:** approved PKR price, billing interval/tax, sanctioned landing content and actual authenticated JazzCash sandbox order. Current demo prices (566/660 PKR) cannot be treated as approved SkillUp charges (990/month, subject to product approval).
- **Product developers:** code review of SkillUp PR #260; confirm direct JazzCash vs external wallet-service is authoritative; configure protected server secrets, issue stable authenticated callbacks, compare remote payment ledger to GrowthOS canonical conversions.
- **Meta/TikTok account administrator:** test pixel and Events API credentials, documented consent, accepted test-event receipt IDs; no live ads/spend while validating.
- **BizB developer:** real seller creation callback and verified campaign/ad identifiers.
- **GitHub repository administrator:** activate branch protection rules for `main` (Issue #54) and appoint an independent code reviewer. The GitHub connector cannot set rulesets.
- **Release approvers:** product owner + technical lead explicitly approve complete SHA, evidence pack, backup and rollback plan before merging or moving any legacy alias.

## Branch-protection configuration (repository administrator)

At `https://github.com/waseem99/growth-os/settings/rules`, create an **active** ruleset targeting `main`: require PR, at least one independent review, dismissal of stale approvals, resolved conversations, checks from `CI / quality` and `GrowthOS V2 foundation checks / verify-foundation` (confirm exact GitHub check names), and block force-pushes/deletions/direct pushes without unrestricted bypass. Verify with `GET /repos/waseem99/growth-os/rulesets` and `GET /repos/waseem99/growth-os/branches/main` before closing issue #54. **A GitHub comment or CODEOWNERS file alone is not enforcement.**

## Handover sign-off

- Technical reviewer: **unassigned** — must review PR #49 and code ownership
- Product/pricing reviewer: **unassigned** — must approve billed package values
- Provider testing: **not certified**
- Branch rules: **not enabled**
- Commercial release: **not authorized**

Follow [release evidence](./growthos-v2-release-evidence-20261115.md), [staging acceptance matrix](./growthos-v2-staging-uat.md) and [rollback runbook](./growthos-v2-rollback-20261115.md).
