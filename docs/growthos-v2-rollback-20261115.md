# GrowthOS V2 — Test deployment rollback and recovery (15 November 2026)

**Applies to:** Vercel team `cod-5`, projects `growth-os-admin` and `growth-os-web`, Neon branch `br-soft-pine-b36ucy54` **only**. This is a procedure for an authorized operator, not a record of a rollback being executed. Do not perform these steps on the original Neon `main` or legacy brand domains.

## Before any deployment

1. Record feature SHA, deploy SHA, CI workflow URLs, exact `DATABASE_URL` target **by branch ID only**, active Vercel aliases, and both current READY deployment IDs. Store credentials only in Vercel environment settings.
2. Confirm both applications use the **same test database branch** and the Web provider dispatch variable remains `false`.
3. Confirm current schema and list migrations using **read-only** SQL:

```sql
SELECT version FROM growthos_schema_migrations ORDER BY version;
SELECT current_database(), current_schema();
```

4. Confirm Admin and Web `/api/health` are HTTP 200 and check representative public pages (`/sell`), canonical metadata, dynamic query rejection and sign-in restriction.
5. Reserve a testing window, keep a previous READY Vercel deployment accessible, and document who is authorized to perform rollback. A Vercel `READY` build alone does not certify release behavior.

## Application rollback if new test candidate fails

1. **Stop traffic promotion**, revoke any unreviewed feature flags or provider dispatch toggles. Never enable paid Meta/TikTok sends to debug a broken rollout.
2. In **Vercel → Cod4 → growth-os-admin → Deployments**, choose the previous known-good **Production-target** deployment and promote/rollback it. Repeat for `growth-os-web`. Do not promote an unrelated Preview build with different env variables.
3. Current Cod4 test deployments were promoted at SHA `71e7aa963b4b555b7022c7cdba22cf318dab92b7` (Admin `dpl_FnhEoGq96VNno9G657nDg9MhzEhu`, Web `dpl_3xn3xtLFnHpM79uvTo6tTUjuJc5q`), both READY on 15 Nov. Earlier known-good fallback SHA `84521d5c2d122dbc32725bbc5544c6fc4e8737f8` is available from earlier deployments; verify its precise READY deployment IDs in Vercel before rollback. Do not assume those are active aliases.
4. Re-run both health routes, Owner login, BizB `/sell`, safe invalid-package/UTM cases and a **test-only** conversion callback. Confirm no provider dispatch or new real revenue. Keep the project protected by Vercel Authentication.
5. If automatic Git integration keeps deploying the wrong code, restore the operator-approved branch/ref under a reviewed PR and verify the Vercel production-branch and Ignored Build Step settings. **Do not force-push GitHub `main`**; its history is a separate release boundary.

## Database recovery

- The V2 migrations 0006–0008 are additive. A code rollback **does not** automatically roll back PostgreSQL. Old code compatibility must be checked against the newer schema in CI before promotion.
- **Never execute a blanket `DROP TABLE` or destructive down-migration** to resolve an application issue. Capture a branch snapshot / point-in-time restore plan first and obtain DB administrator authorization for irreversible actions.
- For a damaged **Cod4 test branch**, coordinate a new isolated Neon branch from an approved test snapshot, review whether its source may contain private records, apply migrations and move both Admin/Web DB env vars *together*. Redeploy both after changing secrets. Keep the original Neon `main` untouched.
- If a saved Blob object exists but its database asset registration failed, use a reviewed reconciliation flow. Do not delete production blobs to clear QA artifacts.

## Conversion/provider incident response

- Set Web `GROWTHOS_PROVIDER_DELIVERY_ENABLED=false` and disable the product-side SkillUp relay before adjusting provider credentials. Restart/redeploy only where necessary to apply env changes.
- Check canonical conversion IDs and stable idempotency keys; inspect `conversion_provider_deliveries` states without logging raw matching data or secrets.
- Distinguish **pending**, **delivered**, **blocked** and **retried** outcomes. A provider HTTP 200 is not sufficient evidence without Meta/TikTok accepted event receipts.
- A fresh callback for an already processed payment must resolve as **duplicate**, not create a second conversion or charge.
- Compare against the **product** verified payment/subscription or seller-registration record, not an advertising URL or redirect query string.

## Recovery acceptance

Rollback is complete only when deployment IDs, exact SHAs, both health tests, public render, Admin auth, audit trail and first-party conversion duplicate behavior are re-verified and logged. Re-open any incomplete acceptance issue rather than marking it passed. The runbook does not itself authorize a production alias change, billing operation, database deletion or provider event send.

Related: [release evidence](./growthos-v2-release-evidence-20261115.md), [handover](./growthos-v2-operator-handover-20261115.md), [release controls #54](https://github.com/waseem99/growth-os/issues/54).
