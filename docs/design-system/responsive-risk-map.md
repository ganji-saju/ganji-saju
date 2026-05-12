# Responsive Risk Map

기준 브랜치: `main`

조사 명령:

```bash
rg -n "min-w-\[|max-w-\[|w-\[|h-\[|grid-cols-|md:grid|lg:grid|overflow-x|fixed|sticky|vh|dvh|svh|min-h-\[|max-h-\[" src/app src/components src/features | sort
```

## Summary

- 모바일 폭을 제한하는 `max-width: 30rem`, `max-w-md`, `grid-cols-*`, `overflow-x-auto`가 여러 계층에서 겹침.
- Header sticky + bottom nav fixed + page-level sticky CTA가 동시에 존재해 safe-area와 viewport height 계산 충돌 가능성이 있음.
- 결과/대화/프린트 페이지는 `100dvh`, `100svh`, `calc(...)`를 섞어 사용함.
- 일부 route는 `AppPage`, 일부는 plain `div.gangi-subpage`, 일부는 page 자체에서 padding을 직접 제어함.

## High Risk Areas

| 영역 | 대표 파일 | 리스크 |
|---|---|---|
| Global header/bottom nav | `src/features/shared-navigation/site-header.tsx`, `src/app/styles/app-shell.css` | sticky header와 fixed bottom nav가 모든 route에 영향을 줌 |
| Mobile width clamp | `src/app/styles/mobile-polish.css` | `30rem` 강제 폭이 tablet/landscape에서 어색할 수 있음 |
| Chat room height | `src/components/dialogue/dialogue-chat-panel.tsx`, `src/app/styles/dialogue-reports.css` | keyboard open, iOS Safari 주소창 변화에 취약 |
| Saju result grid | `src/app/saju/[slug]/page.tsx`, `src/components/saju/mobile-saju-result-story.tsx` | 4/5 column grid가 360px에서 밀도 높음 |
| Tarot carousel | `src/app/tarot/daily/pick/tarot-card-picker.tsx`, `src/app/styles/subpages.css` | overflow-x/carousel, 이미지 preload, swipe UX |
| Verification table | `src/app/verification/page.tsx` | `min-w-[920px]` table, 운영 route라도 모바일 overflow 확정 |
| Premium report | `src/app/saju/[slug]/premium/page.tsx`, `src/components/ai/yearly-report-panel.tsx` | 긴 report + 다단 grid |
| Today fortune cards | `src/features/today-fortune/*`, `src/components/today-fortune/*` | 카드/score grid가 모바일에서 정보량 과다 |
| Login/signup | `src/app/login/page.tsx` | 긴 폼과 grid가 한 파일 안에 집중 |

## Breakpoint Risks

| Breakpoint | 예상 문제 |
|---|---|
| 360px | Header actions, credit chip, login button, menu trigger가 brand 영역을 압박 |
| 375px | StepFlow 입력에서 sticky CTA와 keyboard가 겹칠 수 있음 |
| 390px | 카드형 section이 여전히 많아 fold 아래로 CTA가 밀림 |
| 430px | `max-width: 30rem` 규칙은 안전하지만 tablet 전환 전까지 여백이 애매함 |
| tablet | mobile clamp와 desktop grid 전환 사이에서 2열/3열 혼합 |
| desktop | AppShell max-width는 안정적이나 old ProductGrid와 new FlowEntryList 시각 밀도 차이 |

## Route Groups To QA Manually

1. 홈: `/`
2. 내 풀이: `/saju/new`, `/saju/personality`, `/saju/personality/result`, `/saju/[slug]`
3. 관계: `/compatibility`, `/compatibility/input`, `/compatibility/personality`, `/compatibility/personality/result`
4. 오늘: `/today-fortune`, `/tarot/daily`, `/zodiac`, `/star-sign`
5. 대화: `/dialogue`, `/dialogue/[expert]`
6. 계정/결제: `/my`, `/my/profile`, `/pricing`, `/membership`, `/credits`

## Recommended Responsive Rules

- `AppShell`/`AppPage`를 모든 public page의 outer wrapper로 고정.
- mobile page width는 CSS 한 곳에서만 관리하고 page별 `px-4`, `max-w-*` 직접 보정을 줄임.
- bottom nav clearance는 `--app-mobile-dock-clearance` 하나로만 사용.
- 입력 페이지는 active step만 렌더링하고 sticky CTA는 keyboard-safe mode를 별도 점검.
- result grid는 360px에서 1열 또는 compact meter 우선.
- chat room은 `dvh`만 믿지 말고 composer height와 safe-area를 같이 측정.

