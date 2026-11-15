# GrowthOS V2 — Release evidence and acceptance (15 November 2026)

**Scope:** The user currently treats GrowthOS as a testing environment. This report distinguishes source-code acceptance, deployed infrastructure, staged user workflows, and *real commerce/provider certification*. Do not interpret a draft PR, Vercel `READY`, a screenshot, or a mocked provider as permission to go live.

## 1. Immutable baseline

| Resource | Verified identity |
| --- | --- |
| GitHub source | [waseem99/growth-os](https://github.com/waseem99/growth-os) |
| Production/default Git `main` | `660b7fb270712bdc75681a3469cbe69439b5f8a1`, **not merged, not protected** |
| V2 feature | [draft PR #49](https://github.com/waseem99/growth-os/pull/49); includes the dependency patch history from security [draft PR #51](https://github.com/waseem99/growth-os/pull/51) |
| Deploy branch | `deploy/cod4-growthos-20261113`, deployed SHA `84521d5c2d122dbc32725bbc5544c6fc4e8737f8` |
| Test team | Vercel Cod 4 / `cod-5` |
| Admin project | `prj_1t1v7A0qzQ4AY9IcRwVUwyn6MKVZ`; https://growth-os-admin-cod-5.vercel.app |
| Web project | `prj_RyNe7rXDoo3HjE4Pm13iEG3DSPTt`; https://growth-os-web-cod-5.vercel.app |
| Test database | Neon `super-leaf-36879390`, branch `br-soft-pine-b36ucy54`, schema 0001–0008 |
| Original database | Neon `br-young-night-b3mukube` / `main`, schema 0001–0005 — do not change |
| Content storage | Vercel Blob attached to the Admin test project. Actual authenticated upload not yet certified |
| Provider dispatch | `GROWTHOS_PROVIDER_DELIVERY_ENABLED=false` on Web; no paid Meta/TikTok provider test receipt |

**Security lineage:** The nine dependency manifests and lockfiles in the V2 feature tree are byte-identical to security PR #51, so the patched Next/Zod baseline is represented in PR #49. They are **not yet applied to default `main`**; security issue #50 and release gate #54 must remain open.

## 2. Verified observations, with precise limits

| Area | Result | Evidence |
| --- | --- | --- |
| Vercel Admin/Web builds and health | **PASS** on deploy SHA above | Both projects `READY`; both `/api/health` HTTP 200 |
| BizB test landing | **PASS** | `/sell` and Meta source UTM render; invalid package and duplicated UTM fail closed |
| Owner account and protected screens | **PASS (read-only)** | Authenticated Owner reached Brands, Campaigns, Packages, Pages, Variations, Assets, Analytics, Tracking Rules, Audit and Users without browser page exceptions |
| Unauthenticated access restrictions | **PASS** | Protected management URLs render sign-in rather than exposing controls |
| Brand/campaign/package/page/version workflows | **PASS in disposable CI** | [CI run 43455013089](https://github.com/waseem99/growth-os/actions/runs/43455013089) — 22 Playwright tests, including owner + analyst |
| Role-based restrictions | **PASS in disposable CI** | Analyst management controls denied, analytics remains accessible; no second live Cod4 Analyst identity was used |
| Asset upload and registration | **NOT VERIFIED live** | Blob configured; no authenticated upload → blob `head()` → registered record proof |
| Real downstream payment | **NOT VERIFIED** | [SkillUp draft PR #260](https://github.com/SkillStep/skillup-platform/pull/260) with green CI, but no signed merchant sandbox transaction |
| Deployed first-party conversion endpoint | **PASS for synthetic non-payment event** | 401 bad token; 400 invalid brand/package; 201 accepted; 200 duplicate |
| Deployed conversion count | **PASS, no false revenue** | 1 test-only `signup_complete`; `testTraffic=true`; `value=NULL`; zero provider deliveries; reportable revenue = 0 |
| Meta/TikTok provider callbacks | **NOT VERIFIED** | Transport implemented and disabled; actual provider Test Events receipts not provided |
| Analytics aggregate/date report | **PASS in prior CI** | Fixed PostgreSQL Date serialization; typed filters and role access |
| Variation analytics reconciliation | **New feature-branch validation** | Exclude test-traffic events; display conversion-only records when browser landing view absent; dedicated E2E regression added |
| Mobile/performance | **PASS on prior feature SHA** | [run 43455013089](https://github.com/waseem99/growth-os/actions/runs/43455013089): Lighthouse performance 99, accessibility 100, SEO 100, TBT 44 ms |
| Main GitHub protection | **BLOCKED on connector permissions** | `GET /rulesets` returned `[]`, `main.protected=false`; repository admin must enable an active ruleset |

**Evidence discipline:** The final new variation-analytics CI result must be recorded against its *exact feature SHA* before this change is considered accepted. Never substitute the previously green run from a different SHA. The seeded CI stores synthetic conversions and tests approval boundaries, not a paid financial receipt.

## 3. Analytics reconciliation

From a read-only query on the **isolated Cod4 database branch**, the conversion table contained **1 total conversion, 1 synthetic/test conversion, 0 reportable conversions, 0 reportable revenue**, and the delivery queue contained **0 provider jobs**. This is consistent with the single successful synthetic API test and must not be reported as business performance. A test event without a verified product signup is never a real conversion.

## 4. Still necessary before closing V2

1. Complete and review the updated feature-branch CI checks for all latest commits.
2. Prove live **asset-upload + registration** with a signed-in Cod4 test operator and inspect the blob and database record without PII.
3. Run two-product, end-to-end Admin → public page → checkout or registration **acceptance** with approved content and data.
4. Get one **real provider-signed SkillUp sandbox transaction**, approve actual monthly/yearly prices vs GrowthOS package codes, and reconcile exactly one GrowthOS conversion.
5. Collect real Meta/TikTok Events Manager test receipts using consented matching metadata before considering dispatch enablement.
6. Configure **GitHub `main` branch protection** and obtain independent approval. The current GitHub connector cannot create admin rules.
7. Sign off on access restrictions, backup/recovery, evidence pack, release SHA, rollout and rollback.

## 5. Release decision

**NOT READY for an unrestricted live release.** Code and isolated test infrastructure are substantially implemented; product/provider/payment tests, live upload evidence and repo-admin protection are outstanding. Do not merge PR #49 or PR #51 into `main` just to clear this checklist. In the current Vercel topology a GitHub merge may start automatic builds, and Admin build can invoke schema migrations.

Related: [Epic #48](https://github.com/waseem99/growth-os/issues/48), [checkout/provider #53](https://github.com/waseem99/growth-os/issues/53), [release controls #54](https://github.com/waseem99/growth-os/issues/54).
