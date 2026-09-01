# GrowthOS AI authoring

GrowthOS treats AI as an assistant inside the same schema/publishing boundaries used by manual editing. AI never receives a mechanism to publish a page, execute arbitrary code, change payment integrations or bypass page validation.

## Capabilities in P0

- Generate a new editable page draft from a structured product/campaign brief.
- Rewrite textual fields in one existing block while preserving block identity/configuration.
- Generate 2–3 alternative hero/CTA positioning variants for explicit human application.
- Suggest SEO/social metadata.
- Suggest FAQ content grounded in supplied page/campaign context.
- Suggest asset title, tags and alt text from supplied file/context metadata.
- Run deterministic pre-publish quality checks without an external AI provider.

## Provider boundary

`@growth-os/ai` defines a provider-independent `AiProvider`. The current production adapter uses a structured JSON response contract; the model/provider is selected by environment configuration rather than editor code.

Required for model-assisted features:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- optional `OPENAI_BASE_URL`

No provider credential is stored in the database, page JSON, integration public configuration or browser bundle.

If AI is not configured or fails, manual page/asset workflows continue normally and deterministic page-quality checks remain available.

## Validation and safety model

1. GrowthOS sends only necessary brand/campaign/page/asset context. Integration secrets and payment credentials are not included.
2. Each AI action has a small Zod output schema.
3. Provider output is validated. One bounded repair attempt is allowed for invalid structured output.
4. GrowthOS composes/updates the real `@growth-os/page-engine` document itself.
5. The resulting page/block/SEO schema is validated again.
6. Suggestions are stored in `ai_jobs` with action/provider/model/status, target, latency/usage metadata and originating draft revision.
7. For an existing page, a human must click **Apply**. Apply is rejected if the page draft revision changed after the suggestion was created.
8. Applying a suggestion only updates the draft. Preview/publish remains the normal explicit publishing workflow.

### Copy rewrite boundary

Block rewrite suggestions may alter only whitelisted string-copy paths. They cannot change block ID/type/version, visibility, variant, payment provider, link target or asset references.

### Asset metadata boundary

P0 supplies filename/MIME/dimensions/current metadata and marketer-provided context. It does not claim the model visually inspected the media pixels. True multimodal asset analysis can be added behind the same structured contract later.

## Quality assistant

The quality checker is deliberately deterministic and provider-independent. It checks schema validity, hero/CTA presence, weak/generic CTAs, subscription consent/disclosure, metadata completeness, referenced-asset alt metadata, duplicate longer copy and FAQ coverage. Findings are field-linked and scored for prioritization; they do not block manual editing.

## CI

Standard CI never requires an external model or API key. `MockAiProvider` tests valid output, one bounded repair path, safe block rewrites, variant application, page composition and deterministic quality findings. Live provider verification belongs to deployment configuration, not the repository quality gate.
