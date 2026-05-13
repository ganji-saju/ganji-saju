# 메인화면 리디자인 PRD

작성일: 2026-05-11

## 1. Product Goal

달빛인생 홈을 단순 서비스 목록에서 “오늘 무엇을 볼지 고르는 시작 화면”으로 재구성한다. 신규 핵심 기능인 달빛 성향사주와 달빛 성향궁합을 홈의 최상위 CTA로 노출하고, 기존 오늘운세, 타로, 사주, 궁합, 띠운세, 별자리, 대화방, 보관함 흐름은 사용자가 길을 잃지 않도록 정리한다.

이번 PRD는 홈 IA와 UI/UX 문서화만 다룬다. 결제, DB, Supabase migration, 사주 계산, 성향궁합/성향사주 도메인 로직은 변경하지 않는다.

## 2. Background

현재 홈은 `src/app/page.tsx`에서 `getHomeBanners()`를 호출하고 `GangiHomeClient`가 시즌 배너, 무료 액션 카드, 카테고리 탭, 서비스 카드 그리드를 표시하는 구조다. 홈은 모바일 카드몰 경험에 가깝고, 달빛 성향사주와 달빛 성향궁합 라우트는 이미 존재하지만 핵심 기능으로 직접 노출되어 있지 않다.

홈 리디자인의 핵심은 두 가지다.

- 사용자가 “내 흐름을 볼지, 관계를 볼지” 즉시 선택하게 한다.
- 기존 무료/유료/상담/보관함 동선을 유지하되, 우선순위를 명확히 한다.

## 3. Non-Goals

| 제외 범위 | 이유 |
|---|---|
| 결제 로직 변경 | 홈 노출과 무관하며 기존 결제 안정성 유지 필요 |
| DB schema 변경 | 홈 IA 개편에는 저장 구조 변경 불필요 |
| Supabase migration 추가 | 데이터 모델 변경 없음 |
| 사주 계산 로직 변경 | 홈은 입력/결과 엔진을 호출하지 않음 |
| 성향궁합/성향사주 도메인 로직 변경 | 기존 구현된 기능으로 연결만 수행 |
| `/my/results` 신규 구현 | 보관함 route 정비가 필요하면 별도 작업으로 분리 |
| 신규 검사형 UI 구현 | 공식 검사처럼 보이는 흐름 방지 |

## 4. Target Users

| 사용자 | 니즈 | 홈에서 제공할 답 |
|---|---|---|
| 처음 방문자 | 무엇부터 보면 좋을지 빠르게 알고 싶음 | Hero, Primary Feature Cards, Free Start Cards |
| 사주 관심 사용자 | 내 흐름과 성향을 같이 보고 싶음 | 달빛 성향사주 CTA |
| 관계 고민 사용자 | 그 사람과의 맞음/갈등을 보고 싶음 | 달빛 성향궁합 CTA |
| 가볍게 보는 사용자 | 로그인 없이 짧게 운세를 보고 싶음 | 오늘운세, 타로 한 장 |
| 재방문 사용자 | 이전 결과나 상담으로 돌아가고 싶음 | Recent Reports / Archive CTA |
| 결제 전환 후보 | 멤버십/가격을 비교하고 싶음 | Pricing / Membership CTA |

## 5. Home IA

홈 섹션 순서는 아래를 기준으로 한다.

| 순서 | 섹션 | 목적 |
|---|---|---|
| 1 | Header / Global Navigation | 주요 서비스와 계정 동선 유지 |
| 2 | Hero: 오늘 무엇을 보고 싶나요? | 홈의 질문과 핵심 선택지 제시 |
| 3 | Today Snapshot | 오늘운세, 띠, 별자리 등 가벼운 당일 흐름 미리보기 |
| 4 | Primary Feature Cards | 달빛 성향사주, 달빛 성향궁합을 핵심 CTA로 노출 |
| 5 | Free Start Cards | 오늘운세, 타로 한 장으로 무료 시작 유도 |
| 6 | Theme Service Grid | 기존 주요 서비스 탐색 |
| 7 | AI Dialogue Section | 대화방 상담 동선 연결 |
| 8 | Recent Reports / Archive CTA | 보관함, 최근 리포트 재방문 유도 |
| 9 | Pricing / Membership CTA | 가격/멤버십 탐색 유도 |
| 10 | Footer | 법적/회사/정책 링크 유지 |

## 6. Hero Section

Hero는 사용자가 홈에서 바로 “내 흐름”과 “관계” 중 하나를 선택하도록 설계한다.

### Hero Copy

```text
오늘 무엇을 보고 싶나요?

사주는 타고난 결을 보고,
성향은 지금의 선택 습관을 보여줍니다.

내 흐름을 보거나,
그 사람과의 관계를 확인해보세요.
```

### Primary CTA

| CTA | 연결 route | 역할 |
|---|---|---|
| 내 성향사주 보기 | `/saju/personality` | 개인 사주와 성향을 함께 보는 핵심 기능 |
| 우리 성향궁합 보기 | `/compatibility/personality` | 두 사람의 사주와 성향을 함께 보는 핵심 기능 |

Hero는 과장된 적중률, 단정 표현, 공식 검사처럼 보이는 문구를 쓰지 않는다.

## 7. Today Snapshot

Today Snapshot은 “지금 바로 눌러볼 이유”를 만드는 짧은 섹션이다. 기존 `getHomeBanners()`와 `buildPersonalizedTodaySummary()`를 재사용할 수 있다.

| 항목 | 내용 |
|---|---|
| 노출 후보 | 오늘의 한 줄, 오늘의 띠, 오늘의 별자리, 개인화 요약 |
| 연결 route | `/today-fortune?concern=general`, `/zodiac`, `/star-sign` |
| 개인정보 원칙 | 이름, 생년월일, 출생시간 원문을 표시하지 않음 |
| 문장 길이 | 모바일에서 1-2줄 안에 읽히는 요약 |

## 8. Primary Feature Cards

달빛 성향사주와 달빛 성향궁합은 홈의 가장 중요한 기능 카드로 배치한다.

| 카드 | 핵심 메시지 | 연결 route | 보조 설명 |
|---|---|---|---|
| 달빛 성향사주 | 타고난 결과 선택 습관을 함께 보기 | `/saju/personality` | 개인 사주 풀이에 16유형 성향 또는 성향 체크를 결합 |
| 달빛 성향궁합 | 우리 관계의 끌림과 갈등 패턴 보기 | `/compatibility/personality` | 두 사람의 사주 facts와 성향 facts를 결합 |

카드 문구는 `16유형 성향`, `성향 체크`, `참고용 자기이해 콘텐츠` 톤을 유지한다. `공식 MBTI 검사`, `MBTI 진단`, `심리검사`처럼 보이는 표현은 사용하지 않는다.

## 9. Free Start Cards

무료 시작 카드는 가볍고 빠른 진입을 담당한다.

| 카드 | 연결 route | 역할 |
|---|---|---|
| 오늘운세 | `/today-fortune?concern=general` | 무료 운세 시작 |
| 타로 한 장 | `/tarot/daily` | 무입력/저마찰 시작 |

기존 `GANGI_FREE_ACTIONS`와 `GangiQuickActionCard`를 우선 재사용한다.

## 10. Theme Service Grid

기존 주요 기능은 탐색형 grid로 유지한다. Primary Feature Cards와 중복되는 기능은 grid에서는 일반 진입점으로 낮춰 배치한다.

| 서비스 | 연결 route | 비고 |
|---|---|---|
| 내 사주풀이 | `/saju/new` | 기존 사주 입력 유지 |
| 궁합 | `/compatibility` 또는 `/compatibility/input` | 기존 궁합 유지 |
| 올해 흐름 | `/daewoon` | 기존 route 유지 |
| 좋은 날 | `/taekil` | 기존 route 유지 |
| 띠운세 | `/zodiac` | 기존 route 유지 |
| 별자리 | `/star-sign` | 기존 route 유지 |

기존 `GANGI_HOME_CARDS`, `GangiCategoryTabs`, `GangiServiceCardLink`를 재사용하되, 카드 우선순위와 카피를 홈 목표에 맞게 정리한다.

## 11. AI Dialogue Section

AI Dialogue Section은 결과를 본 뒤 상담으로 이어질 수 있다는 기대를 만든다.

| 항목 | 내용 |
|---|---|
| 연결 route | `/dialogue` |
| 메시지 방향 | “혼자 해석하기 어려운 부분은 대화로 이어서 물어볼 수 있음” |
| 포함 CTA | 대화방 열기 |
| 주의 | 사주/성향 원문 개인정보를 홈에서 노출하지 않음 |

## 12. Recent Reports / Archive CTA

Recent Reports / Archive CTA는 재방문자가 저장된 결과로 돌아가는 동선을 제공한다.

| 항목 | 내용 |
|---|---|
| 우선 연결 route | `/my` |
| 확인 필요 route | `/my/results` |
| UX 방향 | “이전에 본 풀이 다시 보기” |
| 주의 | 홈에서 리포트 본문, 이름, 생년월일, 출생시간을 노출하지 않음 |

현재 코드상 여러 링크가 `/my/results`를 사용하지만 실제 route 파일은 확인되지 않았다. 구현 단계에서는 `/my`로 우선 연결하거나 `/my/results` route 정비를 별도 작업으로 분리해야 한다.

## 13. Pricing / Membership CTA

Pricing / Membership CTA는 홈 하단에서 결제 전 탐색을 제공한다.

| CTA | 연결 route | 역할 |
|---|---|---|
| 가격 보기 | `/pricing` | 상품/가격 비교 |
| 멤버십 보기 | `/membership` | 멤버십 혜택 탐색 |

이번 홈 리디자인에서는 결제 상품, Toss, entitlement, Supabase 로직을 변경하지 않는다.

## 14. UX Principles

| 원칙 | 설명 |
|---|---|
| 첫 화면에서 선택지를 줄인다 | 핵심 선택은 성향사주와 성향궁합 2개로 제한 |
| 무료 시작은 빠르게 둔다 | 오늘운세와 타로 한 장을 바로 아래 배치 |
| 기존 기능은 버리지 않는다 | Theme Service Grid에서 모든 주요 route 유지 |
| 모바일 우선, 데스크톱 보강 | 기존 모바일 강점을 유지하되 desktop grid 폭 확장 |
| 개인정보를 홈에서 드러내지 않는다 | Today Snapshot과 Archive CTA는 요약형으로만 표시 |
| 검사처럼 보이지 않는다 | 성향 기능은 자기이해 콘텐츠로 표현 |

## 15. Copy Guidelines

| 사용 권장 | 사용 금지 |
|---|---|
| 16유형 성향 | 공식 MBTI 검사 |
| 성향 체크 | MBTI 진단 |
| 참고용 자기이해 콘텐츠 | MBTI 심리검사 |
| 이런 경향이 있습니다 | 무조건 |
| 도움이 될 수 있습니다 | 반드시 |
| 조절하면 좋습니다 | 절대 |
| 관계를 이해하는 힌트 | 최악, 파멸 |

## 16. Implementation Notes

다음 구현 단계의 중심 파일은 아래다.

| 파일 | 예상 역할 |
|---|---|
| `src/features/home/gangi-home-client.tsx` | 홈 섹션 순서 재구성 |
| `src/content/gangi-market.ts` | 신규 feature cards, 기존 service cards 정리 |
| `src/app/styles/home.css` | hero, snapshot, primary cards, CTA 섹션 스타일 |
| `src/app/styles/mobile-polish.css` | 모바일 spacing 보정 |
| `src/content/moonlight.ts` | navigation 노출이 필요할 경우만 수정 |

## 17. Acceptance Criteria

| 기준 | 성공 조건 |
|---|---|
| 핵심 기능 노출 | 홈 상단에서 달빛 성향사주와 달빛 성향궁합 CTA가 보임 |
| 기존 기능 유지 | 오늘운세, 타로, 사주, 궁합, 띠운세, 별자리, 대화방, 보관함, 가격 동선이 유지됨 |
| 개인정보 | 홈에서 이름, 생년월일, 출생시간, 성향 체크 원문이 노출되지 않음 |
| 문구 정책 | 공식 검사/진단처럼 보이는 표현을 쓰지 않음 |
| 모바일 UX | 하단 dock과 섹션 CTA가 겹치지 않음 |
| 회귀 방지 | 결제, DB, 사주 계산, 성향 도메인 로직 변경 없음 |

## 18. Next Step

다음 작업에서는 문서에 정의한 IA를 기준으로 홈 UI만 구현한다. 구현 범위는 홈 클라이언트, 홈 콘텐츠 상수, 홈 스타일에 한정하고, 결제/DB/사주 계산/성향 도메인 로직은 변경하지 않는다.
