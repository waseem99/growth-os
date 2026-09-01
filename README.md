# GrowthOS

Internal multi-brand acquisition and landing-page operating system for SkillUp, Jalwa, Game Arena, Bizly Medan, and future products.

GrowthOS is intentionally **not** a general-purpose visual website builder. It uses controlled, schema-driven landing-page components so the growth team can move quickly while public pages remain fast, consistent, measurable, and safe.

## Repository structure

```text
apps/
  admin/       Internal operations portal (Next.js)
  web/         Public landing-page renderer (Next.js)
packages/
  config/      Shared validated runtime configuration only
```

The public renderer must never depend on admin-only code. Shared packages should be introduced only when both applications genuinely need the same contract or behavior.

## Requirements

- Node.js 24+
- npm 11+

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev:admin
# in another terminal
npm run dev:web
```

Admin: http://localhost:3001  
Public renderer: http://localhost:3000

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright requires browser binaries locally:

```bash
npx playwright install chromium
```

## Environment configuration

Environment values are validated through `@growth-os/config`. `.env.example` documents public local defaults. Secrets must never be committed. Database, auth, storage, analytics, and AI credentials will be added only in the issues that introduce those capabilities.

## Delivery plan

The implementation backlog and final definition of done live in [Issue #1](https://github.com/waseem99/growth-os/issues/1). Work proceeds in dependency order with small issue-scoped PRs and tests included in the same change.

Current foundation issue: [#2](https://github.com/waseem99/growth-os/issues/2).
