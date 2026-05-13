# My Reading Pages Update Notes

## Summary

내 풀이 페이지군을 달빛 결 디자인 시스템에 맞춰 점진 적용했다. 이번 단계는 기능 로직 변경이 아니라, 기본 사주 입력/결과, 달빛 성향사주 입력/결과, 올해 흐름 진입 화면의 상단 구조와 선택 UI, 모바일 CTA를 통일하는 작업이다.

## Modified Pages

- 기본 사주 입력: `/saju/new`
- 기본 사주 결과: `/saju/[slug]`
- 달빛 성향사주 입력: `/saju/personality`
- 달빛 성향사주 결과: `/saju/personality/result`
- 올해 흐름 진입: `/daewoon`

## Applied Components

- `AppPage`
- `PageIntro`
- `SajuStrip`
- `FusionStrip`
- `StepFlowShell`
- `ChoiceRow`
- `AxisChipGrid`
- `StickyActionBar`
- `ResultShell`
- `AxisMeter`
- `SafetyNotice`

## Basic Saju Input

`/saju/new`의 기존 state, validation, 저장, submit 흐름은 유지했다. 표면 구조만 `PageIntro`, `SajuStrip`, `StepFlowShell`, `StickyActionBar`로 감싸고, 궁금한 주제와 저장 프로필 선택은 `ChoiceRow` 중심으로 정리했다.

기존처럼 active step만 렌더링한다. 이전/다음 CTA는 모바일 하단 sticky action bar로 이동해 작은 화면에서도 다음 행동이 계속 보이도록 했다.

## Saju Personality Input

`/saju/personality`는 이미 `StepFlowShell`, `ChoiceRow`, `AxisChipGrid`, `StickyActionBar`를 사용하고 있었다. 이번 단계에서는 `PageIntro`를 추가해 `年 月 日 時 × I/E S/N T/F J/P` 브랜드 맥락과 `사주로 보는 타고난 결 / 성향으로 보는 선택 습관` 메시지를 상단에 보강했다.

성향 입력 방식, 8문항 성향 체크 로직, 결과 생성 handoff 구조는 변경하지 않았다.

## Result Pages

기본 사주 결과 `/saju/[slug]`는 기존 `ResultShell`, `SajuStrip`, `AxisMeter`, `SafetyNotice` 구조를 유지했다. 사주 네 기둥 표시 영역은 무거운 dark gradient/shadow 표현을 줄이고, `gyeol` token 기반의 paper/surface 패널로 정리했다.

달빛 성향사주 결과 `/saju/personality/result`는 기존 결제/권한/저장/공유/AI 상담 흐름을 유지하고, 결과 상단에 `PageIntro`를 추가해 내 풀이 페이지군의 문맥을 맞췄다.

## Year Flow Page

`/daewoon`은 기존 route와 CTA를 유지했다. `PageIntro`, `SajuStrip`, `LightSection`, `AxisMeter`로 재구성해 홈과 내 풀이 페이지군의 visual rhythm에 맞췄다.

## What Was Not Changed

- 사주 계산 함수
- 성향 체크/추정 로직
- 결제/권한 로직
- 리포트 저장/재조회 로직
- API route
- Supabase migration
- route path

## Mobile QA Notes

- 기본 사주 입력은 active step 중심 구조를 유지한다.
- 주요 CTA는 `StickyActionBar`로 하단에 고정된다.
- 입력/select는 기존 `UnifiedBirthInfoFields`를 그대로 사용하므로 기존 validation과 접근 방식을 유지한다.
- 성향사주 16유형 선택은 기존 `AxisChipGrid`를 유지한다.

## Manual QA Checklist

- `/saju/new`에서 궁금한 주제 선택 가능
- `/saju/new`에서 저장 프로필 또는 새 생년월일시 입력 가능
- `/saju/new`에서 태어난 시간 모름 선택 가능
- `/saju/[slug]` 결과 진입 가능
- `/saju/personality`에서 성향 직접 선택 가능
- `/saju/personality`에서 8문항 성향 체크 가능
- `/saju/personality`에서 관심영역 선택 가능
- `/saju/personality/result` 무료 결과 표시
- 990원 깊이보기 CTA 유지
- `/daewoon`에서 올해 흐름 CTA 유지

## Remaining Risks

- 실제 360/390/430px 실기기 화면에서 sticky CTA와 모바일 bottom nav의 간격은 별도 시각 QA가 필요하다.
- 기본 사주 결과 화면에는 아직 일부 legacy `gangi-*` result card class가 남아 있다. 다음 결과 화면 통일 작업에서 추가 정리가 필요하다.

## Next Step

관계 페이지군에 같은 구조를 적용한다. 대상은 기본 궁합, 달빛 성향궁합 입력/결과이며, 관계 로직과 결제/권한 흐름은 그대로 유지한다.
