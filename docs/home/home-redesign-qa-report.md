# Home Redesign Final QA Report

## Executive Summary

- 메인화면 리디자인 후 홈 진입, Header, Hero, 신규 기능 CTA, 기존 서비스 CTA, 모바일/데스크탑 레이아웃, analytics payload, 금지 표현을 최종 점검했다.
- `lint`, `typecheck`, `test`, `build`, `git diff --check` 모두 통과했다.
- 인앱 브라우저는 localhost 접근을 오류 페이지로 막아 화면 검수에는 사용하지 못했고, production 로컬 서버 + `curl` + Chrome headless screenshot으로 대체 검수했다.
- main merge를 막는 blocker는 없다.

## Validation Commands

| 명령 | 결과 | 메모 |
|---|---|---|
| `npm run lint` | 통과 | `verify:imports` 6/6 통과 |
| `npm run typecheck` | 통과 | TypeScript no emit 통과 |
| `npm test` | 통과 | 177 tests + node test 5 pass |
| `npm run build` | 통과 | Next.js production build, 125 static pages 생성 |
| `git diff --check` | 통과 | whitespace error 없음 |

## Route / CTA QA

| 항목 | 대상 | 결과 |
|---|---|---|
| 홈 진입 | `/` | 200 |
| 내 성향사주 CTA | `/saju/personality` | 200 |
| 우리 성향궁합 CTA | `/compatibility/personality` | 200 |
| 오늘운세 CTA | `/today-fortune?concern=general` | 200 |
| 타로 CTA | `/tarot/daily` | 200 |
| 내 사주풀이 CTA | `/saju/new` | 200 |
| 기존 궁합 CTA | `/compatibility` | 200 |
| 올해 흐름 CTA | `/daewoon` | 200 |
| 좋은 날 CTA | `/taekil` | 200 |
| 띠운세 CTA | `/zodiac`, `/zodiac/snake` | 200 |
| 별자리 CTA | `/star-sign`, `/star-sign/cancer` | 200 |
| 대화방 CTA | `/dialogue` | 200 |
| 보관함 CTA | `/my` | 비로그인 기준 `/login?next=%2Fmy`로 정상 유도 |
| 가격 안내 CTA | `/pricing` | 200 |

## Manual QA Checklist

| 체크 | 결과 | 메모 |
|---|---|---|
| 홈 진입 정상 | 통과 | `/` 200 |
| Header 정상 | 통과 | 로고, 알림, 메뉴, desktop nav 표시 확인 |
| Hero 표시 정상 | 통과 | `오늘 무엇을 보고 싶나요?` 표시 |
| 내 성향사주 CTA 정상 | 통과 | `/saju/personality` |
| 우리 성향궁합 CTA 정상 | 통과 | `/compatibility/personality` |
| TodaySnapshot 표시 정상 | 통과 | 오늘운세/띠/별자리 카드 표시 |
| 오늘운세 CTA 정상 | 통과 | `/today-fortune?concern=general` |
| 타로 CTA 정상 | 통과 | `/tarot/daily` |
| 내 사주풀이 CTA 정상 | 통과 | `/saju/new` |
| 기존 궁합 CTA 정상 | 통과 | `/compatibility` |
| 올해 흐름 CTA 정상 | 통과 | `/daewoon` |
| 띠운세 CTA 정상 | 통과 | `/zodiac` 및 TodaySnapshot 상세 route 확인 |
| 별자리 CTA 정상 | 통과 | `/star-sign` 및 TodaySnapshot 상세 route 확인 |
| 대화방 CTA 정상 | 통과 | `/dialogue` |
| 보관함 CTA 정상 | 통과 | 비로그인 로그인 유도 정상 |
| 가격 안내 CTA 정상 | 통과 | `/pricing` |
| 모바일 360/375/390px 깨짐 없음 | 통과 | Chrome headless screenshot 확인 |
| 데스크탑 grid 깨짐 없음 | 통과 | 1280px screenshot 확인 |
| 신규 기능 route 진입 정상 | 통과 | 성향사주/성향궁합 route 200 |
| 기존 사주/궁합/대화방 route 진입 정상 | 통과 | `/saju/new`, `/compatibility`, `/dialogue` 200 |
| analytics payload에 PII 없음 | 통과 | `source`, `section`, `target`, `featureId`, `serviceId`만 전송 |
| 금지 표현 없음 | 통과 | 홈 UI 소스 기준 발견 없음 |

## Mobile / Desktop Evidence

| Viewport | Evidence |
|---|---|
| 360px | `/private/tmp/ganji-home-final-qa/home-360.png` |
| 375px | `/private/tmp/ganji-home-final-qa/home-375.png` |
| 390px | `/private/tmp/ganji-home-final-qa/home-390.png` |
| Desktop 1280px | `/private/tmp/ganji-home-final-qa/home-desktop.png` |

## Analytics / Privacy Review

- 홈 view 이벤트는 `home_viewed`로 전송되며 payload는 `{ source: 'home_redesign' }`만 포함한다.
- 홈 클릭 이벤트는 `home_hero_primary_clicked`, `home_hero_secondary_clicked`, `home_primary_feature_clicked`, `home_free_service_clicked`, `home_theme_service_clicked`, `home_ai_dialogue_clicked`, `home_archive_clicked`, `home_pricing_clicked`로 분리되어 있다.
- 클릭 payload는 `source`, `section`, `target`, `featureId`, `serviceId`만 구성한다.
- `href`, 이름, 생년월일, 태어난 시간, 성별, 성향 체크 답변, 질문 원문, 결제 상세 정보는 홈 analytics payload에 포함하지 않는다.
- 저장 리포트 카드가 들어오는 경우에도 `report.id`를 payload로 보내지 않고 `saved-report` 고정 target만 사용한다.

## Forbidden Phrase Review

| 범위 | 결과 |
|---|---|
| `src/features/home` | 발견 없음 |
| `src/components/home` | 발견 없음 |
| `src/config/home` | 발견 없음 |
| `docs/home` | PRD의 금지 표현 목록 설명에서만 발견 |

문서의 금지 표현 검색 결과는 사용자 노출 문구가 아니라 guardrail 설명 표에 포함된 항목이다. 홈 UI 소스와 홈 config에는 금지 표현이 없다.

## Blockers

- 없음.

## Residual Risks

- 인앱 브라우저 localhost 접근은 계속 오류 페이지로 막혀, 시각 검수는 Chrome headless screenshot으로 대체했다.
- Production 배포 후 실제 모바일 Safari/Android Chrome에서 safe-area와 하단 dock 체감은 한 번 더 확인하는 것이 안전하다.
- GTM/Vercel Analytics에서 새 이벤트명이 실제 수집되는지는 배포 환경에서 로그 확인이 필요하다.

## Go / No-Go Decision

- Go.
- 정적 검수, build, route 진입, 모바일/데스크탑 렌더링, PII, 금지 표현 기준에서 main merge 가능하다.
