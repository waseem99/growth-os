# GrowthOS P0 release verification

This document is the repeatable release evidence for issue #15 and the master P0 Definition of Done in #1. It separates what is enforced automatically in the repository from the final infrastructure activation that must happen after hosting credentials, production secrets and DNS are supplied.

## Automated release gate

Every pull request and every push to `main` executes the CI workflow against PostgreSQL 17 and Node 24. The gate must be green before a P0 release is accepted.

| Requirement | Automated evidence |
| --- | --- |
| Production dependency security | `npm audit --omit=dev --audit-level=high` fails on High/Critical production advisories. |
| Static quality | `npm run lint` with zero warnings and strict workspace TypeScript checks. |
| Unit/contract behavior | `npm test`, including RBAC, page schemas, page input, publish validation, attribution, analytics, experiment allocation/stickiness and AI structured-output/quality behavior. |
| Database deployability | All ordered migrations run on a clean PostgreSQL instance, followed by `npm run db:verify:schema`. |
| Production seed safety | Seed command is guarded against non-local/production execution unless an operator explicitly enables disposable demo seeding. |
| Deterministic acquisition data | CI then seeds a disposable database and runs `npm run db:verify` to reconcile brands, domains, publications, offer pricing, attribution, analytics funnel, experiment variants and conversion revenue. |
| Production builds | Shared packages, Admin and Web complete production builds. |
| Deployment-like browser tests | Playwright starts production builds with `next start`, not development servers. |
| Auth boundary | Unauthenticated Admin access remains isolated behind the login boundary; health endpoints are independently testable. |
| Multi-brand/domain routing | SkillUp resolves at `skillup.localhost/ai-games`; Jalwa independently resolves at `jalwa.localhost/watch`. |
| Mobile behavior | SkillUp is rendered at a 390×844 paid-social viewport with no horizontal overflow and an actionable subscription CTA. |
| SEO | Browser tests verify canonical/noindex behavior and sitemap/robots; experiment QA traffic retains the canonical URL and is noindex. |
| Experiments | Package tests enforce deterministic allocation/stickiness; seeded DB reconciliation verifies one control, 100% allocation and test-traffic isolation; browser test forces variant B safely with `go_test=1`. |
| Analytics/event ingestion | Production-mode HTTP E2E posts a contextual CTA event, checks correlation headers and idempotent duplicate handling. |
| Conversion attribution | Production-mode HTTP E2E verifies unauthorized conversion rejection, authenticated conversion ingestion with first/last-touch campaign context, correlation headers and idempotency. |
| AI safety/fallback | AI package tests validate structured outputs and deterministic quality behavior; application behavior leaves manual workflows available when no provider is configured; AI never publishes directly. |
| Public performance | Lighthouse runs against the production-built representative SkillUp page and enforces Performance >= 90, Accessibility >= 90, SEO >= 95, LCP <= 2.5s, CLS < 0.1 and TBT <= 200ms as the lab responsiveness proxy. |
| Code security analysis | CodeQL JavaScript/TypeScript workflow must pass. |
| Operability | Admin/Web health endpoints, structured logs, correlation IDs, audit records and optional error-alert webhook are part of the release build. |

Lighthouse cannot provide production field INP. The P0 target remains INP < 200ms. CI uses TBT <= 200ms plus real browser interaction checks as the deterministic laboratory guardrail; after production traffic exists, INP is verified using Web Vitals/RUM.

## P0 production-like release scenario

The deterministic CI fixture intentionally models the end-to-end acquisition workflow without relying on external paid-traffic, OAuth, payment or hosting accounts.

1. **Brand and campaign configuration** — the clean database is migrated, then the disposable fixture creates independent SkillUp and Jalwa brands/domains and a SkillUp TikTok acquisition campaign with offer and UTM defaults. Admin mutation code is separately protected by server-side RBAC and covered by the completed feature issues.
2. **Page creation/authoring** — the fixture contains schema-valid pages/template versions that use the same page engine as pages produced by Admin. Unit coverage verifies template instantiation, page editing contracts, assets and AI structured changes.
3. **Preview/publish/versioning** — immutable page versions and publication pointers are created through the same schema/integrity rules used by Admin. Issue #9's publish/rollback implementation remains part of the production build; #15 adds audit records and correlated operational reporting around those mutations.
4. **Public mobile resolution** — production-built Web serves SkillUp and Jalwa from their configured host/path mappings. Playwright validates mobile rendering, CTA usability, canonical metadata, robots and experiment QA behavior.
5. **Tracked acquisition and downstream conversion** — CI sends a real HTTP `cta_click` event through `/api/events`, then a real server-authenticated `subscription_started` conversion through `/api/conversions` with first-touch/last-touch campaign attribution. Duplicate requests prove idempotency.
6. **Metrics** — the seeded production-like funnel is reconciled directly in PostgreSQL and analytics aggregation behavior is unit-tested. The Admin analytics dashboard consumes those same stored events/conversions and aggregation contracts.
7. **Variant testing** — the seeded experiment has two valid page versions and a 50/50 allocation; deterministic tests verify assignment, and browser QA forces variant B without creating indexable duplicate content.
8. **Safe rollback** — page publication is an atomic pointer to an immutable version, protected by the page/version ownership constraint and advisory-lock/optimistic checks in the Admin mutation. Rollback is audited and does not mutate the historical version. The release runbook specifies page rollback as the first-line content recovery mechanism.

## P0 Definition of Done reconciliation

The repository satisfies the master P0 requirements as follows:

- new brands/domains are database configuration, not code branches;
- internal users are allowlisted and assigned Owner/Admin/Editor/Analyst roles;
- editors create or duplicate pages from schema-driven templates without writing code;
- supported text, media references, CTAs, SEO and layout/block options are editable from Admin;
- page preview, immutable versions, publish, unpublish and rollback are implemented;
- pages can carry brand, campaign, experiment/variant and asset associations;
- campaign UTM context and first/last-touch attribution persist into downstream conversion records;
- analytics compare the acquisition hierarchy using stored events and conversions;
- AI creates bounded schema-validated drafts/suggestions and cannot bypass the explicit human publish workflow;
- public rendering is shared across brands, server-first, mobile-first and subject to browser/Lighthouse gates;
- CI, CodeQL, audit logging, structured error reporting, readiness checks and the production runbook form the P0 operations gate.

## What CI deliberately does not fake

The following are infrastructure activation tasks, not missing application code:

- binding the repository to the final Vercel Admin/Web projects;
- entering production database, OAuth, Blob, AI and conversion-ingestion secrets;
- attaching real custom domains and changing DNS;
- configuring the external alert receiver for `ERROR_ALERT_WEBHOOK_URL`;
- validating production field INP after meaningful real-user traffic exists;
- confirming the actual downstream subscription/payment service sends the documented conversion payload using the production bearer secret.

Those steps are performed using `docs/production-runbook.md` after the required accounts/credentials/domains are available. They must not be simulated with fake production credentials merely to make CI green.
