# Relationship Pages Update Notes

## Summary

관계 페이지군을 달빛 결 디자인 시스템에 맞춰 정리했다. 이번 작업은 기본 궁합과 달빛 성향궁합의 UI/UX, 모바일 흐름, 결과 CTA 문구를 통일하는 작업이며, 궁합 계산·성향궁합 점수·결제·권한·저장 로직은 변경하지 않았다.

## Modified Pages

- 기본 궁합 입력: `/compatibility/input`
- 기본 궁합 결과: `/compatibility/result`
- 달빛 성향궁합 입력: `/compatibility/personality`
- 달빛 성향궁합 결과: `/compatibility/personality/result`

## Applied Components

- `AppPage`
- `PageIntro`
- `FusionStrip`
- `StepFlowShell`
- `ChoiceRow`
- `AxisChipGrid`
- `StickyActionBar`
- `ResultShell`
- `AxisMeter`
- `SafetyNotice`

## Basic Compatibility Input

`/compatibility/input`을 한 화면에 두 사람 정보를 모두 보여주는 긴 폼에서 단계형 입력 흐름으로 정리했다.

단계:

1. 관계 유형
2. 내 정보
3. 상대 정보
4. 결과 확인

기존 `sessionStorage` 저장, 생년월일시 파싱, 결과 route 이동, 구매 여부 전달 방식은 그대로 유지했다. 저장된 프로필 빠른 채우기는 각 단계의 대상에 맞게 `ChoiceRow` 중심으로 표시한다.

## Personality Compatibility Input

`/compatibility/personality`는 이미 6단계 active step 구조를 사용하고 있었다. 이번 단계에서는 `PageIntro`를 추가해 `두 사람의 사주 네 기둥 × 두 사람의 성향 네 축` 브랜드 맥락을 상단에서 명확히 드러냈다.

성향 입력, 성향 체크, 관계 유형, 현재 질문, 결과 handoff 로직은 변경하지 않았다.

## Result Pages

기본 궁합 결과는 기존 `ResultShell`, `AxisMeter`, `SajuStrip`, `SafetyNotice` 구조를 유지하면서 `PageIntro`를 추가해 관계 페이지군의 문맥을 맞췄다.

달빛 성향궁합 결과는 기존 무료/유료 권한, 저장, 공유 카드, 결제 CTA 흐름을 유지했다. 기존 `AI에게 이어서 물어보기` CTA 문구는 `12간지 캐릭터에게 이어 묻기`로 변경해 대화방 세계관과 맞췄다.

## What Was Not Changed

- 기본 궁합 계산 로직
- 달빛 성향궁합 5축 점수 로직
- 990원 깊이보기 결제/권한 로직
- 리포트 저장/재조회 로직
- 공유 카드 개인정보 필터링
- 대화방 route와 context 전달 구조
- Supabase migration
- route path

## Mobile QA Notes

- 기본 궁합 입력은 active step 중심으로 렌더링한다.
- 내 정보와 상대 정보는 별도 단계로 분리되어 모바일 폼 길이를 줄였다.
- 관계 유형과 저장 프로필 선택은 `ChoiceRow`로 통일했다.
- 결과 진행 CTA는 `StickyActionBar`로 하단에 고정했다.
- 성향궁합의 16유형 선택은 기존 `AxisChipGrid`를 유지한다.

## Manual QA Checklist

- `/compatibility/input`에서 관계 유형 선택 가능
- `/compatibility/input`에서 내 정보 입력 가능
- `/compatibility/input`에서 상대 정보 입력 가능
- `/compatibility/result`에서 기본 궁합 결과 표시
- `/compatibility/personality`에서 관계 유형 선택 가능
- `/compatibility/personality`에서 내 정보와 상대 정보 입력 가능
- `/compatibility/personality`에서 16유형 직접 선택 가능
- `/compatibility/personality`에서 성향 체크 가능
- `/compatibility/personality`에서 현재 질문 선택 가능
- `/compatibility/personality/result`에서 무료 결과 표시
- 미구매 상태에서 유료 섹션 잠금 유지
- 구매 권한 확인 시 유료 섹션 표시 유지
- 결과 화면에서 `12간지 캐릭터에게 이어 묻기` CTA 표시

## Remaining Risks

- 실제 360/390/430px 실기기에서 기본 궁합 입력의 sticky CTA와 mobile bottom nav 간격은 별도 시각 QA가 필요하다.
- 기본 궁합 결과에는 일부 legacy `gangi-*` 카드가 남아 있다. 다음 결과 화면 통일 작업에서 추가 정리 대상이다.

## Next Step

오늘 페이지군에 같은 디자인 시스템을 적용한다. 대상은 오늘운세, 타로, 띠운세, 별자리이며, 각 기능의 계산/결과/결제 흐름은 유지한다.
