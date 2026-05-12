# 달빛 결 공통 UI 컴포넌트 노트

작성일: 2026-05-12
작업 범위: 홈/내부 페이지 공통 UI 컴포넌트 생성 및 보강
비범위: route 적용, 결제, DB, Supabase migration, 사주 계산, 성향 계산, 결과 생성, 대화 저장 로직

## 1. 생성/보강한 컴포넌트 목록

| 컴포넌트 | 파일 | 상태 |
|---|---|---|
| AppPage | `src/components/moonlight/AppPage.tsx` | 기존 유지 |
| PageIntro | `src/components/moonlight/PageIntro.tsx` | 기존 유지 |
| FusionHero | `src/components/moonlight/FusionHero.tsx` | 기존 유지 |
| FusionStrip | `src/components/moonlight/FusionStrip.tsx` | 기존 유지 |
| SajuStrip | `src/components/moonlight/SajuStrip.tsx` | 기존 유지 |
| FlowEntryList | `src/components/moonlight/FlowEntryList.tsx` | 기존 유지 |
| ChoiceRow | `src/components/moonlight/ChoiceRow.tsx` | 기존 유지 |
| StepFlowShell | `src/components/moonlight/StepFlowShell.tsx` | progress 접근성 보강 |
| AxisChipGrid | `src/components/moonlight/AxisChipGrid.tsx` | aria label 보강 |
| StickyActionBar | `src/components/moonlight/StickyActionBar.tsx` | 기존 유지 |
| ResultShell | `src/components/moonlight/ResultShell.tsx` | 기존 유지 |
| AxisMeter | `src/components/moonlight/AxisMeter.tsx` | 기존 유지 |
| ZodiacCharacterList | `src/components/moonlight/ZodiacCharacterList.tsx` | 신규 생성 |
| SafetyNotice | `src/components/moonlight/SafetyNotice.tsx` | 제목/aria label 보강 |
| LightSection | `src/components/moonlight/LightSection.tsx` | 기존 유지 |
| PricingRow | `src/components/moonlight/PricingRow.tsx` | 기존 유지 |

## 2. 각 컴포넌트 용도

| 컴포넌트 | 용도 |
|---|---|
| AppPage | page max-width, padding, responsive spacing 통일 |
| PageIntro | 내부 페이지 상단 title, eyebrow, description, action 구성 |
| FusionHero | 홈/핵심 랜딩에서 사주 네 기둥과 성향 네 축을 함께 보여주는 hero |
| FusionStrip | 내부 페이지 상단에 반복 노출하는 `年 月 日 時 × I/E S/N T/F J/P` strip |
| SajuStrip | 기존 사주 결과처럼 성향 결합이 없는 화면의 네 기둥 strip |
| FlowEntryList | 홈의 나의 결/관계의 결/오늘의 결 진입 row |
| ChoiceRow | card 대신 사용하는 선택 row |
| StepFlowShell | active step 중심 입력 flow shell |
| AxisChipGrid | 16유형 성향, 점수 축, 선택 chip grid |
| StickyActionBar | 모바일 하단 CTA shell, safe-area 대응 |
| ResultShell | 결과 페이지 intro, keyword, score summary, action, body 구조 |
| AxisMeter | 성향사주 6축, 성향궁합 5축 점수 meter |
| ZodiacCharacterList | 12간지 대화방 compact list. 이미지 없이 glyph/한자 fallback 사용 |
| SafetyNotice | 참고용 자기이해 콘텐츠 및 전문 판단 대체 불가 안내 |
| LightSection | card보다 가벼운 section/panel block |
| PricingRow | 가격/멤버십에서 card grid 대신 row 중심 비교 |

## 3. Server Component / Client Component 구분

| 구분 | 컴포넌트 |
|---|---|
| Server-compatible | AppPage, PageIntro, FusionHero, FusionStrip, SajuStrip, FlowEntryList, ChoiceRow, StepFlowShell, AxisChipGrid, StickyActionBar, ResultShell, AxisMeter, ZodiacCharacterList, SafetyNotice, LightSection, PricingRow |
| Explicit client component | 없음 |

이번 작업에서 새 `use client` boundary는 추가하지 않았습니다.

`ChoiceRow`, `FlowEntryList`, `AxisChipGrid`, `ZodiacCharacterList`는 `onSelect`를 받을 수 있지만 hook을 사용하지 않으므로, client page에서 import될 때만 client bundle에 포함됩니다.

## 4. 기존 컴포넌트와의 관계

| 기존 컴포넌트 | 관계 |
|---|---|
| `src/components/ui/button.tsx` | shadcn/base-ui 기반 버튼은 유지. moonlight 컴포넌트 안에서는 버튼 스타일을 강제하지 않고 action slot으로 받음 |
| `src/components/ui/card.tsx` | card UI는 유지하되, 신규 디자인 시스템에서는 LightSection/FlowEntryList/ChoiceRow를 우선 사용 |
| `src/components/ui/input.tsx` | 기존 Input 유지. form shell은 StepFlowShell과 ChoiceRow로 정리 예정 |
| `src/components/ui/badge.tsx` | 기존 Badge 유지. moonlight row 내부 badge는 lightweight span으로 처리 |
| `src/components/gangi/gangi-ui.tsx` | 기존 화면 호환용으로 유지. 후속 작업에서 moonlight shell로 점진 대체 |
| `src/shared/layout/app-shell.tsx` | AppShell은 site-level shell, `components/moonlight/AppPage`는 page content width/padding shell |

## 5. 적용 예정 페이지군

| 페이지군 | 우선 적용 컴포넌트 |
|---|---|
| 홈 | FusionHero, FlowEntryList, LightSection, PricingRow |
| 내 풀이 | PageIntro, FusionStrip, StepFlowShell, ChoiceRow, AxisChipGrid |
| 관계 | PageIntro, FusionStrip, StepFlowShell, ChoiceRow, AxisMeter |
| 오늘 | PageIntro, SajuStrip, FlowEntryList, LightSection |
| 대화방 | ZodiacCharacterList, PageIntro, LightSection |
| 보관함 | FlowEntryList, LightSection, SafetyNotice |
| 가격 | PricingRow, LightSection, SafetyNotice |
| 결과 화면 | ResultShell, AxisMeter, SafetyNotice, StickyActionBar |

## 6. 접근성 고려사항

| 항목 | 처리 |
|---|---|
| button/link 구분 | href가 있으면 Link, 선택 동작이면 button, 정적 표시는 div 사용 |
| keyboard focus | token 기반 focus-visible ring 사용 |
| progress | StepFlowShell progress bar에 `role="progressbar"`와 aria value 추가 |
| meter | AxisMeter에 `role="meter"`와 0~100 aria value 제공 |
| 선택 상태 | ChoiceRow, AxisChipGrid, ZodiacCharacterList에 `aria-pressed` 또는 `data-selected` 제공 |
| 안전 안내 | SafetyNotice에 제목과 aria-label 제공 |
| 12간지 fallback | 이미지 없이 glyph/한자 fallback을 사용해 alt 이미지 의존 제거 |

## 7. 성능 고려사항

| 항목 | 처리 |
|---|---|
| dependency | 신규 dependency 없음 |
| client boundary | 신규 explicit client component 없음 |
| 이미지 | 큰 이미지 asset 추가 없음 |
| animation | framer-motion, lottie, GIF 추가 없음 |
| shadow/blur | moonlight token 기반 얕은 border/surface 중심 |
| mobile first | row/list/panel 중심으로 DOM과 paint 비용을 낮추는 방향 |
| 12간지 대화방 | 12개 대형 이미지 동시 로드 없이 compact text/glyph list 제공 |

## 8. 다음 단계

1. 홈부터 FlowEntryList/FusionHero 중심으로 적용합니다.
2. 성향사주/성향궁합 입력 페이지는 StepFlowShell, ChoiceRow, AxisChipGrid 중심으로 점진 정리합니다.
3. 결과 페이지는 ResultShell, AxisMeter, SafetyNotice로 구조를 맞춥니다.
4. 대화방은 12간지 구조를 유지하면서 ZodiacCharacterList로 compact list를 적용합니다.
