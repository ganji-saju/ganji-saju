# Component Inventory

기준 브랜치: `main`

조사 명령:

```bash
find src/components src/features -type f \( -name '*.tsx' -o -name '*.ts' \) | sort
rg -n "^['\"]use client['\"]" src/app src/components src/features | sort
```

조사 범위:

- `src/components`: 88개 TS/TSX UI 파일
- `src/features`: 35개 TS/TSX feature 파일
- 총 123개 TS/TSX 파일
- `use client` 선언: 56개 파일

## Core Shell / Navigation

| 파일 | 역할 | 메모 |
|---|---|---|
| `src/shared/layout/app-shell.tsx` | `AppShell`, `AppPage`, `PageHero` | 대부분 신규 페이지의 shell 기준 |
| `src/features/shared-navigation/site-header.tsx` | Header, desktop nav, mobile menu, bottom nav, auth/coin | 단일 client boundary가 크고 Supabase/credit fetch 포함 |
| `src/shared/config/site-navigation.ts` | nav config re-export | 실제 데이터는 `src/content/moonlight.ts` |
| `src/components/site-footer.tsx` | Footer | 정책/사업자/면책 문구 유지 필요 |
| `src/features/account/account-shell-nav.tsx` | 계정 영역 nav | MY 하위 route와 정렬 필요 |

## Moonlight Design System Components

| 파일 | 역할 | 적용 상태 |
|---|---|---|
| `src/components/moonlight/AppPage.tsx` | Moonlight page wrapper | 기존 `src/shared/layout/app-shell.tsx`와 이름 중복성 있음 |
| `src/components/moonlight/PageIntro.tsx` | 페이지 intro | 성향/대화 일부 적용 |
| `src/components/moonlight/FusionHero.tsx` | 사주 네 기둥 x 성향 네 축 hero | 홈/브랜드 표현 기준 |
| `src/components/moonlight/FusionStrip.tsx` | `年 月 日 時 × I/E S/N T/F J/P` strip | 성향사주/성향궁합 시각 연결 |
| `src/components/moonlight/SajuStrip.tsx` | 사주 전용 strip | 기본 사주 결과 통합 후보 |
| `src/components/moonlight/FlowEntryList.tsx` | flow row/list | 홈/대화방 list 대체 후보 |
| `src/components/moonlight/ChoiceRow.tsx` | 선택 row | 입력 flow 표준 후보 |
| `src/components/moonlight/StepFlowShell.tsx` | active step shell | 성향사주/성향궁합 입력에 적용 |
| `src/components/moonlight/AxisChipGrid.tsx` | 16유형/축 chip grid | 성향 입력 표준 후보 |
| `src/components/moonlight/StickyActionBar.tsx` | 모바일 sticky CTA | 입력 flow 표준 후보 |
| `src/components/moonlight/ResultShell.tsx` | 결과 shell | 결과 화면 표준 후보 |
| `src/components/moonlight/AxisMeter.tsx` | 점수/축 meter | 성향/궁합 결과 표준 후보 |
| `src/components/moonlight/SafetyNotice.tsx` | 안전 고지 | 결과/대화/결제 하단 표준 후보 |
| `src/components/moonlight/LightSection.tsx` | 가벼운 section wrapper | home/subpage 공통 후보 |
| `src/components/moonlight/PricingRow.tsx` | 가격 row | pricing/membership 표준 후보 |

## Gangi Legacy Components

| 파일 | 역할 | 리스크 |
|---|---|---|
| `src/components/gangi/gangi-ui.tsx` | 12간지 캐릭터, page header, list, metric, mini card | 12간지 정체성의 핵심이지만 Moonlight와 토큰이 갈라짐 |
| `src/components/gangi/gangi-market.tsx` | 시즌 배너, quick action, category tabs, service card | carousel/interaction 포함, 홈과 충돌 가능 |
| `src/components/gangi/gangi-star-sign.tsx` | 별자리 icon | free content 유지 |
| `src/features/home/gangi-home-client.tsx` | 홈 hub | 현재 홈 핵심 구현 |
| `src/features/home/home-analytics-boundary.tsx` | 홈 click tracking island | 좋은 분리 구조 |
| `src/features/home/mobile-home-dock.tsx` | 과거 홈 dock | 현재 SiteHeader bottom nav와 중복 가능 |

## Base UI / Shadcn-like Components

| 파일 | 역할 | 리스크 |
|---|---|---|
| `src/components/ui/button.tsx` | Base UI 기반 Button | hover transform/shadow 포함, 모바일 성능/일관성 조정 필요 |
| `src/components/ui/card.tsx` | Card primitives | `bg-card`, shadcn token과 app/gyeol token 혼합 |
| `src/components/ui/input.tsx` | Input primitive | 높이 32px라 모바일 touch target 기준과 불일치 |
| `src/components/ui/badge.tsx` | Badge primitive | 일부 페이지는 직접 badge class 사용 |
| `src/components/ui/label.tsx` | Label primitive | client 선언 |
| `src/components/ui/separator.tsx` | Separator primitive | client 선언 |

## Saju / Personality / Compatibility

| 파일 | 역할 | 리스크 |
|---|---|---|
| `src/features/saju-intake/saju-intake-page.tsx` | 기본 사주 입력 | 큰 client form, style 임의값 많음 |
| `src/components/saju/shared/unified-birth-info-fields.tsx` | 생년월일시 공통 입력 | 재사용 핵심, 디자인 표준화 우선 |
| `src/features/saju-personality/saju-personality-input-client.tsx` | 성향사주 입력 | StepFlow 적용됐지만 내부 panel style 혼합 |
| `src/features/saju-personality/saju-personality-result-handoff-client.tsx` | 성향사주 결과/결제/공유/AI CTA | 기능 민감, style만 제한적으로 정리 필요 |
| `src/features/compatibility/compatibility-input-client.tsx` | 기본 궁합 입력 | 기존 flow 유지 필요 |
| `src/features/compatibility/compatibility-result-view.tsx` | 기본 궁합 결과 | ResultShell 통합 후보 |
| `src/features/compatibility/personality-compatibility-input-client.tsx` | 성향궁합 입력 | 큰 client form, StepFlow/ChoiceRow 적용 영역 |
| `src/features/compatibility/personality-compatibility-result-client.tsx` | 성향궁합 결과 | 개인정보 표시/공유 기준 확인 필요 |
| `src/components/saju/mobile-saju-result-story.tsx` | 모바일 사주 결과 story | old result UX와 새 ResultShell 사이 접점 |
| `src/components/saju/five-element-orbit-chart.tsx` | 오행 차트 | custom SVG/chart성 컴포넌트 |

## Dialogue

| 파일 | 역할 | 리스크 |
|---|---|---|
| `src/app/dialogue/page.tsx` | 12간지 대화방 entry | 현재 추천 4명 섹션이 브랜드 기준과 충돌 |
| `src/app/dialogue/[expert]/page.tsx` | 12간지 채팅 room | 채팅 형식 유지 필요 |
| `src/components/dialogue/dialogue-chat-panel.tsx` | 채팅 UI/입력/전문 분야 선택 | 고정 높이, scroll, 큰 client state |
| `src/lib/dialogue-experts.ts` | 12간지 persona source of truth | 수정 금지에 가까움, UI에서 이 데이터 전체를 존중해야 함 |
| `src/components/gangi/gangi-ui.tsx` | `GANGI_ZODIAC`, `GANGI_TEACHERS` | 12간지 visual source |

## Payment / Account / Report

| 파일 | 역할 | 주의 |
|---|---|---|
| `src/components/membership/toss-membership-checkout.tsx` | Toss 멤버십 결제 | 결제 로직 수정 금지 |
| `src/components/payments/toss-payment-method-picker.tsx` | Toss 결제수단 | 결제 로직 수정 금지 |
| `src/components/detail-unlock.tsx` | 유료 해금 panel | entitlement와 결제 연결 민감 |
| `src/components/my/profile-manager.tsx` | MY 프로필/가족 정보 | 개인정보 입력, touch target 우선 |
| `src/components/my/saved-readings-list.tsx` | 보관함 리스트 | 개인정보 노출 기준 필요 |
| `src/components/my/subscription-manager.tsx` | 구독 관리 | 결제 정책 유지 |
| `src/components/report/report-keepsake-section.tsx` | 저장/공유/AI CTA | PII 비노출 기준 유지 |
| `src/components/report/report-print-actions.tsx` | 프린트 action | sticky/print CSS 주의 |

## Today / Tarot / Free Content

| 파일 | 역할 | 리스크 |
|---|---|---|
| `src/features/today-fortune/today-fortune-experience.tsx` | 오늘운세 experience | 기존 card/list style |
| `src/features/today-fortune/today-fortune-result-client.tsx` | 오늘운세 result | old shell |
| `src/features/today-fortune/today-fortune-detail-client.tsx` | 오늘운세 detail unlock | old card/CTA |
| `src/components/today-fortune/*` | 오늘운세 카드/점수/잠금/질문 | 카드형 구성 많음 |
| `src/app/tarot/daily/pick/tarot-card-picker.tsx` | 타로 선택 carousel | 이미지/overflow/animation 리스크 |
| `src/components/tarot/tarot-card-artwork.tsx` | 타로 카드 이미지 | 78장 이미지 asset 사용 |

## Client Boundary Hotspots

우선 검토 대상:

- `src/features/shared-navigation/site-header.tsx`
- `src/features/saju-intake/saju-intake-page.tsx`
- `src/features/saju-personality/saju-personality-input-client.tsx`
- `src/features/compatibility/personality-compatibility-input-client.tsx`
- `src/components/dialogue/dialogue-chat-panel.tsx`
- `src/components/ai/yearly-report-panel.tsx`
- `src/components/ai/lifetime-report-panel.tsx`
- `src/components/ai/fortune-calendar-panel.tsx`
- `src/app/login/page.tsx`
- `src/features/notifications/notification-center-page.tsx`

