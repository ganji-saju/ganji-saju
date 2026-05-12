# Visual QA Guide

## Purpose

주요 화면을 사람이 하나씩 캡처하지 않아도, route와 breakpoint 조합별 스크린샷을 자동 생성해 배포 전 디자인 회귀를 확인한다.

## Tooling

- Script: `scripts/visual-screenshot.mjs`
- NPM command: `npm run visual:qa`
- Preferred provider: `playwright` if installed
- Current fallback: local Chrome headless CLI

현재 repository에는 Playwright/Cypress가 설치되어 있지 않다. 새 dependency는 추가하지 않았다. `playwright`를 devDependency로 추가하면 같은 스크립트가 자동으로 fullPage screenshot 모드로 동작한다. 설치 전에는 Chrome CLI fallback이 viewport screenshot을 저장한다.

## Run

Local dev server:

```bash
npm run dev
npm run visual:qa
```

Preview URL:

```bash
PREVIEW_URL="https://example-preview.vercel.app" npm run visual:qa
```

Custom base URL:

```bash
npm run visual:qa -- --base-url=http://localhost:3000
```

Small smoke run:

```bash
npm run visual:qa -- --routes=/,/pricing --breakpoints=360x800
```

## Capture Routes

The default route set only includes existing routes.

| Route | Purpose | Auth |
|---|---|---|
| `/` | Home | guest |
| `/saju/new` | Basic saju input | guest |
| `/saju/personality` | Saju personality input | guest |
| `/compatibility` | Compatibility hub | guest |
| `/compatibility/personality` | Personality compatibility input | guest |
| `/today-fortune` | Today fortune | guest |
| `/tarot/daily` | Daily tarot | guest |
| `/zodiac` | Zodiac | guest |
| `/star-sign` | Star sign | guest |
| `/dialogue` | 12 zodiac dialogue | guest |
| `/my` | Archive / MY | guest redirect or logged-in state |
| `/pricing` | Pricing | guest |
| `/membership` | Membership | guest |
| `/credits` | Credits | guest |

## Routes Requiring Confirmation

| Requested Candidate | Current Status |
|---|---|
| `/today` | not found; use `/today-fortune` |
| `/tarot` | exists, but primary free tarot entry is `/tarot/daily` |
| `/constellation` | not found; use `/star-sign` |
| `/archive` | not found; use `/my` or `/vault` alias |

## Breakpoints

| Label | Size |
|---|---|
| mobile-s | `360x800` |
| mobile-m | `390x844` |
| mobile-l | `430x932` |
| tablet | `768x1024` |
| tablet-landscape | `1024x768` |
| desktop | `1280x900` |
| desktop-wide | `1440x1000` |

## Screenshot Output

Default output:

```text
artifacts/screenshots/{route}/{breakpoint}.png
artifacts/screenshots/visual-qa-summary.json
artifacts/screenshots/visual-qa-summary.md
```

`artifacts/screenshots/` is gitignored. Screenshots are QA artifacts, not source files.

## Failure Reading

- Base URL failure: start the app with `npm run dev`, or pass `--base-url` / `PREVIEW_URL`.
- Route failure: check whether the route exists or requires authentication.
- Screenshot failure: check whether Chrome is installed or set `VISUAL_QA_CHROME_PATH`.
- Full-page requirement: install Playwright as devDependency and rerun.

## Deployment Checklist

1. Start preview deployment or local server.
2. Run `npm run visual:qa`.
3. Review `artifacts/screenshots/visual-qa-summary.md`.
4. Open the route folders for mobile widths first: `360x800`, `390x844`, `430x932`.
5. Verify no horizontal overflow, clipped sticky CTA, broken bottom nav, blank page, or error overlay.
6. For auth routes, repeat with a logged-in browser flow or mark as guest redirect verified.
