# 달빛인생 사이트 전체 리디자인 최종 QA 리포트

작성일: 2026-05-12

## 1. Executive Summary

달빛 결 디자인 시스템 적용 범위에 대해 자동 검수, route smoke, visual screenshot QA, 브라우저 기반 핵심 화면 확인, 금지 표현/PII 검색을 수행했다.

결론은 **조건부 Go**다. `lint`, `typecheck`, `test`, `build`, `git diff --check`, `smoke`, `visual:qa`는 최종 통과했다. 다만 현재 작업은 `main` 브랜치의 dirty worktree에 쌓여 있으므로, 배포 전에는 반드시 별도 release 브랜치 또는 PR 단위로 커밋 범위를 정리해야 한다.

## 2. Current Branch / Commit

| 항목 | 값 |
|---|---|
| 현재 브랜치 | `main` |
| 현재 HEAD | `b1823ef` |
| 작업트리 상태 | dirty |
| `main...HEAD` diff | 현재 브랜치가 `main`이라 committed branch diff 없음 |
| 실제 검토 기준 | uncommitted working tree diff |

## 3. Changed Files Summary

`git diff --stat` 기준 tracked 변경은 52개 파일, `2106 insertions / 1531 deletions`다. `git status --short` 기준 전체 변경 항목은 78개였고, 이 중 untracked 문서/스크립트/공통 컴포넌트가 포함된다.

주요 변경군:

- 디자인 토큰/global style: `src/app/styles/*`, `src/app/layout.tsx`
- AppShell/Header/BottomNav: `src/shared/layout/app-shell.tsx`, `src/features/shared-navigation/site-header.tsx`
- 공통 UI: `src/components/moonlight/*`, `src/components/gangi/gangi-ui.tsx`
- 홈: `src/features/home/*`
- 내 풀이/관계/오늘/대화/보관함/가격 페이지군: `src/app/**`, `src/features/**`
- 12간지 대화방: `src/lib/dialogue-experts.ts`, `src/app/dialogue/*`
- QA/설계 문서: `docs/design-system/*`, `docs/performance/*`
- Visual QA 스크립트: `scripts/visual-screenshot.mjs`, `package.json`

백업/스크린샷 산출물 보호:

- `/artifacts/screenshots/`, `/artifacts/visual-qa/`는 `.gitignore` 처리됨.
- `/backup-before-*.sql`, `/supabase/data_table_backup/`도 `.gitignore` 처리해 백업성 데이터 커밋 위험을 줄였다.

## 4. Design System Application Summary

달빛 결 디자인 시스템은 홈과 주요 내부 페이지에 다음 기준으로 반영됐다.

- 1차 내비게이션은 `홈 / 내풀이 / 관계 / 오늘 / 대화` 흐름으로 정리됐다.
- 모바일 하단 nav와 상단 header가 같은 AppShell 안에서 반복된다.
- `FusionStrip`, `PageIntro`, `LightSection`, `StepFlowShell`, `AxisMeter`, `SafetyNotice` 계열이 주요 페이지군에 적용됐다.
- 홈은 카드 나열보다 `나의 결 / 관계의 결 / 오늘의 결 / 12간지 대화` 흐름 중심으로 재구성됐다.
- 입력 페이지는 active step 중심으로 정리되어 긴 폼을 한 번에 모두 보여주는 부담을 줄였다.
- 12간지 대화방은 4명 선생님 구조가 아니라 12간지 캐릭터 세계관으로 유지됐다.

## 5. Route QA Result

| Route | QA 결과 | 비고 |
|---|---|---|
| `/` | 통과 | smoke, visual QA, Browser screenshot 확인 |
| `/saju/new` | 통과 | visual QA 포함 |
| `/saju/[slug]` | 조건부 통과 | build route 생성 확인, 실제 slug 데이터 수동 검수는 배포 smoke 필요 |
| `/saju/personality` | 통과 | visual QA, Browser CTA 이동 확인 |
| `/saju/personality/result` | 조건부 통과 | build route 생성 확인, session payload 기반 전체 결과 상태는 별도 실데이터 smoke 필요 |
| `/compatibility` | 통과 | smoke, visual QA 포함 |
| `/compatibility/input` | 통과 | smoke 포함 |
| `/compatibility/result` | 조건부 통과 | build route 생성 확인, 실제 입력 결과 상태는 별도 실데이터 smoke 필요 |
| `/compatibility/personality` | 통과 | visual QA 포함 |
| `/compatibility/personality/result` | 조건부 통과 | build route 생성 확인, session payload 기반 전체 결과 상태는 별도 실데이터 smoke 필요 |
| `/today-fortune` | 통과 | smoke, visual QA 포함 |
| `/tarot/daily` | 통과 | visual QA 포함 |
| `/zodiac` | 통과 | visual QA 포함 |
| `/star-sign` | 통과 | visual QA 포함 |
| `/dialogue` | 통과 | visual QA, Browser 12간지 details 확인 |
| `/my` | 통과 | smoke redirect 허용, visual QA 포함 |
| `/pricing` | 통과 | smoke, visual QA 포함 |
| `/membership` | 통과 | smoke, visual QA 포함 |
| `/credits` | 통과 | visual QA 포함 |

## 6. Responsive QA Result

자동 visual QA는 아래 breakpoint로 실행됐다.

- `360x800`
- `390x844`
- `430x932`
- `768x1024`
- `1024x768`
- `1280x900`
- `1440x1000`

결과:

- 14개 route × 7개 breakpoint = 98개 screenshot 캡처.
- 실패 캡처 0개.
- 저장 위치: `/Users/kionya/ganji-saju/artifacts/screenshots`
- 요약 파일: `/Users/kionya/ganji-saju/artifacts/screenshots/visual-qa-summary.md`

주의:

- 현재 visual QA는 Chrome CLI fallback 기반 viewport screenshot이다.
- Playwright devDependency가 없어 fullPage screenshot 모드는 사용되지 않았다.
- 결과 route의 payload별 유료/무료 상태는 자동 screenshot 범위 밖이므로 배포 전 실데이터 smoke가 필요하다.

## 7. Mobile Performance Review

작업 12 기준 성능 최적화 보고서가 생성됐다.

- 문서: `docs/performance/mobile-performance-optimization-report.md`
- 홈 analytics boundary를 작은 observer island로 축소했다.
- Noto Sans KR font weight를 `400/500/700` 중심으로 줄였다.
- 성향사주/성향궁합 16유형 chip item 배열을 module scope로 hoist했다.
- 성향궁합 저장 프로필 fetch를 첫 단계 이후로 지연했다.
- 12간지 대화방은 이미지 asset 없이 glyph/text fallback 중심으로 동작한다.

남은 성능 리스크:

- `SiteHeader`는 여전히 auth/credit/notification 상태를 포함하는 전역 client component다.
- `UnifiedBirthInfoFields`와 대화방 chat panel의 hydration 비용은 남아 있다.
- 실제 Mobile LCP/INP/CLS는 preview/production RUM 또는 실기기 Lighthouse로 추가 확인해야 한다.

## 8. Existing Feature Regression Review

자동 검수 결과:

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm test` | 통과, 177개 custom unit + 5개 node test pass |
| `npm run build` | 통과 |
| `git diff --check` | 통과 |
| `npm run preflight` | exit 0, 경고 2개 |
| `npm run smoke` | 최종 통과, 20/20 route 정상 응답 |

`preflight` 경고:

- uncommitted 변경사항이 많으므로 commit/stash 후 진행 권장.
- 기존 `src/proxy.ts`는 있으나 `src/middleware.ts`가 없다는 기존 구조 경고가 남아 있음.

`smoke` 참고:

- sandbox 내부 실행은 `localhost:3000` 접근 실패.
- dev 서버를 sandbox 밖에서 실행한 뒤 재실행하여 20/20 통과.

## 9. Zodiac Dialogue Review

12간지 캐릭터 데이터는 `src/lib/dialogue-experts.ts`와 `src/components/gangi/gangi-ui.tsx`에서 모두 확인됐다.

| 캐릭터 | 노출 확인 |
|---|---|
| 자(子)쥐 | 통과 |
| 축(丑)소 | 통과 |
| 인(寅)호랑이 | 통과 |
| 묘(卯)토끼 | 통과 |
| 진(辰)용 | 통과 |
| 사(巳)뱀 | 통과 |
| 오(午)말 | 통과 |
| 미(未)양 | 통과 |
| 신(申)원숭이 | 통과 |
| 유(酉)닭 | 통과 |
| 술(戌)개 | 통과 |
| 해(亥)돼지 | 통과 |

Browser QA:

- `/dialogue` title: `12간지 대화방 | 달빛인생`
- 오늘의 추천 간지 3개 노출 확인.
- `전체 12간지 보기` details를 열면 12개 캐릭터가 모두 DOM에 노출됨.
- console warning/error 0개.

4명 선생님 표현 검색:

- `엠지쥐선생`, `명리호선생`, `궁합양선생`, `오늘소선생`, `추천 선생님 4명`, `선생님 선택하기` 검색 결과 없음.

## 10. Payment / Entitlement Safety Review

결제/권한 로직은 대규모 변경하지 않았다.

- `src/lib/payments/catalog.ts`, `src/lib/payments/product-scope.ts`, `src/app/api/payments/confirm/route.ts`는 이번 디자인 QA 단계에서 직접 변경되지 않았다.
- 가격/멤버십/크레딧 페이지는 UI 중심 변경이며, 기존 product code와 결제 CTA 구조를 유지한다.
- unit test에서 payment confirmation, product scope, entitlement 관련 테스트가 통과했다.
- Supabase migration 파일은 이번 디자인 시스템 작업에서 새로 만들지 않았다.

주의:

- `supabase/data_table_backup/`는 로컬 백업성 산출물로 보이며 커밋 제외 처리했다.
- 실제 Toss live 결제 1건 또는 sandbox/live 분리 확인은 배포 전 사람이 확인해야 한다.

## 11. Privacy / Analytics Review

검색 결과 `birth`, `gender`, `displayName`, `name` 등은 입력/저장/표시 로직에서 다수 발견된다. 이는 사주 서비스의 필수 입력 처리와 기존 프로필 UI 때문이다.

Analytics payload 확인:

- 홈 analytics는 `section`, `target`, `featureId`, `serviceId`만 전송한다.
- 성향사주 analytics는 `source`, `lifeArea`, `productCode`, `reportType`, `channel`, `rating` 중심이다.
- 성향궁합 analytics는 `relationshipType`, `resultType`, `productCode`, `shareMethod`, `source` 중심이다.
- 이름, 생년월일시 원문, 성별, 성향 체크 원문 답변은 analytics payload로 직접 전송하지 않는 구조를 확인했다.

공유/AI CTA 확인:

- 성향사주 공유 문구는 공유 카드 summary를 사용한다.
- 성향궁합 공유 문구는 개인 생년월일시와 상대 정보를 제외한다는 UI 안내가 있다.
- AI CTA는 report id/scope/lifeArea 중심의 context이며 원본 생년월일시를 URL에 직접 싣지 않는다.

잔여 주의:

- 로그인 사용자 홈 개인화 copy에서 본인 생년월일 요약이 사용자 본인 화면에 표시될 수 있다. 공유/analytics 노출은 아니지만 개인정보 UX 기준에서 계속 모니터링이 필요하다.

## 12. Forbidden Copy Review

전체 검색 결과는 다음 범주로 나뉜다.

- 4명 선생님 표현: 잔존 없음.
- guardrails/test/docs: 금지 표현을 검출/치환하기 위한 의도적 문자열이 남아 있음.
- prompt instruction/internal validation: JSON 강제, 안전 감사용 `반드시`, `무조건` 등이 일부 남아 있음.
- 기존 레거시 사용자 copy 후보: `src/app/api/credits/use/route.ts`, `src/server/today-fortune/*`, `src/lib/engine-method-pages.ts`, `src/app/privacy/page.tsx` 등에서 설명/비판 맥락의 금지어가 검색됨.

이번 디자인 시스템 작업 범위에서 4명 선생님 표현은 제거됐고, 성향사주/성향궁합 UI는 `공식 MBTI 검사`처럼 보이는 표현 대신 `16유형 성향`, `성향 체크`, `참고용 자기이해 콘텐츠` 톤을 유지한다.

권장 후속:

- 별도 copy cleanup 작업으로 레거시 결과 copy와 SEO/정책 문서의 단정 표현을 분리 정리한다.

## 13. Visual Screenshot QA Summary

| 항목 | 결과 |
|---|---|
| 실행 명령 | `npm run visual:qa` |
| Base URL | `http://localhost:3000` |
| Provider | `chrome-headless-viewport` |
| Route 수 | 14 |
| Breakpoint 수 | 7 |
| Screenshot 수 | 98 |
| 실패 | 0 |
| 저장 위치 | `/Users/kionya/ganji-saju/artifacts/screenshots` |

추가 참고:

- sandbox 내부에서는 `localhost:3000` 접근 실패로 visual QA가 실패했다.
- dev 서버를 sandbox 밖에서 실행한 후 같은 명령을 재실행해 통과했다.
- result route만 별도 focus visual pass를 시도했지만 sandbox 접근 제한과 Browser 보안 정책으로 추가 자동 캡처는 완료하지 못했다. 대신 build route 생성과 주요 result component compile 검수로 대체했다.

## 14. Blockers

하드 blocker:

- 없음.

프로세스 blocker:

- 현재 `main` 브랜치 dirty 상태다. 이 상태로 바로 배포하지 말고 release 브랜치/PR 단위로 커밋 정리가 필요하다.
- `preflight`가 기존 `src/proxy.ts`/`src/middleware.ts` 구조 경고를 계속 표시한다. 이번 작업에서 새로 만든 문제는 아니지만, 배포 전 팀이 인지해야 한다.

잔여 QA 리스크:

- 로그인/유료 권한이 필요한 실제 결과 재열람은 실계정으로 확인해야 한다.
- Toss live 결제는 자동 QA에서 실행하지 않았다.
- result route의 무료/유료 상태별 visual QA는 session payload/권한 데이터가 필요해 preview smoke에서 추가 확인해야 한다.

## 15. Go / No-Go Decision

판정: **조건부 Go**

Go 근거:

- `lint`, `typecheck`, `test`, `build`, `git diff --check` 통과.
- `smoke` 20/20 통과.
- visual QA 98/98 통과.
- 홈, 성향사주 CTA, 12간지 대화방은 Browser 기반으로 추가 확인.
- 4명 선생님 표현 잔존 없음.
- 결제/DB/Supabase migration 로직 변경 없음.
- backup/screenshot 산출물은 `.gitignore`로 커밋 제외 처리.

조건:

- dirty `main` 상태를 정리해 release 브랜치 또는 PR로 커밋한다.
- Preview 배포에서 실계정 기준 결과/결제/보관함 재열람 smoke를 수행한다.
- 운영 배포 전 Toss live 또는 sandbox/live 분리 확인을 완료한다.

## 16. Post-Deploy Smoke Test Plan

배포 후 아래 순서로 확인한다.

1. `/` 홈 진입, mobile 390px 기준 첫 화면 CTA 확인.
2. `/saju/new` 기본 사주 입력 진입.
3. `/saju/personality` 성향사주 입력, 성향 선택, 관심영역 선택.
4. `/saju/personality/result` 무료 결과와 990원 CTA 확인.
5. `/compatibility` 기본 궁합 진입.
6. `/compatibility/personality` 성향궁합 입력, 관계유형/내 정보/상대 정보/성향/질문 단계 확인.
7. `/compatibility/personality/result` 무료 결과와 유료 잠금 확인.
8. `/today-fortune`, `/tarot/daily`, `/zodiac`, `/star-sign` 진입 확인.
9. `/dialogue`에서 전체 12간지 details 열기, 캐릭터 선택 후 `/dialogue/[expert]` 진입 확인.
10. `/my` 또는 `/vault`에서 보관함/재열람 상태 확인.
11. `/pricing`, `/membership`, `/credits`에서 기존 결제 CTA 유지 확인.
12. Vercel logs, Supabase logs, Toss logs, analytics 이벤트 유입 확인.
