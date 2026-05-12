# 전체 복구 최종 QA 리포트

## Executive Summary

복구 작업 1~3 이후 자동 검수는 통과했다. `lint`, `typecheck`, `test`, `build`, `git diff --check` 모두 성공했으며, build route table 기준 주요 복구 대상 route는 생성된다.

다만 최종 판정은 **조건부 보류**다. 현재 in-app browser에서 `localhost:3000` route 이동이 차단되어 실제 화면/클릭/반응형 스크린샷 QA를 수행하지 못했다. 또한 today-fortune fallback 흐름에서 Supabase service 저장이 실패하거나 service env가 없을 때 `sourceSessionId`가 생년월일/성별/출생지 기반 slug로 노출될 수 있는 개인정보 리스크를 확인했다.

## Current Branch / Changed Files

- 현재 브랜치: `recovery/sitewide-design-stabilization`
- 변경 요약: P0 기능 회귀 복구, 반응형 wrapper 복구, 미적용 페이지 디자인 시스템 적용, QA 문서 추가
- 변경 파일 수: 코드 15개, 문서 3개

## Automated Validation

| Command | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass, 181 unit tests + 5 node tests |
| `npm run build` | Pass, 125 static pages generated |
| `git diff --check` | Pass |

## Route QA Result

| Route | Result | Evidence |
|---|---|---|
| `/` | Pass by build | Next build route table includes `/` |
| `/saju/personality` | Pass by build/static review | route exists and renders `SajuPersonalityInputClient` |
| `/saju/personality/result` | Pass by build/static review | route exists and renders `SajuPersonalityResultHandoffClient` |
| `/today-fortune?concern=general` | Pass by build/static review, live browser unverified | route exists and API action path remains connected |
| `/compatibility` | Pass by build/static review | route exists and now uses `PageIntro`, `FusionStrip`, `LightSection`, `FlowEntryList` |
| `/compatibility/personality` | Pass by build/static review | route exists and renders `PersonalityCompatibilityInputClient` |
| `/dialogue` | Pass by build/static review | route exists and uses 12간지 `DIALOGUE_EXPERTS` |
| `/pricing` | Pass by build | route exists |
| `/archive` | Fail / route mismatch | `src/app/archive` route is absent. Current archive-like routes are `/my` and `/vault` |

## Functional QA

| Item | Result | Notes |
|---|---|---|
| `/saju/personality` 입력 가능 | Static pass, live unverified | route/client 연결 유지 |
| 무료 결과 생성 가능 | Static pass, live unverified | result handoff keeps local payload generation path |
| `/saju/personality/result` 표시 가능 | Static pass, live unverified | result handoff route/build pass |
| 990원 깊이보기 CTA 표시 | Static pass | `checkoutHref` builds `/membership/checkout?product=saju_personality_mini&scope=...` |
| 결제 연결 route 정상 | Static/test pass | product-scope and confirmation tests cover `saju_personality_mini` |
| paid/unpaid 분기 정상 | Static/test pass | reports API checks entitlement by `scope_key`; unpaid snapshot keeps paid sections locked |
| today-fortune 무료 결과 생성 가능 | Static pass, live unverified | P0 fix prevents auth/env lookup failure from breaking guest result generation |
| compatibility 기본 입력 가능 | Static pass | `/compatibility/input?relationship=...` links preserved |
| compatibility/personality 기존 흐름 유지 | Static pass | route and client unchanged in this QA step |
| 12간지 대화방 유지 | Pass by static search | 12 characters remain in `src/content/moonlight.ts`, `src/components/gangi/gangi-ui.tsx`, `src/lib/dialogue-experts.ts` |

## Responsive QA

| Criterion | Result |
|---|---|
| PC에서 `/saju/personality`가 430px 고정으로 보이지 않음 | Static pass, live unverified |
| form panel은 적정 폭 중앙 정렬 | Static pass: `gangi-responsive-form-panel` max-width 기준 적용 |
| page container는 desktop에서 충분한 폭 사용 | Static pass: `gangi-responsive-page` max-width 기준 적용 |
| result panel은 form보다 넓게 허용 | Static pass: `gangi-responsive-result-panel` 기준 적용 |
| header와 본문 간격 정상 | Build pass, live unverified |
| 가로 스크롤 없음 | Live unverified |
| 모바일 CTA 44px 이상 | Static partial pass: 주요 공통 버튼/row는 min-height 기준 사용 |

브라우저 기반 breakpoint QA는 수행하지 못했다. in-app browser에서 `localhost:3000` route 이동이 차단되어 360/390/430/768/1024/1280/1440px 스크린샷 확인은 Preview 또는 실기기에서 진행해야 한다.

## Design QA

- `/today-fortune`은 `SajuStrip`, `LightSection`, `ChoiceRow`, form/result panel 기준을 적용했다.
- `/today-fortune/result`는 결과 없음 fallback과 follow-up 영역을 `LightSection`으로 정리했다.
- `/compatibility`는 구형 `PageHero`, `SectionSurface`, `ProductGrid`, `FeatureCard` 중심 구조에서 달빛 결 flow/list 구조로 변경했다.
- `/compatibility` 기본 궁합 링크와 `/compatibility/personality` 확장 CTA는 유지했다.

## Payment / Entitlement QA

- `saju_personality_mini` product code 사용 위치 확인 완료.
- `personality_compatibility_mini`와 혼동되는 결제 연결은 발견하지 못했다.
- 결제 success redirect는 `buildPurchasedProductHref('saju_personality_mini', ...)` 테스트로 `/saju/personality/result?paid=saju_personality_mini&scope=...`를 확인했다.
- report API는 entitlement가 있으면 기존 free snapshot row도 paid report로 매핑하도록 보강되어 있다.

## Zodiac Dialogue QA

- 12간지 캐릭터 노출 데이터 확인:
  - 자(子)쥐
  - 축(丑)소
  - 인(寅)호랑이
  - 묘(卯)토끼
  - 진(辰)용
  - 사(巳)뱀
  - 오(午)말
  - 미(未)양
  - 신(申)원숭이
  - 유(酉)닭
  - 술(戌)개
  - 해(亥)돼지
- 4명 선생님 표현 검색 결과: source runtime 코드에서는 잔존 없음.
- 기존 `/dialogue` route는 12간지 리스트와 redirect 구조를 유지한다.

## Forbidden Copy Review

검색어:

- `엠지쥐선생`
- `명리호선생`
- `궁합양선생`
- `오늘소선생`
- `추천 선생님 4명`
- `선생님 선택하기`
- `공식 MBTI`
- `MBTI 검사`
- `MBTI 진단`
- `무조건`
- `반드시`
- `절대`
- `최악`
- `파멸`

결과:

- 4명 선생님 표현은 runtime source에서 발견되지 않았다.
- `공식 MBTI`, `MBTI 진단`, 단정 표현은 guardrails, tests, docs, prompt instruction, 안전/검증 코드에서 발견된다.
- 일부 기존 사용자 노출 가능성이 있는 레거시 문구도 있다. 예: `src/app/privacy/page.tsx`의 `절대적인 보안`, `src/lib/engine-method-pages.ts`의 단정 표현 비판 예시.
- 이번 복구 작업에서 신규로 금지 표현을 사용자 화면에 추가하지는 않았다.

## PII Review

검색어:

- `birth`
- `birthDate`
- `birth_time`
- `gender`
- `displayName`
- `name`
- `rawAnswer`
- `answers_json`

결과:

- 입력 폼, 프로필 관리, 사주/궁합 계산 구조에는 생년월일/성별/이름 필드가 정상적으로 존재한다.
- 성향사주 analytics payload는 `lifeArea`, `productCode`, `reportType`, `channel` 중심이며 이름/생년월일/성별을 직접 넣지 않는다.
- 홈 analytics payload는 `target`, `featureId`, `serviceId`, `section` 중심이다.
- **주의:** today-fortune은 `sourceSessionId`를 URL과 analytics payload에 전달한다. Supabase service 저장이 실패하거나 service env가 없을 때 `sourceSessionId = toSlug(parsed.input)` fallback이 사용되어 생년월일/성별/출생지 기반 값이 노출될 수 있다.

## Browser QA

- Browser plugin path를 시도했지만 `localhost:3000` route 이동이 차단되었다.
- 차단 이후 우회 브라우저, raw CDP, 별도 Playwright fallback은 시도하지 않았다.
- 따라서 live DOM, screenshot, click interaction, breakpoint visual QA는 미완료다.

## Blockers

1. `sourceSessionId` PII fallback risk: `src/app/api/today-fortune/route.ts`에서 service 저장 실패 시 `toSlug(parsed.input)`이 URL/analytics에 노출될 수 있다.
2. `/archive` route missing: 요청된 QA target route가 실제 App Router에 없다. 현재 보관함 경로는 `/my` 또는 `/vault`다.
3. Visual QA blocked: localhost route 이동 차단으로 주요 route와 breakpoint 실화면 검수를 수행하지 못했다.

## Go / No-Go Decision

**조건부 보류.**

자동 검수와 정적 구조 기준으로 복구 변경은 안정적이다. 다만 main merge 전에는 아래 중 하나를 완료해야 한다.

1. today-fortune `sourceSessionId`가 production에서 항상 opaque reading id로 발급되는지 확인하거나, fallback slug를 비식별 id로 바꾼다.
2. `/archive` route가 필요한지 결정한다. 필요하면 별도 route 추가, 아니면 QA 기준을 `/my` 또는 `/vault`로 수정한다.
3. Preview 또는 실기기에서 `/saju/personality`, `/today-fortune`, `/compatibility`, `/dialogue`, `/pricing`의 360/390/430/desktop 화면을 확인한다.

## Post-QA Next Step

- P0. today-fortune sourceSessionId PII fallback 제거 또는 production env 보장 확인
- P1. `/archive` route 기준 정리
- P1. Preview 실기기 QA 수행
- P2. 오늘운세 결과 내부 legacy `app-*` token 잔존 정리
