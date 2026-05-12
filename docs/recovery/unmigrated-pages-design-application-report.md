# 디자인 미적용 페이지 복구 적용 보고서

## Executive Summary

`/today-fortune?concern=general`과 `/compatibility`에 남아 있던 구형 카드/섹션 중심 UI를 달빛 결 디자인 시스템의 공통 구조로 정리했다. 오늘운세는 `SajuStrip`, `LightSection`, `ChoiceRow`, form/result panel 기준을 적용했고, 기본 궁합 진입 페이지는 `PageIntro`, `FusionStrip`, `LightSection`, `FlowEntryList`, `SafetyNotice` 중심으로 재구성했다.

이번 변경은 UI/레이아웃 정리만 포함한다. 오늘운세 생성 로직, 기본 궁합 계산 로직, 결제/권한, DB/Supabase migration, route 구조는 변경하지 않았다.

## Modified Pages

- `/today-fortune?concern=general`
- `/today-fortune/result`
- `/compatibility`

## Today Fortune Application

- `TodayFortuneExperience` 상단에 `SajuStrip`을 추가해 오늘운세가 "오늘의 결" 페이지군으로 보이도록 정리했다.
- 고민 선택 영역을 `LightSection`으로 감싸고, `TodayConcernSelector`의 선택 UI를 구형 `today-concern-card`에서 `ChoiceRow` 기반으로 바꿨다.
- 출생 정보 입력 패널은 `gyeol` token 기반의 form panel 스타일로 정리했다.
- 무료 결과가 같은 화면에 남을 때도 `gangi-responsive-result-panel` 범위 안에서 표시되도록 정리했다.
- `/today-fortune/result`의 결과 없음 fallback과 후속 질문 영역을 `LightSection`으로 맞췄다.

## Compatibility Application

- `/compatibility`의 구형 `PageHero`, `SectionSurface`, `ProductGrid`, `FeatureCard` 기반 구성을 제거했다.
- `PageIntro`와 `FusionStrip`으로 "관계의 결" 진입 맥락을 먼저 보여준다.
- 달빛 성향궁합 CTA는 별도 `LightSection`으로 유지하되 기존 route인 `/compatibility/personality`를 그대로 사용한다.
- 기본 궁합 관계 선택은 `FlowEntryList`로 정리하고 기존 `/compatibility/input?relationship=...` 링크를 유지했다.
- 멤버십/가격 안내 CTA는 기존 `/membership`, `/pricing` route를 그대로 사용한다.

## Functional Safety

- 오늘운세 API 호출, birth input validation, result sessionStorage 저장, result redirect 로직은 변경하지 않았다.
- 기본 궁합 입력 route와 relationship query parameter는 변경하지 않았다.
- 성향궁합 route, 결제 route, entitlement 처리 로직은 변경하지 않았다.
- DB schema, Supabase migration, payment product code는 변경하지 않았다.

## Responsive Review

- `/today-fortune`은 이전 복구 작업에서 정리한 `gangi-responsive-page`, `gangi-responsive-form-panel`, `gangi-responsive-result-panel` 기준을 사용한다.
- `/compatibility`는 `gangi-responsive-page` 안에서 flow/list 중심으로 구성해 desktop에서도 430px 고정처럼 보이지 않도록 정리했다.
- `ChoiceRow` 기반 선택지는 360px 모바일에서도 가로 스크롤 없이 세로로 쌓이는 구조다.

## Validation

| Command | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `git diff --check` | Pass |

## Manual QA Notes

- 자동 빌드 기준으로 `/today-fortune`, `/today-fortune/result`, `/compatibility` route 생성은 확인했다.
- 현재 Codex in-app browser에서 localhost route 이동이 정책상 차단되는 상태라 실제 화면 클릭/스크린샷 QA는 수행하지 못했다.
- 실기기 QA에서는 `/today-fortune?concern=general` 무료 결과 생성, `/compatibility` 기본 궁합 입력 진입, 360/390/430/768/1024/1280/1440 폭을 확인해야 한다.

## Remaining Risks

- 오늘운세 결과 내부 세부 카드 일부는 아직 legacy `app-*` token을 사용한다. 이번 작업에서는 미적용 진입 페이지 복구가 우선이라 결과 상세 카드 전체 재스킨은 별도 P2로 남긴다.
- 실제 무료 결과 생성은 API/환경 의존성이 있어 로컬 브라우저 차단이 해제된 환경에서 한 번 더 확인이 필요하다.
- `/compatibility/input` 내부 입력 화면은 기존 기본 궁합 흐름을 유지했으며, 이번 작업에서는 진입 페이지 중심으로 정리했다.

## Next Step

1. 로컬 또는 Preview URL에서 `/today-fortune?concern=general` 무료 결과 생성을 실기기 확인한다.
2. `/compatibility`에서 각 관계별 기본 궁합 입력 route 진입을 확인한다.
3. 오늘운세 결과 세부 카드의 legacy token 잔존 정리는 별도 P2 디자인 안정화 작업으로 진행한다.
