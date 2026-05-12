# Responsive Layout Repair Report

## Executive Summary

디자인 리팩터 이후 일부 subpage가 desktop에서도 430px 내외로 고정되는 문제를 복구했다.

이번 수정은 레이아웃 wrapper와 panel 폭 기준만 정리했다. 결제, DB, Supabase migration, 사주 계산, 성향 계산, 결과 생성 로직은 변경하지 않았다.

## Repaired Routes

| route | 조치 |
|---|---|
| `/saju/personality` | page container를 desktop에서 넓게 열고, 입력 단계는 form panel 폭으로 중앙 정렬 |
| `/saju/personality/result` | page container를 넓게 열고, 결과 본문은 result panel 폭으로 중앙 정렬 |
| `/today-fortune` | root subpage container를 desktop/tablet에서 넓게 열고, 생년월일 입력 panel은 form 폭으로 제한 |
| `/compatibility` | entry page container를 desktop/tablet에서 서비스 grid가 사용할 수 있는 폭으로 확장 |

## Wrapper Changes

| 구분 | 기준 |
|---|---|
| AppShell content | subpage shell 내부에서 `display: block`, `width: 100%`로 정리 |
| Page container | mobile `calc(100vw - 1.25rem)`, tablet/desktop `calc(100vw - 3rem)`, max `70rem` |
| Form panel | max `32.5rem` |
| Result panel | max `47.5rem` |

## Files Changed

| 파일 | 변경 |
|---|---|
| `src/app/styles/flow-polish.css` | `gangi-responsive-page`, `gangi-responsive-form-panel`, `gangi-responsive-result-panel` 기준 추가 |
| `src/components/moonlight/StepFlowShell.tsx` | 입력 step shell 기본 form panel 폭 적용 |
| `src/components/moonlight/ResultShell.tsx` | 결과 shell 기본 result panel 폭 적용 |
| `src/features/saju-personality/saju-personality-input-client.tsx` | `/saju/personality`에 responsive page/form panel 적용 |
| `src/features/saju-personality/saju-personality-result-handoff-client.tsx` | `/saju/personality/result`에 responsive page/result panel 적용 |
| `src/features/today-fortune/today-fortune-experience.tsx` | `/today-fortune` page/form panel 분리 |
| `src/app/compatibility/page.tsx` | `/compatibility` page container 확장 |

## Responsive Standards

| breakpoint | 기대 동작 |
|---|---|
| 360px | viewport 안쪽 폭을 사용하고 가로 스크롤 없음 |
| 390px | mobile full-width 흐름 유지 |
| 430px | mobile full-width 흐름 유지 |
| 768px | page max 960px 이하에서 자연스럽게 확장 |
| 1024px | form panel은 좁게, page section은 넓게 표시 |
| 1280px | page max 1120px 기준에 근접 |
| 1440px | page max 70rem에서 과도하게 늘어나지 않음 |

## Static Checks

- 대상 route에서 page container override는 기존 `30rem` 강제 규칙보다 높은 specificity로 적용되도록 명시 selector를 사용했다.
- `StepFlowShell`과 `ResultShell`은 wrapper 내부에서 `w-full`과 max-width를 같이 갖는다.
- form/result panel은 page wrapper와 분리되어 desktop에서도 전체 페이지가 430px로 고정되지 않는다.

## Browser QA

in-app browser는 현재 localhost 탭을 읽을 수 있었지만, 새 localhost route 이동이 보안 정책에서 차단되었다. 정책상 우회가 금지되어 화면 기반 가로 스크롤 QA는 완료하지 않았다.

Preview URL 또는 사용자의 로컬 브라우저에서 아래 route를 360/390/430/768/1024/1280/1440px로 확인해야 한다.

- `/saju/personality`
- `/saju/personality/result`
- `/today-fortune`
- `/compatibility`

## Remaining Risks

- `gangi-responsive-page`를 적용하지 않은 legacy subpage는 기존 30rem 제한을 계속 받을 수 있다.
- 이번 작업은 요청된 P1 반응형 붕괴 복구에 집중했으며, 전체 사이트의 모든 legacy page 폭 통일은 별도 sweep이 필요하다.
- 실제 visual QA는 localhost browser policy 때문에 Preview URL에서 추가 확인이 필요하다.

## Go / No-Go

자동 검수 통과 후 recovery PR에 포함 가능하다. 단, merge 전 Preview URL에서 위 4개 route의 desktop/tablet/mobile 폭 확인이 필요하다.
