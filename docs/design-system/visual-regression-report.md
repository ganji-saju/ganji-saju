# Visual Regression Report Draft

## Summary

Automated screenshot QA scaffolding has been added for the sitewide design-system rollout. The default route set covers home, saju, saju personality, compatibility, personality compatibility, today, tarot, zodiac, star sign, dialogue, archive, pricing, membership, and credits.

## Tool Status

| Item | Status |
|---|---|
| Playwright | Not installed |
| Cypress | Not installed |
| Existing e2e suite | Not found |
| Screenshot script | Added: `scripts/visual-screenshot.mjs` |
| Production dependency added | No |
| Dev dependency added | No |
| Chrome headless fallback | Available on this local machine |

## Configured Routes

| Route | Notes |
|---|---|
| `/` | Home |
| `/saju/new` | Basic saju input |
| `/saju/personality` | Saju personality input |
| `/compatibility` | Relationship hub |
| `/compatibility/personality` | Personality compatibility input |
| `/today-fortune` | Today fortune |
| `/tarot/daily` | Daily tarot |
| `/zodiac` | Zodiac |
| `/star-sign` | Star sign |
| `/dialogue` | 12 zodiac dialogue |
| `/my` | Archive / MY; guest state can redirect to login |
| `/pricing` | Pricing |
| `/membership` | Membership |
| `/credits` | Credits |

## Configured Breakpoints

- `360x800`
- `390x844`
- `430x932`
- `768x1024`
- `1024x768`
- `1280x900`
- `1440x1000`

## Run Result

Smoke capture completed locally.

| Item | Result |
|---|---|
| Base URL | `http://localhost:3000` |
| Provider | `chrome-headless-viewport` |
| Command | `npm run visual:qa -- --routes=/,/pricing,/dialogue,/credits,/my --breakpoints=360x800,1280x900 --out=artifacts/screenshots/smoke` |
| Routes captured | 5 |
| Breakpoints captured | 2 |
| Total screenshots | 10 |
| Failed routes | none |
| Screenshot output path | `artifacts/screenshots/smoke` |

Full 14 route × 7 breakpoint capture is configured but was not run in this step to avoid producing a large local artifact set during implementation.

## Review Focus

- Mobile bottom nav safe-area
- Sticky CTA overlap
- Horizontal overflow at 360px
- Pricing row wrapping
- Archive list row wrapping
- Dialogue route 12 zodiac list density
- Auth redirects for `/my`

## Known Limitations

- Without Playwright, Chrome CLI fallback captures viewport screenshots rather than fullPage screenshots.
- FullPage screenshot QA requires adding `playwright` as a devDependency.
- Authenticated archive states still require a logged-in QA session.
