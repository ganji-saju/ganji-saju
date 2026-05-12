# Sitewide Design Audit

## 1. Executive Summary

이번 조사는 코드 수정 없이 `main` 기준으로 전체 route, UI component, style/CSS, responsive risk, mobile performance risk, 12간지 대화방 일관성을 확인했다.

핵심 결론:

- 사이트는 기능적으로 `AppShell`과 `SiteHeader`를 많이 공유하지만, 실제 화면 스타일은 `app-*`, `gyeol-*`, `gangi-*`, shadcn token, 직접 Tailwind class가 섞여 있다.
- 홈/성향사주/성향궁합에는 Moonlight Flow 계열이 들어왔지만, 기존 사주/오늘운세/타로/계정/결제 페이지에는 old Gangi/Card style이 많이 남아 있다.
- 모바일 성능 리스크는 특정 한 파일보다 전역 client header, 많은 client form, shadow/blur/animation, tarot image/carousel, chat panel height 계산이 겹쳐 생긴다.
- 대화방 persona 데이터와 채팅 room은 12간지 체계를 유지한다. 다만 `/dialogue` entry UI에 "오늘의 추천 간지"와 "전체 12간지" 구분을 명확히 적용해야 한다.

## 2. Route Inventory Summary

상세 목록: `docs/design-system/route-inventory.md`

- 조사한 route/layout 파일: 65개
- `src/pages` 없음
- `template.tsx` 없음
- 주요 route group:
  - Home/Auth/Legal
  - Saju/My Reading
  - Compatibility/Relationship
  - Today/Tarot/Zodiac/Star sign/Free content
  - Dialogue
  - My/Payment/Pricing/Membership

가장 먼저 통일해야 할 route군:

1. 홈: `/`
2. 내 풀이: `/saju/new`, `/saju/personality`, `/saju/[slug]`
3. 관계: `/compatibility`, `/compatibility/personality`, `/compatibility/result`
4. 오늘: `/today-fortune`, `/tarot/daily`, `/zodiac`, `/star-sign`
5. 대화: `/dialogue`, `/dialogue/[expert]`
6. 보관함/가격: `/my`, `/pricing`, `/membership`

## 3. Layout / Navigation Inventory

핵심 파일:

- `src/app/layout.tsx`
- `src/shared/layout/app-shell.tsx`
- `src/features/shared-navigation/site-header.tsx`
- `src/shared/config/site-navigation.ts`
- `src/content/moonlight.ts`
- `src/components/site-footer.tsx`

현재 구조:

- Root layout에서 Noto Sans KR, Vercel Analytics, SpeedInsights, recovery redirect를 전역 로드한다.
- `AppShell`은 header/footer/dock을 받는 구조다.
- `SiteHeader` 하나가 desktop nav, mobile top header, mobile menu, bottom nav, auth, coin fetch, notification heartbeat를 모두 담당한다.
- nav data는 `src/content/moonlight.ts`의 `PRIMARY_TABS`, `HEADER_SHORTCUTS`가 source다.

문제:

- `SiteHeader`가 모든 페이지에서 큰 client boundary로 로드된다.
- mobile bottom nav와 mobile menu가 모두 존재해 화면 높이/정보량이 커진다.
- `app-shell.css`와 `mobile-polish.css`가 `!important`로 header/dock을 다시 덮어쓴다.
- Footer는 안정적이지만 app/gyeol visual language와 더 연결될 여지가 있다.

## 4. Component Inventory Summary

상세 목록: `docs/design-system/component-inventory.md`

- `src/components` + `src/features` TS/TSX 파일: 123개
- `use client` 파일: 56개

주요 계층:

- Shell/navigation: `AppShell`, `SiteHeader`, `SiteFooter`
- Moonlight v2: `FusionHero`, `FusionStrip`, `FlowEntryList`, `StepFlowShell`, `ResultShell`, `AxisMeter`, `SafetyNotice`
- Legacy Gangi: `GangiCharacter`, `GangiPageHeader`, `GangiListLink`, `GangiMarket`
- UI primitive: `Button`, `Card`, `Input`, `Badge`, `Label`, `Separator`
- Feature clients: saju intake, saju personality, compatibility personality, dialogue chat, today fortune, notifications

## 5. Style Debt Summary

상세 목록: `docs/design-system/style-debt-map.md`

핵심 style debt:

- `className` 직접 사용처가 3,000개 이상.
- arbitrary style 검색 결과가 1,500줄 이상.
- `--app-*`와 `--gyeol-*`가 함께 있고, shadcn token도 남아 있다.
- `components.css`가 약 91KB로 가장 크며 legacy/new component style이 섞여 있다.
- `mobile-polish.css`는 screenshot-driven patch 성격이라 장기 기준서로 쓰기 어렵다.

원인:

- 페이지별로 "빠르게 보기 좋게 만든 class"가 많아졌고, 나중에 공통 컴포넌트로 흡수되지 않았다.
- 버튼/카드/패널/섹션/입력/칩/결과 shell의 semantic variant가 부족하거나 우회되고 있다.

## 6. Responsive Risk Summary

상세 목록: `docs/design-system/responsive-risk-map.md`

주요 리스크:

- 360px에서 header actions와 brand width가 충돌할 수 있다.
- bottom nav, sticky CTA, chat composer, print action sticky가 동시에 존재한다.
- `100svh`, `100dvh`, `calc(100dvh - ...)`가 여러 CSS 파일에서 별도로 쓰인다.
- `grid-cols-4`, `grid-cols-5`, `min-w-[920px]`, `overflow-x-auto`가 일부 route에 남아 있다.
- mobile width clamp가 `mobile-polish.css`에서 강하게 적용되어 tablet 전환 전 어색할 수 있다.

## 7. Mobile Performance Risk Summary

상세 목록: `docs/design-system/performance-risk-map.md`

주요 리스크:

- 전역 `SiteHeader`가 client component이고 session/credit/notification sync를 담당한다.
- 큰 client form이 많다: 기본 사주, 성향사주, 성향궁합, 로그인, 프로필.
- `backdrop-blur`, 큰 shadow, `transition-all`, hover transform이 core UI에 남아 있다.
- hero video asset과 tarot image asset이 존재한다.
- `tw-animate-css`가 global import되어 실제 사용 대비 비용 확인이 필요하다.

## 8. Saju x Personality Brand Consistency Gap

잘 된 부분:

- `FusionStrip`이 `年 月 日 時 × I/E S/N T/F J/P` 메타포를 제공한다.
- 성향사주/성향궁합 입력과 결과에 Moonlight Flow 계열이 들어왔다.
- 홈은 "나의 결 / 관계의 결 / 오늘의 결" 구조로 이동했다.

부족한 부분:

- 기본 사주와 기본 궁합 결과는 아직 Moonlight ResultShell과 완전히 같지 않다.
- 오늘운세/타로/띠운세/별자리는 "오늘의 결"로 묶이는 visual grammar가 약하다.
- 대화방은 12간지 character grammar가 강한 반면, 성향사주/성향궁합은 Fusion grammar가 강해서 두 시스템의 연결 규칙이 필요하다.

방향:

- 모든 페이지의 상단은 `PageIntro` 또는 `FusionHero/SajuStrip` 계열로 통일.
- 결과는 `ResultShell + 핵심 요약 + axis/section + SafetyNotice`로 통일.
- 오늘 페이지군은 `TodayStrip` 또는 `DailyFlowRow` 같은 가벼운 공통 표현을 별도 정의.
- 12간지 대화방은 Moonlight Flow 안의 "대화 캐릭터 layer"로 보이게 하고, 4명 추천 중심 문구는 줄인다.

## 9. Zodiac Dialogue Consistency Check

관련 파일:

- `src/lib/dialogue-experts.ts`
- `src/app/dialogue/page.tsx`
- `src/app/dialogue/[expert]/page.tsx`
- `src/components/dialogue/dialogue-chat-panel.tsx`
- `src/components/gangi/gangi-ui.tsx`
- `src/content/moonlight.ts`
- `src/app/api/ai/route-helpers.ts`
- `src/app/api/ai/route.ts`
- `src/app/api/ai/route.test.ts`

확인 결과:

- `DIALOGUE_EXPERTS`는 12간지 전체를 유지한다.
- `/dialogue/[expert]`는 expert id 기반 12간지 채팅 room을 유지한다.
- `DialogueChatPanel`도 전문 분야 변경에서 12간지 전체를 보여준다.
- `/dialogue` entry만 `RECOMMENDED_EXPERT_IDS = ['dragon', 'rat', 'sheep', 'ox']`와 "자주 이어지는 질문 4가지" 문구로 4명 추천을 먼저 보여준다.

판단:

- 기존 대화방 표현은 실제 persona 체계가 12개이므로, UI 카피와 entry 구조도 12간지 캐릭터 중심으로 유지해야 한다.
- 다음 디자인 작업에서 `/dialogue`는 "12간지 전체가 기본, 추천은 보조 필터"로 재정렬해야 한다.

## 10. High Risk Files

우선순위가 높은 파일:

1. `src/features/shared-navigation/site-header.tsx`
2. `src/app/styles/components.css`
3. `src/app/styles/app-shell.css`
4. `src/app/styles/mobile-polish.css`
5. `src/features/home/gangi-home-client.tsx`
6. `src/features/saju-intake/saju-intake-page.tsx`
7. `src/features/saju-personality/saju-personality-input-client.tsx`
8. `src/features/compatibility/personality-compatibility-input-client.tsx`
9. `src/app/saju/[slug]/page.tsx`
10. `src/features/compatibility/compatibility-result-view.tsx`
11. `src/features/compatibility/personality-compatibility-result-client.tsx`
12. `src/features/saju-personality/saju-personality-result-handoff-client.tsx`
13. `src/app/dialogue/page.tsx`
14. `src/components/dialogue/dialogue-chat-panel.tsx`
15. `src/app/tarot/daily/pick/tarot-card-picker.tsx`
16. `src/app/login/page.tsx`
17. `src/components/my/profile-manager.tsx`
18. `src/features/notifications/notification-center-page.tsx`

## 11. Recommended Refactor Order

다음 단계는 아래 순서가 안전하다.

1. 디자인 시스템 PRD: Moonlight Flow와 12간지 캐릭터 layer 관계를 먼저 확정.
2. 토큰 정리: `app-*`, `gyeol-*`, shadcn token의 역할을 분리하고 alias를 만든다.
3. Shell/Nav: `SiteHeader`를 server shell + client islands로 쪼개고 bottom nav 기준을 고정.
4. 공통 UI primitive: Button/Input/Panel/Section/Chip/ResultShell semantic variant를 확정.
5. 홈 적용: card grid를 줄이고 flow row 중심으로 유지.
6. 내 풀이 페이지군 적용: `/saju/new`, `/saju/personality`, `/saju/[slug]`.
7. 관계 페이지군 적용: `/compatibility`, `/compatibility/personality`, 결과군.
8. 오늘 페이지군 적용: 오늘운세/타로/띠운세/별자리.
9. 12간지 대화방 적용: 4명 추천 중심이 아니라 12간지 전체 체계로 entry 재정렬.
10. 보관함/가격 적용: list/row 중심으로 마무리.
11. 자동 스크린샷 QA: 360/375/390/430/tablet/desktop.
12. 모바일 성능 최적화: client boundary, blur/shadow, asset loading, active step rendering.
13. 최종 QA: lint/typecheck/test/build/smoke/visual.

## 12. Do Not Modify Areas

이번 디자인 정리에서 건드리지 말아야 할 영역:

- 사주 계산 엔진: `src/domain/saju/**`
- 성향 계산/점수 로직: `src/domain/personality/**`, `src/domain/saju-personality/**`, `src/domain/compatibility-personality/**`
- 결제/권한 로직: `src/lib/payments/**`, `src/app/api/payments/**`, Toss checkout components의 business logic
- DB/Supabase migration: `supabase/migrations/**`
- 12간지 persona source of truth: `src/lib/dialogue-experts.ts`의 의미/로직
- AI route prompt/business logic: `src/app/api/ai/**`
- 개인정보 저장/조회 policy: `src/lib/profile.ts`, report API 저장 로직

## 13. Next Step

[작업 1]에서는 구현 없이 `docs/design-system/moonlight-flow-sitewide-prd.md` 형태로 PRD를 작성하는 것이 안전하다.

PRD에 반드시 포함할 결정:

- `Moonlight Flow`와 `12간지 대화방`의 관계.
- `app-*`와 `gyeol-*` token의 병합/alias 전략.
- 모바일 bottom nav 정보 구조.
- route group별 표준 shell.
- 결과 화면 공통 구조.
- 성능 예산과 금지 style.
