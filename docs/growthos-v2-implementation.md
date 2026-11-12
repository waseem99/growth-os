# GrowthOS V2 — Multi-product dynamic campaign implementation

**Tracking issue:** https://github.com/waseem99/growth-os/issues/48

## Product contract

GrowthOS remains the centrally managed, schema-driven landing-page, tracking and analytics portal.
Each product has its own brand, hostname, published default landing page, offer catalog, approved checkout destination and measurement configuration.

A marketing operator must be able to:
1. Select an existing product/default landing page.
2. Upload or select a campaign banner in the existing asset library.
3. Assign an immutable variation code such as `ranchers`.
4. Associate an approved product-specific package code such as `1` with an offer version.
5. Preview and publish a variation without a code deployment.
6. Generate `/landing?utm=M&package=1&parameter=ranchers` and standard UTM equivalents.
7. Observe views, clicks and backend-confirmed conversion results without double counting.

No landing-page URL parameter is authority to change checkout pricing. The downstream product backend must validate the package/price and report a successful event server-to-server.

## First slice in this PR

- `0006_dynamic_campaigns.sql` creates additive product package and variation tables, immutable version rows and a publication pointer.
- Product/package codes are unique within a product; variation codes are unique within a page.
- The variation's brand/page ownership and published version ownership are enforced in PostgreSQL.
- New tables are empty and inactive by default; this changes **no existing production content** or route behavior.
- `parseCampaignParameters` rejects duplicate/invalid/conflicting selections and understands the client's `utm=M` Meta shorthand and proposed `utm=T` TikTok shorthand alongside `utm_source`.
- Regression unit tests cover source normalization, injection attempts, duplicates and defaults.
- Schema verification checks the migration and ownership constraints.

## Security and next slices

**Before activation**:
- Verify offered `offerVersionId` belongs to the selected brand; validate banner asset ownership before publishing. Do not accept cross-tenant identifiers.
- Add product-scoped allowlisted checkout destinations, not arbitrary redirects.
- Implement admin creation/edit/publish/rollback with RBAC, draft revision guards and audit.
- Implement server-side published configuration selection and cache invalidation.
- Explicit variation codes take precedence over randomized experiments; forced experiment QA remains noindex.
- Handle invalid package as **unavailable/no checkout** and unknown variations as a safe default, never another brand's creative.
- Extend analytics context with immutable variation/package/configuration identifiers.
- Implement per-product Meta/TikTok public pixel loading, approved events, consent, diagnostics and trusted server-side conversion relay. A successful Subscribe/Purchase must never fire from URL load or from a CTA click alone.
- Use isolated staging Vercel, Neon and Blob; **no production migrations or deployment until approved**.

## Developer release gate

1. Apply migration to isolated staging DB and verify schema.
2. Run `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` and check CI/CodeQL.
3. Create SkillUp and a second product in staging, with independent code/asset/price scopes.
4. Prove `utm=M&package=1&parameter=ranchers`, TikTok equivalent, invalid/missing query fallback and duplicate protection.
5. Verify backend-confirmed conversion, Meta/TikTok test events, idempotency and dashboard reconciliation.
6. Share staging SHA, links, test evidence, walkthrough recording and explicit production-ready signoff.

This PR is deliberately the **foundation**, not a claim that the entire client workflow is already finished.
