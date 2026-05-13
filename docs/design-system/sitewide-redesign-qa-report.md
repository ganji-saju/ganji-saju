# Sitewide Redesign QA Report

작성일: 2026-05-12

## Executive Summary

달빛 결 디자인 시스템 v2 적용 후 홈, 사주, 성향사주, 궁합, 성향궁합, 오늘운세, 타로, 띠운세, 별자리, 대화방, 보관함, 가격 페이지의 구조/빌드/회귀 검수를 수행했다.

정적 검수와 자동 검수 기준으로는 치명적인 빌드/타입/라우트 blocker는 없다. 다만 현재 워킹트리가 `main` 브랜치에서 미커밋 변경 상태이고, `preflight`가 기존 경고 2개를 보고하므로 PR/배포 전에는 브랜치/커밋 정리와 실기기 모바일 시각 QA를 추가로 확인해야 한다.

## Current Branch / Scope

- 현재 브랜치: `main`
- QA 기준: 현재 워킹트리 변경사항 전체
- 코드 수정 여부: 없음
- 문서 생성: `docs/design-system/sitewide-redesign-qa-report.md`

주의할 점:

- `git status --short` 기준 다수의 수정/추가 파일이 남아 있다.
- `backup-before-personality-compatibility-full.sql`, `supabase/data_table_backup/` 같은 백업성 파일도 untracked 상태로 보인다.
- main에 직접 작업된 상태라면 배포/PR 전 별도 브랜치 정리 또는 커밋 범위 확인이 필요하다.

## Command Validation

package.json에 실제 존재하는 명령만 실행했다.

| 명령 | 결과 | 메모 |
|---|---|---|
| `npm run lint` | 통과 | `verify:imports` 6/6 통과 |
| `npm run typecheck` | 통과 | `tsc --noEmit` 오류 없음 |
| `npm test` | 통과 | 177개 단위 테스트 + node test 5개 통과 |
| `npm run build` | 통과 | Next.js 16.2.3 production build 통과, 125개 static page 생성 |
| `git diff --check` | 통과 | whitespace 오류 없음 |
| `npm run preflight` | 경고 2개 | uncommitted 변경사항, `src/proxy.ts`는 있지만 `src/middleware.ts` 없음 |
| `npm run smoke` | 통과 | 1차는 dev server 미실행으로 실패, `npm run dev` 실행 후 20/20 통과 |
| `ANALYZE=true npm run build` | 통과 | sandbox 네트워크 제한으로 1차 Google Fonts fetch 실패, 네트워크 허용 후 통과 |

## Route QA

`npm run dev` 실행 후 주요 route HTTP 응답을 확인했다.

| route | 결과 |
|---|---|
| `/` | 200 |
| `/saju/new` | 200 |
| `/saju/personality` | 200 |
| `/saju/personality/result` | 200 |
| `/compatibility` | 200 |
| `/compatibility/input` | 200 |
| `/compatibility/personality` | 200 |
| `/compatibility/personality/result` | 200 |
| `/today-fortune` | 200 |
| `/tarot/daily` | 200 |
| `/zodiac` | 200 |
| `/star-sign` | 200 |
| `/dialogue` | 200 |
| `/my` | 200 |
| `/pricing` | 200 |

`npm run smoke` 추가 확인:

- 홈, 오늘운세, 사주 시작, 궁합, 궁합 입력, 타로, 멤버십, 가격, 로그인, 개인정보처리방침, 이용약관, 알림 설정, My 페이지, redirect alias, Geo API, Today Fortune API, Interpret API 모두 기대 상태로 응답했다.

## Design Consistency QA

정적 코드 기준으로 다음 구조를 확인했다.

- 홈은 `AppShell` + `SiteHeader` + 달빛 결 홈 섹션 구조를 사용한다.
- 기본 사주 입력, 성향사주 입력, 기본 궁합, 성향궁합 입력, 오늘운세, 타로, 띠운세, 별자리, 대화방, 보관함, 가격/멤버십 페이지가 `AppShell`과 `SiteHeader` 계열을 사용한다.
- 모바일 bottom nav는 `SiteHeader` 내부 `MobileBottomNav`에서 제공되며 `safe-area` clearance는 CSS token으로 관리된다.
- 성향사주/성향궁합 입력은 `FusionStrip`, `StepFlowShell`, `StickyActionBar`를 사용한다.
- 성향사주/성향궁합/기본 사주/기본 궁합 결과는 `ResultShell`, `AxisMeter`, `SafetyNotice` 계열로 정리되어 있다.

확인한 주요 파일:

- `src/features/home/gangi-home-client.tsx`
- `src/features/shared-navigation/site-header.tsx`
- `src/features/saju-personality/saju-personality-input-client.tsx`
- `src/features/saju-personality/saju-personality-result-handoff-client.tsx`
- `src/features/compatibility/personality-compatibility-input-client.tsx`
- `src/features/compatibility/personality-compatibility-result-client.tsx`
- `src/app/saju/[slug]/page.tsx`
- `src/features/compatibility/compatibility-result-view.tsx`
- `src/app/styles/tokens.css`
- `src/app/styles/components.css`
- `src/app/styles/mobile-polish.css`

## Mobile QA

실행 환경 한계로 실제 iOS Safari/Android Chrome 실기기 렌더링은 수행하지 못했다. 대신 정적 구조, responsive CSS, route 응답, build 결과를 기준으로 검수했다.

| 기준 | 결과 |
|---|---|
| 360px | 정적 구조상 bottom nav clearance와 sticky CTA 여백 적용. 실기기 시각 확인 필요 |
| 375px | 정적 구조상 모바일 first class 적용. 실기기 시각 확인 필요 |
| 390px | 정적 구조상 홈 CTA/FlowEntryList 우선 노출 구조. 실기기 시각 확인 필요 |
| 430px | 정적 구조상 카드 grid보다 flow/list 중심 구조. 실기기 시각 확인 필요 |
| iOS Safari | safe-area CSS 적용 확인. Safari 실기기 확인 필요 |
| Android Chrome | route/build 통과. 저사양 Android 실제 tap response 확인 필요 |

모바일 기준 확인:

- 첫 화면 브랜드 표현은 홈 `FusionHero`/Flow copy에서 사주×성향 결합을 노출한다.
- 성향사주/성향궁합 입력은 active step 중심이다.
- CTA는 `StickyActionBar`와 44px 이상 버튼 계열을 사용한다.
- 카드 과다 사용은 이전 대비 줄었지만, 일부 내부 결과/대화/타로 페이지에는 아직 카드형 패널과 shadow가 남아 있다.

## Performance QA

이전 작업에서 적용한 성능 최적화가 유지되어 있음을 확인했다.

- 전역 Noto Sans KR weight는 `400/500/600/700/800`으로 축소되어 있다.
- 홈은 큰 이미지 hero 없이 Server Component 중심 구조이며 analytics는 client island로 분리되어 있다.
- `SiteHeader`의 미사용 desktop sidebar dead code가 제거되어 client module 부담이 줄었다.
- notification heartbeat는 idle 시점으로 지연된다.
- `framer-motion`, `lottie`, `recharts`, `chart.js`, `d3`, `gsap`, `swiper` dependency는 없다.
- `.next/static` 확인값은 약 `10M`, 파일 193개다.

남은 성능 리스크:

- `SiteHeader`는 여전히 auth/session/credit state를 포함한 전역 client boundary다.
- `UnifiedBirthInfoFields`, `dialogue-chat-panel`, tarot picker는 route별 hydration 비용이 남아 있다.
- `tw-animate-css`와 일부 큰 shadow/backdrop blur는 구형 기기에서 paint 비용이 될 수 있다.
- bundle analyzer dependency가 없어 `ANALYZE=true` 빌드는 별도 분석 리포트를 생성하지 않는다.

## Payment / Entitlement Regression QA

정적 검수와 테스트 기준:

- 기존 Toss 결제 route와 membership checkout route는 build/smoke에서 깨지지 않았다.
- 결제 관련 단위 테스트가 통과했다.
- 성향궁합/성향사주 990원 상품 entitlement 관련 테스트가 통과했다.
- 결과 API는 user ownership과 entitlement를 확인한 뒤 paid/free 노출을 분기한다.

실결제 확인 필요:

- Toss live 또는 sandbox 분리 환경에서 1건 결제 확인.
- `saju_personality_mini`, `personality_compatibility_mini` 운영 상품 코드/redirect 확인.
- 구매 이력 기반 재열람을 실제 로그인 사용자로 확인.

## Privacy / Analytics QA

PII 검색어를 source 기준으로 검색했다.

검색어:

- `birth`
- `birthDate`
- `birth_time`
- `gender`
- `displayName`
- `name`
- `rawAnswer`
- `answers_json`

결과 해석:

- 다수의 match는 입력, 프로필 저장, 사주 계산, API persistence에서 필요한 개인정보 처리 코드다.
- 홈 analytics payload는 `source`, `section`, `target`, `featureId`, `serviceId`만 사용한다.
- 성향사주 analytics payload는 `lifeArea`, `productCode`, `reportType`, `channel`, `rating`, `source` 중심이다.
- 성향궁합 analytics payload는 `relationshipType`, `resultType`, `productCode`, `amount`, `shareMethod`, `source` 중심이다.
- 공유 카드 builder는 키워드, 축 요약, 오늘의 한마디, 다시 보기 링크 중심이며 이름/생년월일시/성별/상세 원국/성향 체크 원문을 직접 넣지 않는다.
- 성향사주 report API는 저장/재조회 응답에서 `birthInput`, `birthSummary`, `displayName`, `personalityAnswers`를 제거하는 sanitizer를 둔다.

주의:

- 성향궁합 결과 화면 자체에는 현재 입력 직후 `payload.self.birthSummary`, `payload.partner.birthSummary`가 표시된다. 이는 공유/analytics 노출은 아니지만, 화면 캡처 공유 시 개인정보가 보일 수 있으므로 UX 정책 확인이 필요하다.
- 기본 궁합/기본 사주 저장 흐름에는 이름/생년월일시가 자연스럽게 쓰이는 기존 구조가 있으므로, 공유 카드/analytics와 구분해서 봐야 한다.

## Forbidden Phrase QA

검색어:

- 공식 MBTI
- MBTI 검사
- MBTI 진단
- 심리검사
- 무조건
- 반드시
- 절대
- 최악
- 파멸
- 질병
- 투자하면
- 이 직업만

결과:

- `guardrails.ts`와 테스트 파일에는 금지 표현을 탐지/완화하기 위한 의도된 match가 있다.
- prompt instruction과 verification code에는 JSON 출력 강제, 단정 표현 검사 용도의 `반드시`, `무조건`, `절대` match가 있다.
- user-facing 가능성이 있는 콘텐츠에도 일부 match가 남아 있다.

검토 필요 match:

- `src/content/moonlight.ts`: `반드시 실패`를 단정 표현 예시로 사용.
- `src/lib/engine-method-pages.ts`: `무조건 틀려서가 아니라`, `반드시 이별한다`를 설명/비판 예시로 사용.
- `src/app/privacy/page.tsx`: `절대적인 보안` 표현.
- `src/lib/dialogue-experts.ts`: avoid rule에 `무조건`, `질병` 표현.
- `src/app/api/credits/use/route.ts`: `무조건 돈이 들어온다는 약속보다`, `특정 질병을 뜻하는 것이 아니라` 표현.

판정:

- 공포성 단정으로 쓰인 문구는 확인되지 않았다.
- 다만 금지 표현 자체를 user-facing 예시/부정문에 포함한 항목이 있어, 배포 전 “표현 자체 미노출” 기준이면 치환이 필요하다.

## Blockers

치명 blocker:

- 없음.

조건부 blocker 또는 확인 필요:

- 현재 `main` 브랜치에 미커밋 변경이 남아 있다.
- `preflight`가 uncommitted 변경사항과 `src/proxy.ts`/`src/middleware.ts` 상태를 경고한다.
- 실기기 iOS Safari/Android Chrome 시각 QA는 미완료다.
- 금지 표현 검색어가 일부 user-facing 가능 텍스트에 “예시/부정문” 형태로 남아 있다.
- 운영 결제/권한/재열람은 실제 로그인 사용자와 Toss 환경에서 최종 smoke가 필요하다.

## Go / No-Go Decision

현재 자동 검수와 정적 QA 기준으로는 조건부 Go다.

main merge 또는 production 배포 전 조건:

1. 현재 워킹트리를 의도한 브랜치/커밋 단위로 정리한다.
2. 실기기 또는 BrowserStack 수준에서 360/375/390/430px iOS Safari/Android Chrome 시각 QA를 수행한다.
3. 금지 표현이 “예시/부정문에서도 노출되면 안 된다”는 정책이면 위 match를 치환한다.
4. 운영 Toss/Supabase/analytics에서 결제, 저장, 재열람, 이벤트 유입을 1회 이상 확인한다.
