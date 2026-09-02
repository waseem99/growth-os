# GrowthOS P0 production runbook

This runbook covers the two GrowthOS deployables (`apps/admin` and `apps/web`), their shared PostgreSQL database, Vercel Blob asset storage, Auth.js/Google OAuth, conversion ingestion, optional AI authoring and the P0 observability controls.

## 1. Environment topology

Use separate Preview and Production environments. Both applications point at the same environment-specific database and asset store, but Preview must never point at the Production database or Production Blob token.

Deploy the monorepo as two applications/projects:

- **GrowthOS Admin**: internal application from `apps/admin`; no public registration; access is controlled by the database allowlist and RBAC.
- **GrowthOS Web**: public landing-page renderer from `apps/web`; custom campaign/brand domains point here.

The database is the source of truth for brands, domains, campaigns, pages, published versions, experiments, analytics, conversions, audit logs and AI job metadata. Vercel Blob stores campaign media; the database stores the media metadata and references.

## 2. Required configuration

Configure these variables in the hosting environment. Do not commit real values.

| Variable | Admin | Web | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | required | required | Environment-specific PostgreSQL connection string. |
| `AUTH_SECRET` | required | no | At least 32 random characters; rotate deliberately. |
| `GOOGLE_CLIENT_ID` | required | no | Google OAuth client for the admin environment. |
| `GOOGLE_CLIENT_SECRET` | required | no | Secret, server-only. |
| `NEXT_PUBLIC_ADMIN_URL` | recommended | optional | Canonical admin origin. |
| `NEXT_PUBLIC_WEB_URL` | optional | recommended | Base public origin when applicable. |
| `BLOB_READ_WRITE_TOKEN` | required for uploads | no | Server-side Vercel Blob credential. |
| `CONVERSION_INGEST_SECRET` | no | required for conversion ingestion | Long random bearer secret shared only with trusted downstream server systems. |
| `ERROR_ALERT_WEBHOOK_URL` | optional | optional | JSON webhook receiver for basic production error alerts. Do not point this directly at an incompatible webhook format. |
| `AI_PROVIDER` | optional | no | `openai` for P0 AI authoring. |
| `OPENAI_API_KEY` | optional | no | Server-only. Manual workflows and deterministic quality checks work without it. |
| `OPENAI_MODEL` | required when AI is enabled | no | Structured-output-capable model configured by operations. |
| `OPENAI_BASE_URL` | optional | no | Defaults to the OpenAI API base URL. |
| `ALLOW_DEMO_SEED` | normally unset/`0` | normally unset/`0` | Set to `1` only for an intentionally disposable remote preview/demo database. Never enable for Production. |

No secret may use a `NEXT_PUBLIC_` prefix. Public integration IDs such as analytics/pixel identifiers are stored as public integration configuration; API keys and bearer secrets are not.

## 3. Initial production deployment

1. Provision a managed PostgreSQL database with automated backups/PITR enabled.
2. Provision the production asset store and obtain the Blob write token.
3. Create the Admin and Web hosting projects from the same repository and configure the environment variables above.
4. Configure Google OAuth callback/origin values for the final admin hostname.
5. Before starting either application against the new database, run from the exact release commit:

   ```bash
   npm install
   npm run db:migrate
   npm run db:verify:schema
   ```

6. **Do not run `npm run db:seed` in Production.** The seed command refuses non-local databases unless `ALLOW_DEMO_SEED=1`, and Production data must be created through GrowthOS admin workflows.
7. Deploy Admin and Web from the same release commit.
8. Confirm both readiness endpoints return HTTP 200:

   ```text
   https://<admin-host>/api/health
   https://<web-host>/api/health
   ```

9. Add the initial owner/admin email through the intended bootstrap/allowlist procedure, sign in, and configure the first real brand/domain/campaign.
10. Point campaign/brand DNS to the Web project only after the corresponding GrowthOS domain is configured and verified.

## 4. Preview deployment

Preview uses its own database and storage token. Apply migrations with `npm run db:migrate` and verify with `npm run db:verify:schema` before functional testing.

A disposable preview database may be populated with the deterministic SkillUp/Jalwa fixtures only by explicitly setting `ALLOW_DEMO_SEED=1`, then running:

```bash
npm run db:seed
npm run db:verify
```

Never share Preview OAuth secrets, conversion secrets, AI keys, database URLs or Blob tokens with Production.

## 5. Release procedure

A release is eligible for Production only when the release commit has:

- CI green: production dependency audit, lint, strict TypeScript, unit tests, all migrations, production-safe schema verification, seeded DB reconciliation, production builds and production-mode Playwright E2E.
- CodeQL JavaScript/TypeScript analysis green.
- Lighthouse mobile release gate green on the representative SkillUp acquisition page: Performance >= 90, Accessibility >= 90, SEO >= 95, LCP <= 2.5s, CLS < 0.1 and TBT <= 200ms as the deterministic lab responsiveness proxy.
- No unresolved known Critical/High GrowthOS-owned security defect.
- A review of environment-variable changes, migration changes and domain changes.

Lighthouse cannot produce trustworthy field INP. The release target remains INP < 200ms; validate that from production Web Vitals/RUM once traffic exists. Until field volume is meaningful, the CI TBT budget plus interaction E2E is the lab guardrail.

## 6. Database migrations

Migrations are ordered SQL files under `packages/db/migrations` and are recorded in `growthos_schema_migrations`. `npm run db:migrate` executes each unapplied migration once inside a transaction.

Before a production migration:

1. Confirm the database backup/PITR window is healthy.
2. Review the migration for locks, data rewrites and destructive statements.
3. Prefer expand/contract changes: add compatible schema first, deploy code using it, and only remove old fields in a later release.
4. Run `npm run db:migrate` exactly once from the release commit.
5. Run `npm run db:verify:schema`.
6. Deploy applications only after verification succeeds.

The P0 migrations are intended to be forward-compatible/additive. Do not attempt to "undo" a migration by deleting its row from `growthos_schema_migrations`.

## 7. Rollback

### Application rollback

If a release causes an application regression but the database remains healthy, promote/redeploy the previous known-good Admin and Web deployment from the same prior commit. Because schema migrations are forward-only, confirm the previous application is compatible with the current schema before promotion. P0 migrations are additive specifically to keep this practical.

### Page/content rollback

For campaign-content mistakes, do **not** roll back the whole application. Use the page Publishing screen to select a previously published immutable `page_version` and execute rollback. The publication pointer changes atomically and is audited. If necessary, unpublish the page to remove it from public resolution.

### Database rollback/restore

Use database restore only for data corruption or an unrecoverable migration/data incident. Restore from the managed provider's snapshot/PITR into a new database first, validate it, then switch application connection strings. Avoid destructive in-place restoration when a side-by-side restore is available.

## 8. Backup and restore expectations

### PostgreSQL

Production must have provider-managed automated backups/PITR. Retention is an infrastructure decision but must cover at least the operational recovery window agreed by the team. A restore drill should be performed periodically against a non-production environment and should include `npm run db:verify:schema` plus a representative page-resolution test.

### Assets

Blob objects are external to PostgreSQL. A database restore can restore asset references but cannot recreate a blob that was separately deleted. P0 therefore avoids routine destructive asset deletion. Keep provider retention/versioning where available and treat asset deletion as an explicit operational action. During restore verification, sample published page assets and confirm the referenced URLs still resolve.

## 9. Observability and alerting

The public ingestion endpoints emit structured JSON logs with service, level, event, request/correlation ID and bounded diagnostic metadata. Public failures can be routed to `ERROR_ALERT_WEBHOOK_URL`; payloads intentionally exclude incoming request bodies and secrets.

Use the request/correlation ID as the primary join key when investigating ingestion failures. Admin audit records also keep correlation IDs where practical so operational events can be traced back to privileged changes.

Health/readiness endpoints validate that the application process can reach required infrastructure. A failing health endpoint is a deployment/availability signal, not a substitute for application-level monitoring.

Recommended hosting alerts:

- elevated 5xx rate on Admin or Web;
- failing `/api/health`;
- repeated `analytics_ingest_failed` / `conversion_ingest_failed` events;
- repeated authentication failures or unexpected RBAC denials;
- database connection saturation/errors;
- error-alert webhook delivery failures.

## 10. Incident response

1. Capture the affected hostname/path, approximate time and request/correlation ID if available.
2. Check Admin/Web `/api/health` and hosting runtime logs.
3. Determine whether the failure is application, database, asset storage, OAuth, AI provider, conversion source or DNS/domain related.
4. Contain blast radius:
   - pause the affected campaign/experiment;
   - unpublish a broken page;
   - disable an integration;
   - leave AI disabled if the provider is failing (manual page operations remain available);
   - rotate a compromised secret immediately.
5. Roll back page content or application deployment using the procedures above.
6. For database/data incidents, restore side-by-side and verify before switching traffic.
7. Record the incident, root cause, affected release and corrective action.

## 11. Secret rotation

Rotate credentials one at a time and verify health after each change. For `CONVERSION_INGEST_SECRET`, coordinate the change with downstream senders; there is no dual-secret grace mechanism in P0. For OAuth credentials, update both Google configuration and hosting variables before invalidating the old secret. For `AUTH_SECRET`, expect existing sessions to become invalid.

## 12. Domain cutover

Before DNS cutover:

- domain exists under the correct brand in GrowthOS;
- status is verified and the intended primary/campaign mapping is correct;
- page is published and resolves in Preview/production host testing;
- canonical URL is correct;
- sitemap/robots behavior is correct;
- analytics and conversion ingestion are verified;
- SSL/TLS is ready at the hosting provider.

After cutover, verify mobile rendering, CTA flow, analytics event receipt and downstream conversion attribution before scaling paid traffic.
