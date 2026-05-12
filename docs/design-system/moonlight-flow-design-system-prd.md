# 달빛인생 디자인 시스템 v2 PRD

문서명: Moonlight Flow System PRD
디자인 컨셉: 달빛 결 디자인 시스템
작성일: 2026-05-12
범위: 홈, 사주, 성향사주, 궁합, 성향궁합, 오늘운세, 타로, 대화방, 보관함, 가격/멤버십
비범위: 결제 로직, DB, Supabase migration, 사주 계산, 성향 계산, 궁합 계산, 결과 생성 로직

## 1. Executive Summary

달빛인생은 기능이 늘어나면서 홈, 사주, 궁합, 성향사주, 성향궁합, 오늘운세, 타로, 대화방, 보관함, 가격 화면이 서로 다른 화면 문법을 갖게 되었습니다. 홈은 새롭게 정돈되었지만 내부 페이지는 기존 `gangi-*` 카드형 UX와 `app-*` 섹션형 UX가 섞여 있어 하나의 서비스처럼 보이는 힘이 약합니다.

Moonlight Flow System은 홈만 다시 꾸미는 작업이 아닙니다. 사용자가 “내 흐름을 볼지, 관계를 볼지, 오늘을 볼지” 먼저 고르고, 각 흐름 안에서 입력, 결과, 저장, 결제, 대화로 자연스럽게 이어지도록 전체 IA와 디자인 언어를 재정렬하는 디자인 시스템입니다.

핵심 브랜드 메타포는 `사주 = 네 기둥`, `성향 = 네 축`입니다. 달빛인생은 두 구조를 연결해 `나의 결`, `관계의 결`, `오늘의 결`을 읽는 서비스로 정의합니다.

## 2. Problem Statement

현재 문제:

- 홈과 내부 페이지의 시각적 일관성이 약합니다.
- 카드형 섹션이 많아 모바일에서 정보량이 과합니다.
- 구형 핸드폰에서 blur, shadow, animation, client bundle 비용으로 버벅임 가능성이 있습니다.
- 달빛 성향사주와 달빛 성향궁합이 기능적으로는 있으나, `사주 × 성향`이 화면 구조로 반복되지 않습니다.
- 전체 사이트맵이 기능 나열에 가까워 사용자가 다음 행동을 선택하기 어렵습니다.

해결 방향:

- 사이트 IA를 `나의 결 / 관계의 결 / 오늘의 결`로 재정렬합니다.
- 카드 나열보다 `FlowRow`, `StepShell`, `ResultShell` 중심으로 화면을 구성합니다.
- 공통 navigation, shell, CTA, score/axis, 입력 단계, 결과 구조를 표준화합니다.
- 모바일 성능을 디자인 시스템의 1급 요구사항으로 포함합니다.

## 3. Product Goals

| 목표 | 설명 |
|---|---|
| 하나의 브랜드 경험 | 홈에서 내부 페이지까지 “달빛 결”이라는 동일한 시각 언어를 유지 |
| 흐름 중심 IA | 기능 나열보다 `내 풀이`, `관계`, `오늘`, `대화` 흐름으로 안내 |
| 모바일 사용성 개선 | 첫 화면 CTA를 줄이고, 긴 입력은 단계화하며, 결과 구조를 반복 가능하게 만듦 |
| 구형 기기 성능 개선 | Server Component 우선, client boundary 축소, 무거운 시각 효과 제한 |
| 신규 기능의 의미 강화 | 성향사주/성향궁합에서 `年 月 日 時 × I/E S/N T/F J/P` 메타포를 명확히 표현 |
| 점진적 적용 가능 | 결제/DB/계산 로직을 건드리지 않고 UI shell부터 단계적으로 교체 |

## 4. Non-Goals

이번 디자인 시스템 PRD에서 하지 않는 것:

- 신규 기능 추가
- 결제 플로우 변경
- DB schema 또는 Supabase migration 변경
- 사주 계산 로직 변경
- 성향 계산 로직 변경
- 성향궁합 2인 관계 로직 변경
- 결과 생성 prompt/LLM 로직 변경
- 가격 정책 변경
- 멤버십 포함 정책 변경

## 5. Design Concept

### Name

`Moonlight Flow System`

### Korean Name

`달빛 결 디자인 시스템`

### Core Metaphor

| 개념 | 표현 |
|---|---|
| 사주 | 네 기둥 |
| 성향 | 네 축 |
| 달빛인생 | 두 구조를 연결해 나의 결과 관계의 결을 읽는 서비스 |
| 개인 풀이 | 나의 결 |
| 관계 풀이 | 관계의 결 |
| 오늘 풀이 | 오늘의 결 |

### Visual Formula

```text
年 月 日 時 × I/E S/N T/F J/P
```

의미:

- `年 月 日 時`는 태어난 흐름과 사주 구조를 상징합니다.
- `I/E S/N T/F J/P`는 현재 선택 습관과 성향 축을 상징합니다.
- `×`는 단순 매핑이 아니라 두 해석 구조를 함께 놓고 읽는다는 뜻입니다.

## 6. Information Architecture

### Primary Navigation

1차 네비게이션:

| nav | 역할 | 대표 route |
|---|---|---|
| 홈 | 전체 흐름 선택 | `/` |
| 내 풀이 | 개인 사주와 성향사주 | `/saju/new`, `/saju/personality` |
| 관계 | 궁합과 성향궁합 | `/compatibility`, `/compatibility/personality` |
| 오늘 | 오늘운세, 타로, 띠운세, 별자리 | `/today-fortune`, `/tarot/daily`, `/zodiac`, `/star-sign` |
| 대화 | AI 상담 | `/dialogue` |

보조 네비게이션:

| nav | 역할 | 대표 route |
|---|---|---|
| 보관함 | 저장 리포트, 내 정보, 결제 이력 | `/my` |
| 가격/멤버십 | 가격 안내, 멤버십, 코인 | `/pricing`, `/membership`, `/credits` |

### Sitemap

1. 홈
2. 내 풀이
3. 기본 사주
4. 달빛 성향사주
5. 올해 흐름
6. 관계
7. 기본 궁합
8. 달빛 성향궁합
9. 오늘
10. 오늘운세
11. 타로
12. 띠운세
13. 별자리
14. 대화
15. 보관함
16. 가격/멤버십

### Home IA

홈은 기능 카탈로그가 아니라 흐름 선택 화면이어야 합니다.

권장 순서:

1. Header
2. Hero: 오늘 어떤 결을 보고 싶나요?
3. FlowRow: 나의 결 / 관계의 결 / 오늘의 결
4. Primary Flow: 내 성향사주 보기, 우리 성향궁합 보기
5. Today Quick Start: 오늘운세, 타로 한 장
6. Continue: 최근 리포트, 보관함
7. Dialogue: AI에게 이어서 묻기
8. Pricing: 필요한 풀이만 열기
9. Footer

## 7. Page Flow Model

### 공통 흐름

```text
Entry -> Flow Choice -> Step Input -> Preview Result -> Unlock/Save/Share -> Dialogue
```

### 내 풀이

```text
홈 -> 내 풀이 -> 기본 사주 or 달빛 성향사주 -> 입력 -> 무료 결과 -> 깊이보기/보관/대화
```

### 관계

```text
홈 -> 관계 -> 기본 궁합 or 달빛 성향궁합 -> 두 사람 입력 -> 무료 결과 -> 깊이보기/공유/대화
```

### 오늘

```text
홈 -> 오늘 -> 오늘운세/타로/띠운세/별자리 -> 빠른 결과 -> 필요 시 상세/대화
```

### 대화

```text
결과 화면 -> AI 상담 CTA -> summary context 전달 -> 대화방
```

개인정보 원문은 대화 context에 포함하지 않습니다.

## 8. Core UI Shells

### GyeolShell

전체 페이지 공통 shell입니다.

역할:

- 페이지 최대 폭, 배경, safe area, bottom nav clearance 통합
- 홈/내부 페이지의 시각적 단절 완화
- low-power mobile class 정책 적용

적용 대상:

- 홈
- 내 풀이 허브
- 관계 허브
- 오늘 허브
- 대화방
- 보관함
- 가격

### FlowRow

기능 나열 카드 대신 흐름 선택을 보여주는 row입니다.

필수 항목:

- 흐름 이름: 나의 결 / 관계의 결 / 오늘의 결
- 한 줄 설명
- 대표 CTA 1개
- 보조 CTA는 필요 시 1개 이하

### StepShell

입력 플로우 공통 shell입니다.

필수 구조:

1. 상단: 현재 흐름과 단계
2. 본문: active step만 렌더링
3. 하단: sticky CTA
4. 보조: 이전/다음 또는 저장된 프로필 불러오기

적용 대상:

- 사주 입력
- 성향사주 입력
- 궁합 입력
- 성향궁합 입력
- 오늘운세 입력

### ResultShell

결과 화면 공통 shell입니다.

필수 구조:

1. 한 줄 정의
2. `GyeolBridge` 또는 flow summary
3. 축 점수 요약
4. 무료 해석
5. 잠금 영역
6. 저장/공유
7. AI 상담 CTA

적용 대상:

- 사주 결과
- 성향사주 결과
- 궁합 결과
- 성향궁합 결과
- 오늘운세 결과
- 타로 결과

## 9. Component System

### Required Components

| 컴포넌트 | 목적 |
|---|---|
| `GyeolShell` | 사이트 전체 page shell |
| `FlowRow` | 홈/허브 흐름 선택 |
| `StepShell` | 긴 입력 단계화 |
| `ResultShell` | 결과 화면 구조 통일 |
| `GyeolBridge` | `年 月 日 時 × I/E S/N T/F J/P` 시각화 |
| `FourPillarRail` | 사주 네 기둥 표시 |
| `PersonalityAxisRail` | 성향 네 축 표시 |
| `AxisSummary` | 5축/6축/오늘 점수 요약 |
| `StickyCTA` | 모바일 하단 CTA |
| `BottomNav` | 5개 이하 하단 네비게이션 |
| `GyeolTabs` | 보관함, 결과 하위 탭 |
| `GyeolBadge` | NEW/HOT/FREE/990원/저장됨 |

### Existing Components To Reuse

| 기존 컴포넌트 | 활용 방향 |
|---|---|
| `AppShell` | `GyeolShell`의 출발점 |
| `SectionSurface` | section surface 토큰으로 흡수 |
| `SectionHeader` | heading/copy/action 표준화 |
| `FeatureCard` | 카드가 꼭 필요한 곳에만 제한 사용 |
| `buttonVariants` | `GyeolCTA` 토대 |
| `GangiIntro` | 모바일 intro copy pattern으로 흡수 |
| `GangiMetricBar` | `AxisSummary` 토대 |
| `UnifiedBirthInfoFields` | 생년월일시 입력 재사용 |
| `TrackedLink`, `TrackedButton` | analytics payload 최소화 유지 |

### Components To Standardize

현재 독립 primitive가 부족한 항목:

| 항목 | 현재 상태 | v2 방향 |
|---|---|---|
| Select | page-local native select 중심 | `GyeolSelect` 또는 native select 표준 class |
| Tabs | `AccountShellNav`, `GangiCategoryTabs`, `app-subnav` 혼재 | `GyeolTabs` 통합 |
| Stepper | 사주/오늘운세/성향 입력마다 다름 | `StepShell` + `StepProgress` |
| Card | `FeatureCard`, `GangiMiniCard`, `gangi-card-panel`, `app-panel` 혼재 | `GyeolSurface`로 통합 |

## 10. Visual System

### Visual Motifs

| motif | 설명 |
|---|---|
| Pillar Rail | `年 月 日 時` 네 칸을 작은 기둥처럼 표시 |
| Axis Rail | `I/E`, `S/N`, `T/F`, `J/P` 네 축을 작은 pill로 표시 |
| Bridge | 네 기둥과 네 축 사이를 얇은 선 또는 점 흐름으로 연결 |
| Moon Line | 달빛이 흐르는 선. flow row와 step progress에 사용 |
| Gyeol Grain | 과한 texture 대신 1px line/dot 패턴으로 결 표현 |

### Tone

| token direction | 원칙 |
|---|---|
| 배경 | white/ivory 중심, 아주 약한 pink moon gradient |
| 강조 | pink/gold를 과도하게 쓰지 않고 CTA와 active state에만 사용 |
| 텍스트 | Noto Sans KR 유지, 제목은 단단하고 짧게 |
| 그림자 | 모바일에서는 얕게, desktop에서만 단계적으로 강화 |
| blur | 기본 금지. 필요 시 desktop 또는 modal에만 제한 |
| animation | 기본 금지. 전환은 opacity/translate 1회성 중심 |

### Copy Tone

좋은 방향:

- “내 흐름을 봅니다”
- “관계의 결을 정리합니다”
- “오늘 바로 할 행동 하나”
- “사주와 성향을 함께 놓고 봅니다”
- “참고용 자기이해 콘텐츠입니다”

피해야 할 방향:

- 진단처럼 보이는 표현
- 공포성 단정
- 결혼/이별/재회 확정
- 공식 MBTI 검사처럼 보이는 표현

## 11. Mobile UX Principles

필수 원칙:

| 번호 | 원칙 | 적용 기준 |
|---|---|---|
| 1 | 첫 화면 CTA는 1~2개만 노출 | Hero와 첫 section에서 primary/secondary까지만 허용 |
| 2 | 카드 과다 사용 금지 | 한 viewport에 카드 2개 이상이 반복되지 않게 조절 |
| 3 | 기능 나열보다 흐름 선택 우선 | 홈과 허브는 `나의 결/관계의 결/오늘의 결` 우선 |
| 4 | active step만 렌더링 | 입력 화면은 현재 단계만 화면에 표시 |
| 5 | 하단 sticky CTA 사용 | 다음 행동이 항상 보이게 하되 bottom nav와 충돌 금지 |
| 6 | bottom nav는 5개 이하 | 홈, 내 풀이, 관계, 오늘, 대화 |
| 7 | 긴 입력 폼은 단계 분리 | 생년월일시, 성향, 질문/관심영역을 분리 |
| 8 | 결과 화면은 공통 ResultShell 사용 | 사용자가 결과 구조를 학습할 수 있게 통일 |

모바일 acceptance criteria:

- 360px 화면에서 hero title과 primary CTA가 첫 화면에 보여야 합니다.
- CTA 터치 영역은 최소 44px 이상이어야 합니다.
- 하단 sticky CTA는 bottom nav와 겹치지 않아야 합니다.
- 결과 화면은 점수보다 한 줄 정의와 다음 행동이 먼저 보여야 합니다.
- scroll 중 무한 animation, 큰 shadow, blur가 반복되지 않아야 합니다.

## 12. Performance Principles

필수 성능 원칙:

| 번호 | 원칙 | 적용 기준 |
|---|---|---|
| 1 | Server Component 우선 | 정적 copy, card, section은 server component 기본 |
| 2 | Client Component 최소화 | form state, tracking, auth widget 등 필요한 부분만 client |
| 3 | heavy animation 금지 | infinite animation은 loading/active feedback 외 금지 |
| 4 | backdrop-filter, 큰 blur, 과도한 shadow 금지 | mobile에서는 기본 비활성화 |
| 5 | 이미지 대신 CSS/SVG 상징 사용 | 핵심 motif는 text/SVG/CSS line 중심 |
| 6 | third-party script는 route 단위 로드 | 결제 SDK는 결제 route에서만 load |
| 7 | bundle analyzer 도입 검토 | 큰 client route부터 측정 |
| 8 | Core Web Vitals 측정 | LCP, INP, CLS, route별 Speed Insights 추적 |

권장 budget:

| 항목 | 목표 |
|---|---|
| Home client JS | analytics boundary 중심으로 축소 |
| Header client work | auth/credit/notification을 지연 또는 분리 |
| Mobile animation | reduced motion과 coarse pointer에서 비활성화 |
| Paint effects | blur/filter/mask 최소화, shadow token 제한 |
| Route bundle | 결제/AI/사주 계산 dependency가 홈 client에 섞이지 않게 유지 |

## 13. Page-Specific Direction

### Home

- 카드 나열보다 `FlowRow`를 먼저 배치합니다.
- `나의 결`, `관계의 결`, `오늘의 결`을 홈의 1차 선택지로 둡니다.
- 성향사주/성향궁합은 primary flow로 유지하되, 카드 2장을 크게 쌓기보다 선택 row + 대표 CTA로 줄입니다.

### Saju

- 기존 사주 입력은 `StepShell`로 감쌉니다.
- 결과는 `ResultShell`에 `FourPillarRail`을 추가합니다.
- 어려운 명리 정보는 foldable detail로 낮춥니다.

### Saju Personality

- 상단에 `GyeolBridge`를 표시합니다.
- 입력은 `기존 프로필/새 입력 -> 성향 선택/체크 -> 관심영역` 단계로 분리합니다.
- 결과는 `6축 AxisSummary`를 공통 result pattern에 맞춥니다.

### Compatibility

- 관계 허브는 기본 궁합과 성향궁합을 `관계의 결` 아래에서 비교합니다.
- 기존 궁합과 성향궁합의 route는 유지합니다.

### Personality Compatibility

- 성향궁합 2인 관계 로직은 수정하지 않습니다.
- UI shell만 `StepShell`과 `ResultShell`로 통일합니다.
- 두 사람의 `PillarRail`과 `AxisRail`을 나란히 보여주는 방향을 검토합니다.

### Today

- 오늘운세, 타로, 띠운세, 별자리는 `오늘의 결` 하위 quick flow로 묶습니다.
- 하루 단위 결과는 짧고 가볍게 유지합니다.

### Dialogue

- 결과 context 기반 CTA를 유지합니다.
- 원문 개인정보는 전달하지 않습니다.
- 대화방은 결과 이후의 “이어 묻기” 흐름으로 포지셔닝합니다.

### Archive / Pricing

- 보관함은 `/my/results` route 확인 후 IA에 맞게 정리합니다.
- 가격/멤버십은 “필요한 풀이만 열기” 원칙으로 copy를 통일합니다.

## 14. Accessibility Requirements

- 모든 CTA는 keyboard focus visible 상태를 가져야 합니다.
- 색상만으로 active/disabled를 구분하지 않습니다.
- score/axis rail은 텍스트 라벨을 함께 제공합니다.
- bottom nav는 `aria-label`과 현재 위치 표시를 제공합니다.
- motion reduced preference를 존중합니다.
- 결과/결제/공유 CTA는 스크린리더에서 목적이 명확해야 합니다.

## 15. Analytics Requirements

디자인 시스템 변경 후에도 analytics payload는 최소화합니다.

허용:

- `source`
- `section`
- `target`
- `featureId`
- `serviceId`
- `flow`
- `step`

금지:

- 이름
- 생년월일
- 태어난 시간
- 성별
- 성향 체크 원문
- 질문 원문
- 결제 상세 정보

권장 이벤트 구조:

```text
flow_selected
step_viewed
step_completed
result_viewed
unlock_clicked
archive_clicked
dialogue_started
```

기존 이벤트는 유지하되, 신규 디자인 시스템 적용 시 `flow`와 `section`만 추가하는 방향이 안전합니다.

## 16. Rollout Plan

### Phase 0: 설계 확정

- 이 PRD 리뷰
- route mismatch 확인
- performance budget 확정
- component naming 확정

### Phase 1: Foundation

- token 정리
- `GyeolShell`, `FlowRow`, `StepShell`, `ResultShell` 설계
- low-power mobile CSS policy 확정

### Phase 2: Home

- 홈 IA를 `나의 결 / 관계의 결 / 오늘의 결`로 재구성
- 홈 client boundary 축소
- 카드 수 감축

### Phase 3: Saju Personality / Personality Compatibility

- 신규 핵심 기능부터 shell 통일
- `GyeolBridge`, `AxisSummary` 적용
- 계산/결제/저장 로직은 유지

### Phase 4: Existing Flows

- 기본 사주
- 기본 궁합
- 오늘운세
- 타로
- 띠운세
- 별자리
- 대화방
- 보관함
- 가격

### Phase 5: Performance QA

- Lighthouse
- Vercel Speed Insights
- 실제 구형 휴대폰 smoke test
- bundle analyzer 검토

## 17. Files To Modify Later

후속 구현에서 수정 후보:

| 목적 | 후보 파일 |
|---|---|
| 디자인 토큰 | `src/app/styles/tokens.css` |
| 전역 shell | `src/shared/layout/app-shell.tsx` |
| 전역 CSS | `src/app/styles/app-shell.css`, `components.css`, `home.css`, `subpages.css`, `mobile-polish.css` |
| 홈 구조 | `src/app/page.tsx`, `src/features/home/gangi-home-client.tsx`, `src/components/home/*`, `src/config/home/*` |
| 내비게이션 | `src/features/shared-navigation/site-header.tsx`, `src/content/moonlight.ts`, `src/shared/config/site-navigation.ts` |
| 공통 UI | `src/components/ui/*`, `src/components/layout/*`, `src/components/gangi/gangi-ui.tsx` |
| 사주 입력/결과 | `src/features/saju-intake/*`, `src/app/saju/[slug]/*` |
| 성향사주 | `src/features/saju-personality/*`, `src/app/saju/personality/*` |
| 궁합/성향궁합 | `src/app/compatibility/*`, `src/features/compatibility/*` |
| 오늘/타로/띠/별자리 | `src/app/today-fortune/*`, `src/app/tarot/*`, `src/app/zodiac/*`, `src/app/star-sign/*` |
| 대화/MY/가격 | `src/app/dialogue/*`, `src/app/my/*`, `src/app/pricing/page.tsx` |

## 18. Blockers / Open Questions

| 항목 | 확인 필요 |
|---|---|
| `/my/results` | 실제 route 생성/redirect/링크 정책 확인 필요 |
| sitemap mismatch | `/guide`, `/about-engine`, `/method` route 존재 여부 확인 필요 |
| desktop nav | `DesktopSidebar` 유지/제거/복구 정책 결정 필요 |
| bottom nav | 1차 nav 5개 이하로 바꿀 때 기존 보관함 위치를 어떻게 둘지 결정 필요 |
| performance target | 구형 휴대폰 기준과 측정 담당자 결정 필요 |
| visual token | pink/gold/jade/sky 사용 비중 재정의 필요 |

## 19. Success Metrics

| 지표 | 목표 |
|---|---|
| 홈 CTA clarity | 첫 화면에서 사용자가 내 풀이/관계/오늘 중 하나를 바로 선택 |
| 모바일 체감 성능 | 구형 기기에서 홈 스크롤 jank 감소 |
| IA 이해도 | 신규 기능이 기존 기능과 같은 체계 안에 있다고 인지 |
| 결과 재사용성 | 사주/성향사주/궁합/성향궁합 결과가 같은 구조로 읽힘 |
| 디자인 일관성 | `app-*`/`gangi-*` 혼재가 점진적으로 줄어듦 |
| 안전성 | 결제/DB/계산/저장 로직 회귀 없음 |

## 20. Next Step

다음 작업은 구현 전에 `[작업 2] 달빛 결 디자인 시스템 컴포넌트 설계`를 권장합니다.

작업 2에서 정해야 할 것:

- `GyeolShell`, `FlowRow`, `StepShell`, `ResultShell` prop 구조
- `FourPillarRail`, `PersonalityAxisRail`, `GyeolBridge` 시각 규칙
- 기존 `AppShell`, `GangiIntro`, `FeatureCard`, `buttonVariants`와의 호환 방식
- 모바일 low-power CSS token
- 홈부터 적용할 최소 변경 범위
