# Auth Email Templates

Supabase Auth email templates are managed in the Supabase Dashboard, not deployed from this repo automatically. This folder keeps the copy source so the production dashboard can be updated consistently.

## Current Template Source

- Magic link / email signup-login template:
  - `supabase/templates/auth-magic-link.html`

Recommended subject:

```text
달빛인생 로그인 링크가 도착했습니다
```

## Dashboard Setup

1. Open Supabase Dashboard.
2. Go to `Authentication` -> `Email Templates`.
3. Open `Magic Link`.
4. Paste the contents of `supabase/templates/auth-magic-link.html`.
5. If signup confirmation emails use a separate `Confirm signup` template in the project, paste the same template there too.
6. Save and send a test email from the latest Vercel preview.

## Redirect Requirements

The template must keep `{{ .ConfirmationURL }}` as the button URL. Supabase expands that URL using the `emailRedirectTo` value sent by the app.

Do not replace the button URL with `{{ .SiteURL }}` because that forces emails back to the main site and breaks preview login checks.

For Vercel previews, add this Supabase Auth redirect allow-list entry:

```text
https://*.vercel.app/**
```

Recommended redirect entries:

```text
https://ganji-saju.vercel.app/**
https://*.vercel.app/**
http://localhost:3000/**
```

## Future Phone Login

Phone login is intentionally not active yet. Once Supabase Auth Phone provider and an SMS provider are configured, replace the "휴대폰 인증은 준비 중입니다" block in `src/app/login/page.tsx` with the SMS OTP flow documented in the code comment there.
