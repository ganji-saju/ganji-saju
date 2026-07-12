# Notification Channels Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore web push in production, migrate Kakao AlimTalk to the current Solapi API, and activate authenticated email notifications through Resend.

**Architecture:** Keep the existing notification schedule and user slot preferences as the single source of truth. Each delivery channel gets a small adapter with configuration checks and delivery logging; dispatch fans out only to channels explicitly enabled by the user. External credentials remain server-only Vercel environment variables.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, Supabase Postgres/RLS, web-push, Solapi Messages v4, Resend Email API, Playwright, node:test.

## Global Constraints

- Work only in `/Users/kionya/ganji-saju` and the linked ganji-saju Supabase/Vercel/Solapi/Resend resources.
- Never expose service-role, VAPID private, Solapi secret, Resend key, or cron secret to client code or logs.
- Kakao AlimTalk remains informational only; promotional delivery requires explicit ad consent and separate Kakao product rules.
- Email and Kakao delivery must be idempotent and must not block payments or page requests.
- Production activation requires successful provider test delivery and a persisted delivery result.

---

### Task 1: Restore production web push

**Files:**
- Modify: `.env.example`
- Verify: `src/app/api/notifications/subscribe/route.ts`
- Verify: `src/app/api/notifications/test/route.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`.
- Produces: production `/api/notifications/subscribe` returning authentication or payload validation errors instead of configuration HTTP 503.

- [ ] Generate one VAPID key pair with `npm run generate:web-push-keys`; store the public/private pair only in the ganji-saju Vercel project.
- [ ] Set `WEB_PUSH_SUBJECT=mailto:notifications@ganjisaju.kr` and redeploy production.
- [ ] Verify configuration with unauthenticated probes: `POST /api/notifications/test` and `POST /api/notifications/subscribe` must no longer return the VAPID configuration 503 response.
- [ ] Sign in on a real Galaxy Chrome browser, connect push, send one test notification, and confirm `push_subscriptions.is_active=true` plus a `notification_delivery_logs.status='sent'` row.

### Task 2: Migrate Solapi AlimTalk transport and expose its real status

**Files:**
- Modify: `src/lib/kakao/vendor.ts`
- Create: `src/lib/kakao/vendor.test.ts`
- Modify: `src/features/notifications/notification-center-page.tsx`
- Create: `src/app/api/notifications/channels/route.ts`
- Test: `src/lib/kakao/vendor.test.ts`
- Test: `e2e/notification-channel-status.spec.ts`

**Interfaces:**
- Produces: `solapiSendAlimtalk(input, fetchImpl?) -> Promise<VendorSendResult>` using `POST https://api.solapi.com/messages/v4/send-many/detail` with `{ messages: [...] }`.
- Produces: `GET /api/notifications/channels -> { webPush, kakao, email }`, exposing booleans and user-safe readiness reasons only.

- [ ] Write a failing transport test asserting `messages[0].kakaoOptions.pfId/templateId/variables` and parsing `resultList[0].messageId/statusCode`.
- [ ] Run `npm run test:spec -- src/lib/kakao/vendor.test.ts`; expect failure because the adapter still posts the legacy single-message body.
- [ ] Implement the current Solapi request and response format while preserving HMAC authentication and user-safe errors.
- [ ] Run the transport test and existing Kakao compliance/contact/webhook tests; expect all pass.
- [ ] Add an authenticated channel-status route that checks server configuration and whether the current user has a phone/email without returning either value.
- [ ] Replace both “출시 예정” rows with actual states: `연결됨`, `전화번호 등록 필요`, `운영 설정 필요`, or an enable/disable control.
- [ ] Verify an approved template by sending to the owner test account and confirm `kakao_message_log` advances from `queued` to `sent` with a vendor message ID.

### Task 3: Add transactional email delivery

**Files:**
- Create: `src/lib/email/config.ts`
- Create: `src/lib/email/send.ts`
- Create: `src/lib/email/send.test.ts`
- Create: `src/emails/notification-email.tsx`
- Modify: `src/app/api/notifications/dispatch/route.ts`
- Modify: `src/app/api/notifications/test/route.ts`
- Modify: `src/features/notifications/notification-center-page.tsx`
- Create: `supabase/migrations/<generated>_notification_channels.sql`

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `EMAIL_FROM`, authenticated `auth.users.email`.
- Produces: `sendNotificationEmail({ userId, slotKey, title, body, url, idempotencyKey }) -> { status, vendorMessageId?, reason? }`.
- Produces: `notification_preferences.email_enabled` and `notification_preferences.kakao_enabled`, both defaulting to false for existing users.
- Produces: `notification_channel_logs` with channel, slot, status, provider message ID, idempotency key, and sanitized error.

- [ ] Create the migration with `supabase migration new notification_channels`; add channel preference columns, a delivery log table, unique idempotency index, RLS, and owner-select policy.
- [ ] Write failing tests for missing configuration, successful Resend response, provider error normalization, and duplicate idempotency handling.
- [ ] Implement the Resend adapter using `POST https://api.resend.com/emails`, server-only bearer auth, HTML/text bodies, and `Idempotency-Key`.
- [ ] Add an email template with the existing notification title/body and canonical absolute CTA URL.
- [ ] Fan out dispatch to email only when `email_enabled=true`; keep web-push behavior independent.
- [ ] Extend the authenticated test endpoint to accept `channel: 'push' | 'email' | 'kakao'` and send only to the current user.
- [ ] Enable the email control only when Resend is configured and the account has a verified email.
- [ ] Verify one production email reaches the owner mailbox and `notification_channel_logs.status='sent'` is persisted.

### Task 4: Production readiness and failure visibility

**Files:**
- Modify: `src/app/api/admin/web-push-status/route.ts`
- Create: `src/app/api/admin/notification-channels-status/route.ts`
- Modify: `docs/push-notifications-setup.md`
- Modify: `docs/solapi-setup.md`
- Create: `docs/email-notifications-setup.md`

**Interfaces:**
- Produces: an admin-only aggregate of configuration booleans, active recipients, sent/failed counts, and sanitized top failure reasons for all three channels.

- [ ] Add an admin diagnostics endpoint; never return endpoints, phone numbers, emails, tokens, or raw provider payloads.
- [ ] Add tests proving unauthenticated and non-admin access is rejected.
- [ ] Run `npm test`, `npm run typecheck`, targeted Playwright tests, and `git diff --check`.
- [ ] Deploy through the ganji-saju GitHub wrapper, wait for CI/Vercel, then repeat real Galaxy push, Solapi test recipient, and Resend owner-mailbox delivery checks.

## External Approval Gates

- Vercel: user must authenticate the CLI/account that owns `team_ZbkJ50SrVN1JvzUFjnH5yz7z` or add the documented environment variables in the dashboard.
- Solapi: user must authorize use of the existing paid account and provide/confirm API key, secret, pfId, sender, and approved template IDs.
- Resend: user must approve Marketplace/account provisioning and DNS records for a sending subdomain such as `notify.ganjisaju.kr`.
