# Crux Pass — Claude Code Project Guide

## What this project is

**Crux Pass** is a prepaid/pay-as-you-go gym entry marketplace, Kerala-first. Users pay per visit or subscribe monthly. Gyms set their own pricing and receive weekly settlements. QR check-in with photo verification is the core trust mechanism.

Repo folder: `rexpass/` (the product name is Crux Pass; keep that in all user-facing copy).

Full PRD and technical spec: `/Users/shaheen/Downloads/deep-research-report.md`

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ App Router, TypeScript |
| Auth | Supabase Auth (email OTP, cookie-based sessions via `@supabase/ssr`) |
| Database | Supabase Postgres + RLS |
| Storage | Supabase Storage (user photos, gym logos) |
| Realtime | Supabase Realtime `postgres_changes` (gym dashboard check-in queue) |
| Payments | Razorpay (primary); Cashfree listed as fallback |
| Hosting | Vercel (Hobby plan is fine for MVP) |
| Cron | Vercel Cron Jobs (configured in `vercel.json`) |
| Monitoring | Sentry |
| Testing | Vitest (unit), Playwright (E2E) |

---

## Project structure

```
app/
  (public)/           # User-facing pages (landing, gyms, checkout, check-in)
  gym/                # Gym staff/admin dashboard pages
  admin/              # Platform admin pages
  api/v1/             # All API route handlers
lib/
  supabase/           # client.ts, server.ts, rls-helpers.ts
  pricing/            # calc.ts — fee math
  security/           # rate-limit.ts, webhook-verify.ts
  settlements/        # run.ts, csv.ts
supabase/
  migrations/         # SQL migration files
  seed.sql
vercel.json
.env.example
```

---

## Key conventions

### Auth and roles
- Always use **cookie-based Supabase sessions** (SSR-safe). Never use `localStorage` for auth tokens.
- Roles: `user`, `gym_staff`, `gym_admin`, `platform_admin`. Stored in `profiles.role` — never in `raw_user_meta_data` (user-editable and unsafe for authorization).
- Server routes that require a specific role must verify role from DB, not from JWT claims alone.

### API conventions
- Base path: `/api/v1`
- All errors return: `{ "error": { "code": "STRING", "message": "STRING", "details": {} } }`
- Auth: Supabase JWT via cookies. Public endpoints (gym discovery, gym detail) require no auth.
- Webhooks and cron routes use separate secrets (`RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`).

### Database rules
- **RLS enabled on every table**. Use service role key only in server routes for webhooks, cron, and admin ops.
- Store **computed pricing amounts** on every `orders` row (never recompute from current config for settled orders).
- **Single active check-in** enforced via partial unique index: `checkins(user_id) WHERE status='PENDING'`.
- Consent tables (`consents`, `consent_events`) are append-only; gyms never read them directly — leads endpoint enforces consent server-side.

### Pricing math (always use this formula)
```
platform_fee = round(gym_price_paise * bps / 10000)
gst          = round(platform_fee * gst_rate_bps / 10000)
total        = gym_price_paise + platform_fee + gst
```
Default `bps = 1000` (10%), subscriber `bps = 500` (5%), `gst_rate_bps = 1800` (18%).

### Payments (Razorpay)
- **Always verify `razorpay_signature`** using HMAC SHA256 of `razorpay_order_id|razorpay_payment_id` with `RAZORPAY_KEY_SECRET`.
- **Webhook validation**: use raw request body (do NOT parse/re-serialize before verifying `X-Razorpay-Signature`).
- Store `raw_webhook` jsonb on `payments` for disputes.
- Subscribe to: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`.

### Check-in flow
1. User pays → `POST /checkout/verify` marks order PAID.
2. `POST /checkin/start` creates `checkins(status=PENDING, expires_at=now+90s)`.
3. Gym dashboard receives Realtime event, shows user photo + countdown.
4. Staff clicks Approve → `POST /checkins/:id/confirm` sets `status=APPROVED`.
5. Token expires in 90s → cron cleanup sets `EXPIRED`.

### Settlements
- Holdback: `approved_at <= now() - INTERVAL '3 days'`
- Use advisory lock `pg_advisory_lock` to prevent double-run.
- Output CSV grouped by `gym_id` (see PRD for column list).
- Cron schedule: `0 4 * * 1` (Monday 04:00 UTC).

### Security rules
- Rate limit `POST /checkin/start`: max 5 per 5 min per user.
- Reject webhook replays: store `event_id` in `audit_logs`.
- Fraud flags (flag, do not auto-ban): >3 check-ins in 60 min across gyms, >5 rejects in 7 days, >2 refunds in 30 days. Store in `profiles.fraud_flags jsonb`.

---

## DB tables (complete list)

`profiles`, `gyms`, `gym_price_windows`, `gym_caps`, `gym_users`, `consents`, `consent_events`, `orders`, `payments`, `checkins`, `checkin_tokens`, `refunds`, `settlement_batches`, `settlement_items`, `audit_logs`

**Plus (not in original PRD — add these):**
- `subscriptions` table to track active subscription state and expiry per user (referenced by `GET /subscription/current`)
- `gym_logo_path` column on `gyms` (needed for admin logo upload)
- `fraud_flags jsonb` column on `profiles`

---

## Environment variables

| Name | Secret? |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `RAZORPAY_KEY_ID` | No |
| `RAZORPAY_KEY_SECRET` | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Yes |
| `APP_BASE_URL` | No |
| `CRON_SECRET` | Yes |
| `SENTRY_DSN` | Yes |
| `PLATFORM_FEE_BPS_DEFAULT` | No (default: 1000) |
| `PLATFORM_FEE_BPS_SUBSCRIBER` | No (default: 500) |
| `GST_RATE_BPS` | No (default: 1800) |

---

## MVP vs Phase-2 boundary

**MVP (build now):** Everything in the feature table of the PRD with "MVP" tag.

**Phase-2 (do NOT build now):** Autopay/auto-renew subscriptions, automated payouts (RazorpayX), promo codes, featured listings, open-now filters, amenity filters, negative settlement adjustments automation.

If scope pressure hits, cut leads CSV export and fraud heuristics before cutting core checkout or settlements.

---

## Vercel cron config (`vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/v1/admin/cron/settlements-weekly", "schedule": "0 4 * * 1" },
    { "path": "/api/v1/admin/cron/cleanup-expired-checkins", "schedule": "*/15 * * * *" }
  ]
}
```
Cron timezone is UTC. Crons only run on production deployments.

---

## Compliance notes (do not skip)

- **DPDP (India):** Lead sharing is opt-in only. Default OFF. Consent must be recorded in `consent_events` with `ip_hash`, `user_agent_hash`, `source_screen`. Users can withdraw anytime.
- **GST/TCS:** Validate with a CA before go-live. Structure is in place (amounts stored per order) but tax remittance rules need legal sign-off.
- **Razorpay KYC:** Requires merchant onboarding before live transactions.

---

## 4-week implementation plan (agreed)

| Week | Focus |
|---|---|
| 1 | Scaffold + Supabase clients + full DB migrations + Auth + Profile |
| 2 | Gym discovery + Pricing engine + Razorpay checkout + Subscription + QR check-in |
| 3 | Gym dashboard (Realtime) + Gym settings + Leads + Admin portal + Refunds |
| 4 | Settlements + Webhooks + DPDP consent + Fraud flags + Sentry + Tests |
