# Lazyweb Design Improve: Ganji Subpage Surfaces

Date: 2026-05-07

## Scope

Applied a design-only subpage polish based on Lazyweb research. This pass intentionally avoids:

- Home screen changes
- Color system changes
- Saju interpretation/RAG/content changes
- Payment, auth, entitlement, or data logic changes

## Current References

- `references/current-saju-result.png`
- `references/current-tarot-result.png`
- `references/current-payment.png`

## Improvements Applied

1. Centered subpage mobile frame on desktop so result/payment/detail screens feel like one focused app page instead of a stretched web page.
2. Unified card surfaces for sections, result cards, saved rows, checkout rows, tarot reading blocks, and reading chapters.
3. Tightened subpage header, intro, chip, and subtab spacing without changing copy.
4. Improved list rows and checkout method rows with larger tap targets and clearer hover/focus surfaces.
5. Preserved existing white/black/pink variables and reused current `Gangi` class APIs.

## Files Changed

- `src/app/styles/subpages.css`

## Notes

This is a CSS-only change. It does not alter routes, React component behavior, RAG prompts, generated content, or payment logic.

