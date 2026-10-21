# Commented .env.example template

Copy this shape. One line of comment per variable: what it is, where to get it, required or optional, fake example. Values stay empty or visibly fake. Adapt the sections to what the code really reads.

```bash
# =============================================================================
# <project-name> environment. Copy to .env and fill the values (never commit .env).
# Format of each entry: what it is | where to get it | required/optional | example
# =============================================================================

# ---------- App ----------
# Runtime mode | set by you | required | development
NODE_ENV=development
# Public base URL of this app | your domain or localhost | required | http://localhost:3000
APP_URL=
# Secret used to sign sessions | generate with: openssl rand -hex 32 | required | 3f9c...fake
SESSION_SECRET=

# ---------- Database ----------
# Connection string | your DB provider dashboard, prefer a read-only role for agents | required | postgres://user:pass@localhost:5432/app
DATABASE_URL=

# ---------- Cloudflare (deploy and remote data) ----------
# Account id | https://dash.cloudflare.com (right sidebar of any zone) | required for deploy | 0123456789abcdef0123456789abcdef
CLOUDFLARE_ACCOUNT_ID=
# API token scoped to this project | https://dash.cloudflare.com/profile/api-tokens | required for deploy | cf_fake_token
CLOUDFLARE_API_TOKEN=

# ---------- Payments ----------
# Secret key | provider dashboard > developers > API keys, use the test key locally | required | sk_test_xxx
PAYMENTS_SECRET_KEY=
# Webhook signing secret | provider dashboard > webhooks | required in prod | whsec_xxx
PAYMENTS_WEBHOOK_SECRET=

# ---------- Email ----------
# API key | email provider dashboard > API keys | optional (emails are skipped when empty) | re_xxx
EMAIL_API_KEY=

# ---------- Observability ----------
# Log platform token with query-only scope | log provider settings > API tokens | optional | xapt-fake
LOGS_QUERY_TOKEN=
# Error tracking DSN | error tracker project settings | optional | https://key@o0.ingest.example.com/0
ERROR_TRACKER_DSN=

# ---------- Feature flags ----------
# Enables the new checkout | set by you | optional, default false | true
FEATURE_NEW_CHECKOUT=false
```

## Variants

- Cloudflare Workers local dev: same entries in `.dev.vars.example`; secrets uploaded with `wrangler secret put NAME`, public config in `[vars]` of the wrangler config (mark it `public` in the comment).
- direnv: use `export NAME=` lines in `.envrc.example`.
- Monorepo: one example per package that owns a runtime, plus a root example for shared tooling variables.

## Checklist before committing the example

- Every variable read by the code is present, grouped, with a comment.
- No real value, hostname or token anywhere in the file.
- The real file is in `.gitignore`; the example is not.
