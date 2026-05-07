# Lazyweb Design Research: Ganji Mobile Fortune Subpages

Date: 2026-05-07

## Scope

This research pass is scoped to subpage UX only. The home screen, color system, saju RAG, interpretation content, and data logic are intentionally excluded.

## Current Screens Reviewed

- `../design-improve/ganji-subpage-surfaces-2026-05-07/references/current-saju-result.png`
- `../design-improve/ganji-subpage-surfaces-2026-05-07/references/current-tarot-result.png`
- `../design-improve/ganji-subpage-surfaces-2026-05-07/references/current-payment.png`

## Lazyweb Reference Search

Search themes:

- Mobile astrology and daily fortune app cards
- Mobile tarot picker and result screens
- Mobile checkout product summary and payment method lists
- Mobile saved items and profile lists
- Mobile wellness result summary cards
- Horizontal chips, segmented tabs, and clean accordion surfaces

Representative references found through Lazyweb:

- Calm, Headspace, Breeze: daily insight cards, short guidance, bottom navigation
- Gentler, Oura, Apple Fitness: one primary score/insight surface followed by compact metrics
- Adidas, Walmart, Best Buy: checkout product summary, payment methods, clear primary CTA
- AllTrails, Artsy, Nike: saved item lists with simple filters and roomy row cards
- Forbes, Particle, Farfetch, eBay: horizontal category chips, low-friction filters, scannable lists

## Findings

1. Fortune result pages should behave like a mobile app frame even on desktop: one centered column, one clear card surface per chapter, no wide desktop spread.
2. The best references use one primary insight card and several compact secondary cards instead of deeply nested cards.
3. Payment screens are clearest when the product summary, payment method list, and final CTA have distinct hierarchy.
4. Saved/profile/list pages benefit from tall, tappable rows with simple filters.
5. Chips and subtabs should be compact, horizontally scrollable, and visually consistent across subpages.
6. Current Ganji colors already match the desired brand direction, so improvements should reuse existing CSS variables rather than introduce new colors.

## Design Guardrails

- Preserve white background, black text, pink accent.
- Do not edit home layout or home CSS.
- Do not edit saju interpretation text, RAG, or generation logic.
- Use existing `Gangi` component classes as the production design system surface.

