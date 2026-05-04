# Premium Rollout Summary

Updated: 2026-04-29

## Scope

This summary captures the premium "명리 기준서" rollout that followed the pre-premium backup point.

## Baseline

- Backup checkpoint: `f3ee1e0`
- Backup tag: `backup/2026-04-28-pre-premium-concierge`
- Backup branch: `codex/backup-2026-04-28-pre-premium-concierge`

## Main Product Rollout

The rollout was applied in staged PR-sized units and then consolidated into production.

### PR 1

- `docs/premium-roadmap-file-map.md`
- Purpose: repository/file map for the premium roadmap
- Status: merged to `main`

### PR 2

- Home hero refocus
- `/sample-report` introduction
- Status: merged to `main`, deployed

### PR 3

- Report catalog on home
- Specialist mentor cards
- Route export build fix included
- Status: merged to `main`, deployed

### PR 4

- Membership page restructured around collectible reports vs dialogue membership
- Status: merged to `main`, deployed

### PR 5

- `DecisionTracePanel`
- Report metadata contract
- Status: merged to `main`, deployed

### PR 6

- Result screen one-minute summary
- Keepsake / PDF / MY storage section
- Status: merged to `main`, deployed

### PR 7

- `SafetyNotice`
- Safety copy guide
- Status: merged to `main`, deployed

### PR 8

- Premium conversion event tracking
- QA checklist document
- Status: merged to `main`, deployed

## Wave 1-7 UX Refinement Pass

After the staged PR rollout, a broader UX polish pass was completed on `codex/premium-myeongri-concierge`.

### Branch Commit

- Branch: `codex/premium-myeongri-concierge`
- Commit: `8dd24e0`
- Message: `feat: refine premium reading flows and shared layouts`

### Follow-up Main Commit

- Main follow-up commit: `738762e`
- Message: `feat: polish premium reading flows across key surfaces`

### What Was Included

- Shared layout system for repeated section patterns:
  - `SectionHeader`
  - `SectionSurface`
  - `ActionCluster`
  - `SupportRail`
  - `ProductGrid`
  - `FeatureCard`
  - `BulletList`
  - `EvidenceStrip`
- Home surface rebalanced to reduce uneven two-column usage
- Sample report reorganized into a brochure-style preview flow
- Result page hierarchy tightened:
  - one-minute summary
  - decision trace
  - next actions
  - detailed body
- Membership compressed toward a product-catalog reading flow
- Dialogue / today-fortune / compatibility entry surfaces clarified
- `/about-engine` and `/method` converted into more document-like reading layouts
- Mobile spacing, text density, and CTA repetition were trimmed in a final pass

## Verification

The branch snapshot used for the Wave 1-7 polish pass was verified before rollout:

- `npm run typecheck`
- `npm test`
- `npm run build -- --webpack`

Production verification after `main` push:

- `/`
- `/membership`
- `/about-engine`
- `/compatibility`
- `/sample-report`

All were confirmed to return `200`.

## Production

- Legacy production alias at that time: `https://saju-app-lac.vercel.app`
- Current ganji-saju production alias: `https://ganji-saju.vercel.app`
- Status at verification: production live and serving the updated sample-report copy from the Wave 5 brochure pass

## Intentionally Excluded Local-Only Materials

These were left outside the rollout commit set and should be treated as separate docs/assets decisions:

- `master_plan.md`
- `comparison_report.md`
- `docs/mobile-ux-*`
- `docs/project-manual.*`
- `public/intro/*` source bundles and raw media
- `public/images/*` local-only raw media not required by the current app

## Recommended Next Check

The next pass should focus on live mobile QA:

1. spacing density at 360px and 390px
2. repeated CTA pressure in long pages
3. narrow-width readability in `/sample-report`, `/membership`, `/about-engine`
4. whether support rails remain helpful instead of noisy on tablet widths
