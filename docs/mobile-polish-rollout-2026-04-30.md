# Mobile Polish Rollout

Updated: 2026-04-30

## Scope

This note captures the mobile polishing pass that followed the broader premium workflow rollout.

## Main Commit

- Commit: `4e99ccc`
- Message: `refactor: polish mobile premium entry surfaces`

## Production Status

- Legacy production alias at that time: `https://saju-app-lac.vercel.app`
- Current ganji-saju production alias: `https://ganji-saju.vercel.app`
- Status at verification: live

## What Changed

### 1. Common mobile safe-area handling

- Added shared bottom clearance tuning for pages that sit above the mobile dock.
- Introduced `app-mobile-safe-section` for first-screen sections that were visually colliding with the bottom navigation area.
- Increased mobile `app-page-spacious` bottom spacing to respect `--app-mobile-dock-clearance`.

### 2. Mobile title contrast

- `PageHero` now uses shared `app-hero-title` and `app-hero-description` styling.
- Mobile heading contrast and readability were improved with adjusted sizing, line-height, and subtle text-shadow.
- `moon-section-title` received the same contrast-oriented polish.

### 3. Faster first action on key entry pages

#### `/saju/new`

- Moved birth input fields ahead of the saved-profile helper block.
- Compressed the saved-profile section into a lighter “저장된 정보로 빠르게 채우기” block.
- Reduced explanatory copy density at the top of the page.

#### `/membership`

- Shortened the hero explanation.
- Lowered the visual weight of the sample-report action.
- Removed extra pre-card CTA pressure so the first collectible report card appears sooner on mobile.

#### `/compatibility/input`

- Tightened the hero copy.
- Reduced vertical weight in the relationship-lens section.
- Promoted the saved-person selection section so the core action appears earlier in the flow.

## Verification

- `npm run typecheck`
- `npm run build -- --webpack`

## Production QA Notes

The following production surfaces were rechecked after deployment:

- `/saju/new`
- `/membership`
- `/compatibility/input`

Observed result:

- The first actionable content appears earlier than before on mobile.
- The first-screen sections are less likely to feel visually crowded by the mobile dock.
- Heading contrast is stronger on dark surfaces.

## Known Constraint

- `/compatibility/input` redirects to login for non-authenticated requests by design.
- Production QA for that page should be interpreted from an authenticated browser session, not from unauthenticated `curl` output alone.
