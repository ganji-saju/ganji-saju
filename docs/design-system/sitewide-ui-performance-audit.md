# 달빛인생 사이트 전체 UI/UX + 모바일 성능 감사

작성일: 2026-05-12
감사 범위: 홈, 공통 레이아웃/내비게이션, 주요 서비스 진입/입력/결과 흐름, 공통 컴포넌트, 정적 성능 리스크
비범위: 결제, DB, Supabase migration, 사주 계산, 성향 계산, 궁합 계산, 결과 생성 로직 수정

## 1. Executive Summary

달빛 성향사주와 달빛 성향궁합은 기능적으로 구현되어 있고 홈에서도 핵심 기능으로 노출됩니다. 다만 홈 리디자인 이후 내부 페이지와 시각 문법이 분리되어, 사용자가 홈에서는 `app-*` 기반의 넓은 섹션형 화면을 보고 내부로 들어가면 `gangi-*` 기반의 모바일 카드/리스트 화면을 다시 만나는 상태입니다.

현재 사이트의 가장 큰 UX 문제는 카드 밀도입니다. 홈, 가격, MY, 무료운세, 사주 입력, 성향사주 입력/결과, 성향궁합 입력/결과가 대부분 카드와 리스트를 반복합니다. 모바일에서는 기능이 많아 보이는 장점보다 “어디부터 봐야 하는지”가 흐려지는 비용이 큽니다.

성능 측면에서는 전역 클라이언트 컴포넌트와 paint-heavy CSS가 핵심 리스크입니다. `SiteHeader`는 모든 페이지에서 인증, 코인, 알림 heartbeat, 모바일 메뉴, 하단 dock을 처리하며, 홈 전체도 클라이언트 컴포넌트로 감싸져 있습니다. 정적 검색 기준으로 `use client` 선언은 57개이고, 전체 TS/TSX 파일 401개 대비 약 14.2%입니다. client boundary 수 자체보다 “전역으로 항상 실행되는 boundary”와 “한 파일에 많은 상태/비동기/화면을 담은 boundary”가 더 큰 병목 후보입니다.

브랜드 측면에서는 “사주 = 네 기둥”과 “성향 = 네 축”의 결합이 아직 copy 중심입니다. `年 月 日 時 × I/E S/N T/F J/P`를 반복되는 시각 언어로 만들고, 사이트 IA를 `나의 결 / 관계의 결 / 오늘의 결` 세 흐름으로 재정렬하는 것이 다음 단계의 핵심입니다.

## 2. Current Sitemap

정적 route 확인 기준:

| 분류 | 주요 route | 확인 파일 |
|---|---|---|
| 홈 | `/` | `src/app/page.tsx` |
| 사주 | `/saju`, `/saju/new`, `/saju/[slug]` | `src/app/saju/page.tsx`, `src/app/saju/new/page.tsx`, `src/app/saju/[slug]/page.tsx` |
| 사주 세부 | `/saju/[slug]/overview`, `/nature`, `/elements`, `/today-detail`, `/premium`, `/premium/print` | `src/app/saju/[slug]/*/page.tsx` |
| 성향사주 | `/saju/personality`, `/saju/personality/result` | `src/app/saju/personality/page.tsx`, `src/app/saju/personality/result/page.tsx` |
| 궁합 | `/compatibility`, `/compatibility/input`, `/compatibility/result` | `src/app/compatibility/*` |
| 성향궁합 | `/compatibility/personality`, `/compatibility/personality/result` | `src/app/compatibility/personality/*` |
| 무료운세 | `/free`, `/today-fortune`, `/today-fortune/result`, `/today-fortune/detail` | `src/app/free/page.tsx`, `src/app/today-fortune/*` |
| 타로 | `/tarot`, `/tarot/daily`, `/tarot/daily/pick`, `/tarot/daily/result` | `src/app/tarot/*` |
| 띠/별자리 | `/zodiac`, `/zodiac/[slug]`, `/star-sign`, `/star-sign/[slug]` | `src/app/zodiac/*`, `src/app/star-sign/*` |
| 기타 운세 | `/daewoon`, `/taekil`, `/myeongri`, `/interpretation`, `/dream-interpretation` | `src/app/daewoon/page.tsx`, `src/app/taekil/page.tsx`, 기타 route |
| 대화방 | `/dialogue`, `/dialogue/[expert]`, `/dialogue/safe-redirect` | `src/app/dialogue/*` |
| 계정/MY | `/my`, `/my/profile`, `/my/billing`, `/my/settings` | `src/app/my/*` |
| 결제/가격 | `/pricing`, `/membership`, `/membership/checkout`, `/membership/success`, `/membership/complete`, `/credits`, `/pay` | `src/app/pricing/page.tsx`, `src/app/membership/*`, `src/app/credits/*`, `src/app/pay/page.tsx` |
| 정책 | `/terms`, `/privacy`, `/robots`, `/sitemap` | `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, generated route files |

확인 필요 route:

| route | 관찰 |
|---|---|
| `/my/results` | 여러 링크와 redirect에서 사용하지만 `src/app/my/results/page.tsx`는 확인되지 않았습니다. |
| `/vault` | `src/app/vault/page.tsx`가 `/my/results`로 redirect합니다. 대상 route 확인이 필요합니다. |
| `/guide`, `/about-engine`, `/method` | `src/app/sitemap.ts`에는 포함되어 있으나 현재 `src/app` route 파일은 확인되지 않았습니다. |

## 3. Current Layout / Navigation

| 영역 | 파일 | 현재 구조 |
|---|---|---|
| Root layout | `src/app/layout.tsx` | Noto Sans KR, global CSS, layout preference inline script, Supabase recovery redirect, Vercel Analytics, SpeedInsights 적용 |
| App shell | `src/shared/layout/app-shell.tsx` | `AppShell`, `AppPage`, `PageHero` 제공. 기본 header/footer를 주입 |
| Header | `src/features/shared-navigation/site-header.tsx` | mobile top header, mobile dock, auth state, credits, notification heartbeat, menu를 하나의 client component에서 처리 |
| Footer | `src/components/site-footer.tsx` | 회사 정보, 정책 링크, 가격 안내, 알림 설정, 안전 고지 |
| Nav config | `src/content/moonlight.ts`, `src/shared/config/site-navigation.ts` | `PRIMARY_TABS`, `HEADER_SHORTCUTS` 기반 |
| MY nav | `src/features/account/account-shell-nav.tsx` | MY 홈, 가족 사주, 결과보관함, 결제 관리, 설정 tab |

현재 주요 nav:

| 위치 | 항목 |
|---|---|
| Primary tabs | 홈, 사주추가, 무료운세, 대화방, 보관함 |
| Header shortcuts | 오늘운, 타로, 사주, 궁합, 띠운세, 별자리 |
| Home primary CTA | 내 성향사주 보기, 우리 성향궁합 보기 |
| Mobile dock | 홈, 사주추가, 무료운세, 대화방, 보관함 |

주의할 점:

- `DesktopSidebar` 구현은 `site-header.tsx` 안에 있으나 현재 default render에서는 모바일 chrome만 반환합니다.
- mobile top header와 bottom dock이 같은 client component에 묶여 있어, 단순 정적 페이지에서도 header auth/credit/heartbeat logic이 함께 들어옵니다.
- 보관함 nav는 `/my/results`를 바라보지만 실제 route 파일이 확인되지 않았습니다.

## 4. Current Home Issues

| 항목 | 현재 상태 | 문제 |
|---|---|---|
| route | `src/app/page.tsx`가 `getHomeBanners()` 후 `GangiHomeClient` 렌더링 | 홈 전체가 client boundary 아래에 위치 |
| section order | Hero, TodaySnapshot, PrimaryFeatureCards, FreeStartCards, ThemeServiceGrid, AI, Archive, Pricing | 기능은 잘 보이나 모바일에서 섹션 수가 많음 |
| mobile order | CSS로 primary features를 TodaySnapshot보다 위로 이동 | 신규 기능 노출은 좋아졌지만 전체 flow가 카드 중심 |
| copy | 사주와 성향의 결합을 설명 | 시각적으로는 네 기둥 × 네 축 구조가 약함 |
| card density | Primary, free, theme, recent, pricing이 모두 카드/패널 기반 | 구형 폰에서 스크롤/paint 비용과 정보 피로 증가 |
| analytics | delegated click tracking | payload는 간결하지만 home 전체 client화를 유발 |

홈은 “오늘 무엇을 보고 싶나요?”라는 진입 문구는 좋지만, 이후 정보 구조가 `나의 결 / 관계의 결 / 오늘의 결`로 명확히 묶이기보다 카드 그룹의 연속으로 보입니다. 다음 디자인 시스템에서는 홈을 서비스 카탈로그보다 선택 흐름으로 재구성하는 편이 좋습니다.

## 5. Inner Page Consistency Issues

| 페이지군 | 현재 구조 | 불일치 |
|---|---|---|
| 사주 입력 | `SajuIntakePage`, `AppShell`, `GangiIntro`, custom step state | 홈의 넓은 `app-*` 섹션과 달리 430px 모바일 앱형 구조 |
| 성향사주 | `GangiIntro`, `GangiSection`, birth fields, personality self check | 사주×성향 결합이 입력 폼과 결과 copy에 머물고 시각 rail이 부족 |
| 궁합 허브 | `PageHero`, `SectionSurface`, `FeatureCard`, `ProductGrid` | 홈과 가까운 `app-*` 문법 |
| 성향궁합 | `GangiIntro`, `GangiSection`, 2인 입력/result client | 궁합 허브에서 들어간 뒤 화면 문법이 다시 `gangi-*`로 바뀜 |
| 오늘운세 | `TodayFortuneExperience`, client flow | concern/input/result가 독립 UX로 움직임 |
| 타로 | `GangiPageHeader`, `GangiIntro`, topic cards, picker | 캐릭터/카드몰 감성은 있으나 홈의 새 브랜드와 연결 약함 |
| 띠/별자리 | `PageHero`, `SectionSurface`, `GangiCharacter`, star grid | 일부 `app-*`, 일부 `gangi-*` 혼용 |
| 대화방 | `GangiIntro`, expert list, chat panel | AI 상담은 결과 CTA와 이어지지만 shell 통일은 약함 |
| MY/가격 | `GangiIntro`, `GangiListLink`, dashboard cards | 보관/결제 흐름은 중요하지만 nav route 불확실성이 있음 |

핵심 문제:

- `home-redesign`, `app-*`, `gangi-*`, page-local Tailwind class가 섞여 있습니다.
- 동일한 CTA라도 `buttonVariants`, `gangi-primary-button`, 직접 Tailwind class가 혼재합니다.
- 결과 화면은 서비스별 축과 점수 UI가 다르고, 공통 `ResultShell`이 없습니다.
- 입력 화면은 각 기능마다 자체 step structure가 있어 학습 비용이 반복됩니다.

## 6. Mobile UX Issues

| 리스크 | 관찰 | 영향 |
|---|---|---|
| 정보량 과다 | 홈과 내부 모두 카드/리스트 밀도가 높음 | 첫 방문자가 주요 행동을 놓칠 수 있음 |
| CTA 과밀 | Hero, primary cards, free cards, theme cards가 초반에 연속 | “무엇을 먼저 해야 하는지” 결정 피로 |
| 하단 dock 간섭 | fixed mobile dock이 모든 주요 화면 하단에 존재 | 하단 CTA, 결과 저장/공유 버튼과 충돌 가능 |
| 입력 단계 길이 | 사주/성향사주/성향궁합이 많은 입력을 한 화면 흐름에 포함 | 작은 화면에서 완료까지 체감 길이가 큼 |
| route 흐름 혼선 | 보관함 `/my/results` target이 불확실 | 저장/재조회 UX 신뢰 저하 |
| visual metaphor 약함 | `年 月 日 時 × I/E S/N T/F J/P`가 반복 시각 요소로 존재하지 않음 | 성향사주/성향궁합의 차별점이 약해짐 |

권장 방향:

- 홈은 `나의 결 / 관계의 결 / 오늘의 결` 세 흐름으로 압축합니다.
- 카드 grid는 줄이고, 한 화면 안에서 다음 행동이 보이는 `flow row` 중심으로 바꿉니다.
- 입력 화면은 공통 `StepShell`로 현재 단계, 남은 단계, 하단 CTA를 통일합니다.
- 결과 화면은 공통 `ResultShell`로 한 줄 정의, 축 요약, 잠금, 공유, AI CTA의 순서를 통일합니다.

## 7. Mobile Performance Risks

정적 검색 결과:

| 항목 | 수치/파일 | 의미 |
|---|---|---|
| TS/TSX 파일 | 401개 | 전체 정적 대상 |
| `use client` 선언 | 57개 | 전체 대비 약 14.2% |
| route `page.tsx` | 59개 | 주요 페이지 수 |
| `lucide-react` import | 42곳 | icon bundle 영향 측정 필요 |
| gradient/shadow/blur/filter/mask CSS occurrence | 약 371개 | paint 비용 후보 |

주요 병목 후보:

| 후보 | 파일 | 이유 |
|---|---|---|
| 전역 header | `src/features/shared-navigation/site-header.tsx` | 919라인. auth/session/credits/notification heartbeat/focus listener/mobile dock 포함 |
| 홈 client shell | `src/features/home/gangi-home-client.tsx` | 정적 섹션까지 client boundary 아래에 있음 |
| 사주 입력 | `src/features/saju-intake/saju-intake-page.tsx` | 1214라인. 단계, 프로필 fetch, 위치 검색, 저장, validation 집중 |
| 성향궁합 입력 | `src/features/compatibility/personality-compatibility-input-client.tsx` | 1105라인. 2인 입력, profile/family fetch, 성향 체크 집중 |
| 성향궁합 결과 | `src/features/compatibility/personality-compatibility-result-client.tsx` | 938라인. 결과, 권한, 저장, 공유, 결제 CTA 집중 |
| 성향사주 입력/결과 | `src/features/saju-personality/*` | 각각 850라인대 client component |
| 대화방 | `src/components/dialogue/dialogue-chat-panel.tsx` | setInterval, requestAnimationFrame, typing animation |
| 타로 카드 선택 | `src/app/tarot/daily/pick/tarot-card-picker.tsx` | requestAnimationFrame, 이미지 카드 UX |
| CSS animation | `src/app/styles/*` | 여러 keyframes, blur, shadow, gradient |

이미 있는 완화:

- `src/app/styles/home.css`에 low-power mobile pass가 있습니다.
- 일부 `prefers-reduced-motion` 대응이 있습니다.
- Toss/OpenAI/lunar 계산은 일반 홈 client 경로에 직접 묶이지 않습니다.

추가 권장:

- home section은 server component화하고 analytics만 작은 client boundary로 분리합니다.
- `SiteHeader`는 static nav와 auth/credit widget을 분리합니다.
- blur/backdrop/filter/shadow 정책을 전역 mobile low-power layer로 확장합니다.
- 실제 구형 기기에서 Lighthouse, Chrome Performance, Vercel Speed Insights를 측정합니다.

## 8. Existing Components Inventory

| 컴포넌트 종류 | 현재 파일/구현 | 상태 |
|---|---|---|
| Button | `src/components/ui/button.tsx`, `gangi-primary-button`, `gangi-secondary-button` CSS class | shared primitive는 있으나 Gangi 버튼 class와 혼재 |
| Card | `src/components/ui/card.tsx`, `FeatureCard`, `GangiMiniCard`, `gangi-card-panel`, `SectionSurface` | 카드 문법이 여러 갈래 |
| Input | `src/components/ui/input.tsx`, `UnifiedBirthInfoFields`, page-local inputs | 기본 primitive와 기능 입력 컴포넌트가 병행 |
| Select | 독립 `src/components/ui/select.tsx` 없음. login/native select, birth field select 등 page-local 구현 | 표준 Select primitive 필요 |
| Tabs | 독립 `Tabs` primitive 없음. `AccountShellNav`, `GangiCategoryTabs`, `app-subnav` 등 custom 구현 | 표준 Tabs/Subnav 규칙 필요 |
| Stepper | `BirthInfoStepper`, `SajuIntakePage` custom steps, `SwipeSectionDeck` | 공통 StepShell/Stepper 필요 |
| Section | `SectionHeader`, `SectionSurface`, `HomeSection`, `GangiSection` | 통합 가능 |
| Shell | `AppShell`, `AppPage`, `PageHero`, `GangiIntro` | page shell 문법 통합 필요 |
| Result score | `GangiMetricBar`, today score components, 성향사주/성향궁합 axis UI | 공통 AxisSummary 필요 |
| Tracking | `TrackedLink`, `TrackedButton`, delegated home tracking | payload 정책은 유지 가능 |

재사용 가치가 높은 모듈:

- `src/shared/layout/app-shell.tsx`
- `src/components/layout/section-surface.tsx`
- `src/components/layout/section-header.tsx`
- `src/components/layout/feature-card.tsx`
- `src/components/ui/button.tsx`
- `src/components/gangi/gangi-ui.tsx`
- `src/components/saju/shared/unified-birth-info-fields.tsx`
- `src/domain/personality/*`
- `src/domain/saju-personality/*`
- `src/domain/compatibility-personality/*`
- `src/config/home/*`

## 9. Heavy Dependencies / Scripts

| 항목 | 위치 | 평가 |
|---|---|---|
| `@vercel/analytics` | `src/app/layout.tsx` | 전역 analytics. 유지하되 payload 최소화 |
| `@vercel/speed-insights` | `src/app/layout.tsx` | 전역 성능 관측. 구형 기기 이슈 분석에 활용 가능 |
| `@tosspayments/tosspayments-sdk` | `src/components/membership/toss-membership-checkout.tsx`, `src/app/credits/page.tsx` | 결제 route 전용이어야 함. 홈/일반 UX 리팩터에서 건드리지 않음 |
| `openai` | `src/server/ai/openai-text.ts` dynamic import | server only 유지 필요 |
| `lunar-typescript` | 사주 engine/validation/report/server score | 계산 로직. client UI로 옮기면 안 됨 |
| `lucide-react` | 42개 import | 사용성 좋으나 icon import 분산. 실제 bundle 영향 측정 필요 |
| `@base-ui/react` | `button`, `input`, `badge`, `separator` | UI primitive 기반 |
| `tw-animate-css` | `src/app/globals.css` | 전역 CSS import. 실제 사용 범위와 CSS cost 확인 필요 |
| Vercel/inline script | `src/app/layout.tsx` layout preference script | hydration mismatch 방지 목적. 유지 가능하나 최소화 필요 |

## 10. Saju x Personality Brand Gap

현재 gap:

- 성향사주/성향궁합의 차별점이 “사주와 16유형을 함께 본다”는 설명에 머뭅니다.
- 사주 네 기둥 `年 月 日 時`와 성향 네 축 `I/E S/N T/F J/P`가 화면 구조 안에서 반복되지 않습니다.
- 점수/결과는 기능별로 보이지만 브랜드 고유의 시각 체계로 이어지지 않습니다.
- 홈에서는 “성향사주/성향궁합”이 중요해 보이나 내부 페이지에서는 기존 Gangi 카드 문법으로 흡수됩니다.

강화 방향:

| 메타포 | UI 표현 |
|---|---|
| 사주 = 네 기둥 | `年 月 日 時` pillar rail |
| 성향 = 네 축 | `I/E`, `S/N`, `T/F`, `J/P` axis rail |
| 결합 | `年 月 日 時 × I/E S/N T/F J/P` bridge |
| 개인 풀이 | `나의 결` |
| 관계 풀이 | `관계의 결` |
| 오늘 풀이 | `오늘의 결` |

성향사주와 성향궁합의 결과 화면은 공통 bridge를 상단에 두되, 개인 결과는 `내가 반복해서 선택하는 방식`, 관계 결과는 `두 사람이 어긋나는 접점`으로 갈라야 합니다. 성향궁합의 2인 관계 로직은 건드리지 않고 시각 shell만 공유하는 방식이 안전합니다.

## 11. Recommended Design System Direction

디자인 시스템 이름 제안: `달빛 결 디자인 시스템`

핵심 원칙:

- 모바일 first
- 카드 grid보다 flow row 우선
- 입력은 step shell
- 결과는 result shell
- 네 기둥과 네 축을 반복되는 작은 시각 언어로 사용
- 구형 휴대폰에서는 blur, large shadow, infinite animation 최소화
- 결제/DB/계산 로직과 UI shell을 분리

추천 primitive:

| primitive | 역할 |
|---|---|
| `GyeolShell` | 전체 페이지 width, background, dock clearance, spacing 통일 |
| `GyeolHeaderRail` | 현재 흐름: 나의 결/관계의 결/오늘의 결 |
| `FlowRow` | 홈/허브에서 카드 grid를 대체하는 흐름형 CTA |
| `StepShell` | 입력 단계 공통 shell |
| `ResultShell` | 결과 화면 공통 shell |
| `FourPillarRail` | `年 月 日 時` visual rail |
| `PersonalityAxisRail` | `I/E S/N T/F J/P` visual rail |
| `GyeolBridge` | 사주와 성향 결합 표시 |
| `AxisSummary` | 성향사주 6축, 성향궁합 5축, 오늘운 점수 요약 통합 |
| `GyeolCTA` | primary/secondary/quiet CTA 통합 |
| `GyeolTabs` | MY, 결과 subnav, page tabs 통합 |

IA 제안:

| 흐름 | 포함 기능 |
|---|---|
| 나의 결 | 달빛 성향사주, 내 사주풀이, 올해 흐름 |
| 관계의 결 | 달빛 성향궁합, 기존 궁합, 대화방 관계 질문 |
| 오늘의 결 | 오늘운세, 타로 한 장, 띠운세, 별자리 |
| 다시 보기 | 보관함, 최근 리포트, MY |
| 더 깊게 | 가격 안내, 멤버십, 990원 깊이보기 |

## 12. Files To Modify Later

지금 수정하지 말고, 다음 설계 확정 후 단계적으로 수정할 후보입니다.

| 목적 | 후보 파일 |
|---|---|
| tokens 정리 | `src/app/styles/tokens.css` |
| 전역 shell/paint 경량화 | `src/app/styles/app-shell.css`, `src/app/styles/components.css`, `src/app/styles/subpages.css`, `src/app/styles/home.css`, `src/app/styles/mobile-polish.css` |
| CSS import 정책 | `src/app/globals.css` |
| App shell 통합 | `src/shared/layout/app-shell.tsx` |
| Header/nav 경량화 | `src/features/shared-navigation/site-header.tsx`, `src/shared/config/site-navigation.ts`, `src/content/moonlight.ts` |
| Footer 정리 | `src/components/site-footer.tsx` |
| UI primitive 확장 | `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, 신규 `select/tabs/stepper` 후보 |
| Layout primitive 통합 | `src/components/layout/*`, `src/components/gangi/gangi-ui.tsx` |
| 홈 재정렬 | `src/app/page.tsx`, `src/features/home/gangi-home-client.tsx`, `src/components/home/*`, `src/config/home/*` |
| 사주 입력 shell | `src/features/saju-intake/saju-intake-page.tsx` |
| 성향사주 shell | `src/features/saju-personality/saju-personality-input-client.tsx`, `src/features/saju-personality/saju-personality-result-handoff-client.tsx` |
| 궁합/성향궁합 shell | `src/app/compatibility/page.tsx`, `src/features/compatibility/*` |
| 무료/타로/띠/별자리 shell | `src/app/free/page.tsx`, `src/app/today-fortune/*`, `src/app/tarot/*`, `src/app/zodiac/*`, `src/app/star-sign/*` |
| 대화/MY/가격 shell | `src/app/dialogue/*`, `src/app/my/*`, `src/app/pricing/page.tsx` |
| route mismatch 확인 | `/my/results`, `/guide`, `/about-engine`, `/method` 관련 route/sitemap/nav |

수정 금지:

- `src/domain/saju/engine/*`
- `src/domain/saju/report/*`
- `src/domain/personality/*`
- `src/domain/saju-personality/*`
- `src/domain/compatibility-personality/*`
- `src/lib/payments/*`
- `src/app/api/payments/*`
- `src/app/api/saju/personality/*`
- `src/app/api/compatibility/personality/*`
- `supabase/migrations/*`

## 13. Blockers

| 우선순위 | blocker | 설명 |
|---|---|---|
| P0 | `/my/results` route 확인 | 여러 CTA와 redirect가 사용하지만 route 파일이 확인되지 않습니다. 보관함/재조회 UX 전에 확인 필요 |
| P1 | 실제 구형 기기 성능 측정 미완료 | 정적 감사만으로는 FPS/INP/LCP를 확정할 수 없습니다. 실제 기기 또는 throttling 측정 필요 |
| P1 | sitemap mismatch | `/guide`, `/about-engine`, `/method`가 sitemap에 있으나 route 파일 미확인 |
| P1 | 공통 Select/Tabs/Stepper 부재 | 입력/탭/단계 UX가 기능별로 흩어져 디자인 시스템 이전에 기준 필요 |
| P2 | 전역 header client boundary | 디자인 수정만으로 해결되지 않고 구조 분리가 필요 |
| P2 | 스타일 문법 혼재 | `app-*`, `gangi-*`, page-local Tailwind class를 한 번에 갈아엎으면 회귀 위험 큼 |
| P2 | 로컬 untracked 파일 존재 | 현재 작업과 무관한 untracked 파일이 있어 커밋/PR 전 범위 확인 필요 |

## 14. Next Step

다음 작업은 구현이 아니라 PRD/설계 문서가 적절합니다.

추천 작업명:

`[작업 1] 달빛 결 디자인 시스템 + 사이트 IA 재정렬 PRD 작성`

포함할 결정:

| 결정 항목 | 내용 |
|---|---|
| IA | `나의 결 / 관계의 결 / 오늘의 결` 확정 |
| visual metaphor | `年 月 日 時 × I/E S/N T/F J/P` 반복 규칙 |
| component strategy | `GyeolShell`, `FlowRow`, `StepShell`, `ResultShell`, `AxisSummary` 정의 |
| mobile performance budget | blur/shadow/animation 제한, JS boundary 목표, 실제 기기 측정 기준 |
| migration strategy | 홈부터 순차 적용할지, shell primitive부터 적용할지 결정 |
| route cleanup | `/my/results`, sitemap mismatch 처리 정책 |
| guardrails | 결제/DB/계산/결과 생성 로직은 수정 금지 |

권장 순서:

1. 달빛 결 디자인 시스템 PRD 작성
2. `/my/results`와 sitemap mismatch 확인
3. mobile performance budget 수립
4. `GyeolShell/StepShell/ResultShell` 설계
5. 홈부터 작은 단위로 적용
6. 성향사주/성향궁합 shell만 교체
7. 기존 사주/무료운세/타로/MY/가격으로 확장
