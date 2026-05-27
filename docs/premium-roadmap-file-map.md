# 간지사주 고급화 적용용 파일 맵

이 문서는 `조용한 프리미엄 명리 컨시어지` 방향으로 간지사주를 단계적으로 고급화할 때 참고할 **레포 구조 지도**입니다.

주의:

- 이번 문서는 구조 파악용이며, 실제 사주 계산 로직 변경을 전제로 하지 않습니다.
- `격국`, `용신`, `대운`, `세운`, `명식 계산`, `grounding/evidence` 생성 로직은 별도 보호 구역으로 간주합니다.

---

## 1. 라우트별 파일 경로

### 홈

- 홈 라우트: [src/app/page.tsx](/Users/kionya/saju-app/src/app/page.tsx)
- 홈 Hero 보조 컴포넌트: [src/features/home/hero-section.tsx](/Users/kionya/saju-app/src/features/home/hero-section.tsx)
- 홈 개인화 블록: [src/features/home/personalized-today.ts](/Users/kionya/saju-app/src/features/home/personalized-today.ts)
- 홈 멤버십 섹션: [src/features/home/membership-section.tsx](/Users/kionya/saju-app/src/features/home/membership-section.tsx)
- 홈 콘텐츠 정의: [src/features/home/content.ts](/Users/kionya/saju-app/src/features/home/content.ts), [src/lib/home-content.ts](/Users/kionya/saju-app/src/lib/home-content.ts)

### 사주 입력

- 진입 라우트: [src/app/saju/new/page.tsx](/Users/kionya/saju-app/src/app/saju/new/page.tsx)
- 실제 입력/온보딩 UI: [src/features/saju-intake/saju-intake-page.tsx](/Users/kionya/saju-app/src/features/saju-intake/saju-intake-page.tsx)
- 하위 라우트 흔적:
  - [src/app/saju/new/birth/page.tsx](/Users/kionya/saju-app/src/app/saju/new/birth/page.tsx)
  - [src/app/saju/new/empathy/page.tsx](/Users/kionya/saju-app/src/app/saju/new/empathy/page.tsx)
  - [src/app/saju/new/nickname/page.tsx](/Users/kionya/saju-app/src/app/saju/new/nickname/page.tsx)
  - [src/app/saju/new/consent/page.tsx](/Users/kionya/saju-app/src/app/saju/new/consent/page.tsx)

### 멤버십 / 결제

- 멤버십 메인: [src/app/membership/page.tsx](/Users/kionya/saju-app/src/app/membership/page.tsx)
- 결제 페이지: [src/app/membership/checkout/page.tsx](/Users/kionya/saju-app/src/app/membership/checkout/page.tsx)
- 결제 완료/리다이렉트:
  - [src/app/membership/complete/page.tsx](/Users/kionya/saju-app/src/app/membership/complete/page.tsx)
  - [src/app/membership/success/page.tsx](/Users/kionya/saju-app/src/app/membership/success/page.tsx)
- 결제 위젯 컴포넌트: [src/components/membership/toss-membership-checkout.tsx](/Users/kionya/saju-app/src/components/membership/toss-membership-checkout.tsx)

### 대화

- 대화 메인: [src/app/dialogue/page.tsx](/Users/kionya/saju-app/src/app/dialogue/page.tsx)
- 안전 분리 라우트: [src/app/dialogue/safe-redirect/page.tsx](/Users/kionya/saju-app/src/app/dialogue/safe-redirect/page.tsx)
- 대화 패널 UI: [src/components/dialogue/dialogue-chat-panel.tsx](/Users/kionya/saju-app/src/components/dialogue/dialogue-chat-panel.tsx)

### 풀이 엔진 안내 / 읽을거리

- 풀이: [src/app/about-engine/page.tsx](/Users/kionya/saju-app/src/app/about-engine/page.tsx)
- 읽을거리 허브: [src/app/method/page.tsx](/Users/kionya/saju-app/src/app/method/page.tsx)
- 읽을거리 상세: [src/app/method/[slug]/page.tsx](/Users/kionya/saju-app/src/app/method/[slug]/page.tsx)
- 읽을거리 데이터 소스: [src/lib/engine-method-pages.ts](/Users/kionya/saju-app/src/lib/engine-method-pages.ts)

### 리포트 결과 / 풀이 / 샘플

- 통합 결과 메인: [src/app/saju/[slug]/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/page.tsx)
- 결과 상세 탭:
  - [src/app/saju/[slug]/overview/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/overview/page.tsx)
  - [src/app/saju/[slug]/elements/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/elements/page.tsx)
  - [src/app/saju/[slug]/nature/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/nature/page.tsx)
  - [src/app/saju/[slug]/premium/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/premium/page.tsx)
- 샘플 리포트 진입: [src/app/sample-report/page.tsx](/Users/kionya/saju-app/src/app/sample-report/page.tsx)
- 결과 탭 네비게이션: [src/features/saju-detail/saju-screen-nav.tsx](/Users/kionya/saju-app/src/features/saju-detail/saju-screen-nav.tsx)

### 연간/평생 리포트 내부 섹션

- 연간 리포트 패널: [src/components/ai/yearly-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/yearly-report-panel.tsx)
- 평생 리포트 패널: [src/components/ai/lifetime-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/lifetime-report-panel.tsx)
- 근거/KASI 요약 카드: [src/components/ai/grounding-kasi-summary.tsx](/Users/kionya/saju-app/src/components/ai/grounding-kasi-summary.tsx)
- AI 해석 패널: [src/components/ai/saju-ai-interpretation-panel.tsx](/Users/kionya/saju-app/src/components/ai/saju-ai-interpretation-panel.tsx)

### MY 보관함 / 결과 재열람

- MY 메인: [src/app/my/page.tsx](/Users/kionya/saju-app/src/app/my/page.tsx)
- MY 레이아웃: [src/app/my/layout.tsx](/Users/kionya/saju-app/src/app/my/layout.tsx)
- 결과보관함: [src/app/my/results/page.tsx](/Users/kionya/saju-app/src/app/my/results/page.tsx)
- 보관 리스트 컴포넌트: [src/components/my/saved-readings-list.tsx](/Users/kionya/saju-app/src/components/my/saved-readings-list.tsx)
- 프로필: [src/app/my/profile/page.tsx](/Users/kionya/saju-app/src/app/my/profile/page.tsx)
- 빌링: [src/app/my/billing/page.tsx](/Users/kionya/saju-app/src/app/my/billing/page.tsx)

### PDF 관련

- 현재 스캔 상태, `src/app/**` 아래에 **별도 PDF 다운로드 전용 라우트/렌더러는 명시적으로 보이지 않음**
- 대신 PDF/소장성 메시지가 노출되는 대표 파일:
  - [src/app/membership/page.tsx](/Users/kionya/saju-app/src/app/membership/page.tsx)
  - [src/app/sample-report/page.tsx](/Users/kionya/saju-app/src/app/sample-report/page.tsx)
  - [src/app/saju/[slug]/premium/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/premium/page.tsx)
- 결제/소장 엔타이틀먼트 인접 파일:
  - [src/lib/payments/lifetime-report.ts](/Users/kionya/saju-app/src/lib/payments/lifetime-report.ts)
  - [src/lib/report-entitlements.ts](/Users/kionya/saju-app/src/lib/report-entitlements.ts)
  - [src/lib/credits/detail-report-access.ts](/Users/kionya/saju-app/src/lib/credits/detail-report-access.ts)

---

## 2. 재사용 가능한 컴포넌트

### 레이아웃 / 표면

- 공통 셸, 페이지 폭, Hero:
  - [src/shared/layout/app-shell.tsx](/Users/kionya/saju-app/src/shared/layout/app-shell.tsx)
  - `AppShell`, `AppPage`, `PageHero`
- 공통 네비게이션:
  - [src/features/shared-navigation/site-header.tsx](/Users/kionya/saju-app/src/features/shared-navigation/site-header.tsx)

### UI primitives

- 버튼: [src/components/ui/button.tsx](/Users/kionya/saju-app/src/components/ui/button.tsx)
- 배지: [src/components/ui/badge.tsx](/Users/kionya/saju-app/src/components/ui/badge.tsx)
- 카드: [src/components/ui/card.tsx](/Users/kionya/saju-app/src/components/ui/card.tsx)

### 브랜드/콘텐츠 공용

- 읽을거리 링크 묶음: [src/components/content/engine-method-links.tsx](/Users/kionya/saju-app/src/components/content/engine-method-links.tsx)
- 고전 근거 패널: [src/components/classics/classic-evidence-panel.tsx](/Users/kionya/saju-app/src/components/classics/classic-evidence-panel.tsx)
- 사주 fact/evidence 패널: [src/components/saju/saju-fact-evidence-panel.tsx](/Users/kionya/saju-app/src/components/saju/saju-fact-evidence-panel.tsx)
- 판정 근거 펼치기: [src/components/saju/grounding-decision-trace.tsx](/Users/kionya/saju-app/src/components/saju/grounding-decision-trace.tsx)

### 결과/상품 계열

- 연간 리포트: [src/components/ai/yearly-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/yearly-report-panel.tsx)
- 평생 리포트: [src/components/ai/lifetime-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/lifetime-report-panel.tsx)
- Fortune Calendar: [src/components/ai/fortune-calendar-panel.tsx](/Users/kionya/saju-app/src/components/ai/fortune-calendar-panel.tsx)
- today premium teaser/result:
  - [src/components/today-fortune/premium-lock-card.tsx](/Users/kionya/saju-app/src/components/today-fortune/premium-lock-card.tsx)
  - [src/components/today-fortune/today-premium-panel.tsx](/Users/kionya/saju-app/src/components/today-fortune/today-premium-panel.tsx)

### 재사용 관점 메모

- `PageHero`, `app-panel`, `moon-lunar-panel`, `moon-plan-card`, `moon-orbit-card`, `app-caption`은 이미 **브랜드 공통 표면**으로 쓰이고 있음
- 반면 **가격 카드 전용 공통 컴포넌트**는 아직 없고, 멤버십 페이지 안에서 인라인 구성 비중이 높음
- CTA 버튼도 공통 `Button` primitive는 있지만, **브랜드 CTA 묶음 컴포넌트**는 따로 없음

---

## 3. 수정 후보 파일

아래는 “고급 사주풀이 플랫폼” 방향으로 실제 적용할 때 손댈 가능성이 높은 파일들입니다.

### 1차 우선 후보

- 홈 Hero/신뢰 카드/CTA
  - [src/app/page.tsx](/Users/kionya/saju-app/src/app/page.tsx)
  - [src/features/home/hero-section.tsx](/Users/kionya/saju-app/src/features/home/hero-section.tsx)
  - [src/features/home/personalized-today.ts](/Users/kionya/saju-app/src/features/home/personalized-today.ts)
- 사주 입력 전환 카피/설명
  - [src/features/saju-intake/saju-intake-page.tsx](/Users/kionya/saju-app/src/features/saju-intake/saju-intake-page.tsx)
- 멤버십/결제
  - [src/app/membership/page.tsx](/Users/kionya/saju-app/src/app/membership/page.tsx)
  - [src/app/membership/checkout/page.tsx](/Users/kionya/saju-app/src/app/membership/checkout/page.tsx)
  - [src/components/membership/toss-membership-checkout.tsx](/Users/kionya/saju-app/src/components/membership/toss-membership-checkout.tsx)

### 2차 우선 후보

- 리포트 결과 첫 1분 UX
  - [src/app/saju/[slug]/overview/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/overview/page.tsx)
  - [src/app/saju/[slug]/premium/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/premium/page.tsx)
  - [src/components/ai/yearly-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/yearly-report-panel.tsx)
  - [src/components/ai/lifetime-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/lifetime-report-panel.tsx)
- 샘플/미리보기/읽을거리
  - [src/app/sample-report/page.tsx](/Users/kionya/saju-app/src/app/sample-report/page.tsx)
  - [src/app/about-engine/page.tsx](/Users/kionya/saju-app/src/app/about-engine/page.tsx)
  - [src/app/method/page.tsx](/Users/kionya/saju-app/src/app/method/page.tsx)
  - [src/app/method/[slug]/page.tsx](/Users/kionya/saju-app/src/app/method/[slug]/page.tsx)

### 3차 후보

- MY 보관함/재열람
  - [src/app/my/results/page.tsx](/Users/kionya/saju-app/src/app/my/results/page.tsx)
  - [src/components/my/saved-readings-list.tsx](/Users/kionya/saju-app/src/components/my/saved-readings-list.tsx)
- 대화와 풀이 연결
  - [src/app/dialogue/page.tsx](/Users/kionya/saju-app/src/app/dialogue/page.tsx)
  - [src/components/dialogue/dialogue-chat-panel.tsx](/Users/kionya/saju-app/src/components/dialogue/dialogue-chat-panel.tsx)

---

## 4. 건드리지 말아야 할 계산/엔진 파일

아래는 이번 고급화 작업에서 **수정 금지 또는 최소 접근 원칙**이 필요한 계산/엔진 계층입니다.

### 핵심 계산

- 사주 계산 엔진:
  - [src/domain/saju/engine/saju-data-v1.ts](/Users/kionya/saju-app/src/domain/saju/engine/saju-data-v1.ts)
- Orrery/운 흐름 어댑터:
  - [src/domain/saju/engine/orrery-adapter.ts](/Users/kionya/saju-app/src/domain/saju/engine/orrery-adapter.ts)

### 리포트 계산 빌더

- 리포트 생성/grounding:
  - [src/domain/saju/report/build-report.ts](/Users/kionya/saju-app/src/domain/saju/report/build-report.ts)
  - [src/domain/saju/report/build-grounding.ts](/Users/kionya/saju-app/src/domain/saju/report/build-grounding.ts)
  - [src/domain/saju/report/grounding-types.ts](/Users/kionya/saju-app/src/domain/saju/report/grounding-types.ts)
  - [src/domain/saju/report/interpretation-rule-table.ts](/Users/kionya/saju-app/src/domain/saju/report/interpretation-rule-table.ts)
  - [src/domain/saju/report/grounding-decision-trace.ts](/Users/kionya/saju-app/src/domain/saju/report/grounding-decision-trace.ts)

### 읽기 저장/resolve

- reading persistence:
  - [src/lib/saju/readings.ts](/Users/kionya/saju-app/src/lib/saju/readings.ts)
  - [src/lib/saju/report.ts](/Users/kionya/saju-app/src/lib/saju/report.ts)
  - [src/lib/saju/report-metadata.ts](/Users/kionya/saju-app/src/lib/saju/report-metadata.ts)

### API 엔진 연결

- today-fortune / interpret / ai routes:
  - [src/app/api/today-fortune/route.ts](/Users/kionya/saju-app/src/app/api/today-fortune/route.ts)
  - [src/app/api/today-fortune/unlock/route.ts](/Users/kionya/saju-app/src/app/api/today-fortune/unlock/route.ts)
  - [src/app/api/interpret/route.ts](/Users/kionya/saju-app/src/app/api/interpret/route.ts)
  - [src/app/api/ai/route.ts](/Users/kionya/saju-app/src/app/api/ai/route.ts)

### AI 리포트 서비스

- [src/server/ai/saju-yearly-service.ts](/Users/kionya/saju-app/src/server/ai/saju-yearly-service.ts)
- [src/server/ai/saju-lifetime-service.ts](/Users/kionya/saju-app/src/server/ai/saju-lifetime-service.ts)
- [src/server/ai/saju-interpretation.ts](/Users/kionya/saju-app/src/server/ai/saju-interpretation.ts)

### 검증 계층

- [src/server/verification/saju-audit.ts](/Users/kionya/saju-app/src/server/verification/saju-audit.ts)
- [src/server/verification/today-fortune-audit.ts](/Users/kionya/saju-app/src/server/verification/today-fortune-audit.ts)
- [src/app/verification/page.tsx](/Users/kionya/saju-app/src/app/verification/page.tsx)

원칙:

- UI 개편 중에도 위 파일은 **카피/노출용 read-only consumer**로만 취급하는 것이 안전합니다.
- “왜 그렇게 판정했는지 보여주는 UI”는 가능하지만, 판정 로직 자체는 바꾸지 않습니다.

---

## 5. 1~5단계 적용 순서

### 1단계. 홈 전환

- 목표:
  - “오늘 운세”보다 “내 깊은 사주풀이 만들기”를 전면에 배치
  - 샘플 리포트, 판정 근거, PDF/보관함 가치를 Hero 상단 축으로 끌어올리기
- 중심 파일:
  - [src/app/page.tsx](/Users/kionya/saju-app/src/app/page.tsx)
  - [src/features/home/hero-section.tsx](/Users/kionya/saju-app/src/features/home/hero-section.tsx)
  - [src/features/home/personalized-today.ts](/Users/kionya/saju-app/src/features/home/personalized-today.ts)

### 2단계. 상품 구조/카피 분리

- 목표:
  - 구독은 대화용, 리포트는 소장용으로 분리
  - “심층 리포트”보다 “깊은 사주풀이”를 주 상품명으로 정리
- 중심 파일:
  - [src/app/membership/page.tsx](/Users/kionya/saju-app/src/app/membership/page.tsx)
  - [src/app/membership/checkout/page.tsx](/Users/kionya/saju-app/src/app/membership/checkout/page.tsx)
  - [src/components/membership/toss-membership-checkout.tsx](/Users/kionya/saju-app/src/components/membership/toss-membership-checkout.tsx)
  - [src/lib/payments/catalog.ts](/Users/kionya/saju-app/src/lib/payments/catalog.ts)

### 3단계. 샘플 리포트 / 풀이 엔진 안내 / 읽을거리

- 목표:
  - 결제 전에 “왜 돈을 내야 하는지”를 샘플과 풀이로 납득시키기
  - about-engine, method, sample-report 삼각 구조 강화
- 중심 파일:
  - [src/app/sample-report/page.tsx](/Users/kionya/saju-app/src/app/sample-report/page.tsx)
  - [src/app/about-engine/page.tsx](/Users/kionya/saju-app/src/app/about-engine/page.tsx)
  - [src/app/method/page.tsx](/Users/kionya/saju-app/src/app/method/page.tsx)
  - [src/app/method/[slug]/page.tsx](/Users/kionya/saju-app/src/app/method/[slug]/page.tsx)

### 4단계. 리포트 UX 재구성

- 목표:
  - 결과 첫 1분 UX를 “한 줄 총평 → 구조 → 판정 근거 → 실행 전략” 순서로 강화
  - 연간/평생/풀이가 하나의 제품군처럼 느껴지게 정리
- 중심 파일:
  - [src/app/saju/[slug]/overview/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/overview/page.tsx)
  - [src/app/saju/[slug]/premium/page.tsx](/Users/kionya/saju-app/src/app/saju/[slug]/premium/page.tsx)
  - [src/components/ai/yearly-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/yearly-report-panel.tsx)
  - [src/components/ai/lifetime-report-panel.tsx](/Users/kionya/saju-app/src/components/ai/lifetime-report-panel.tsx)
  - [src/components/saju/saju-fact-evidence-panel.tsx](/Users/kionya/saju-app/src/components/saju/saju-fact-evidence-panel.tsx)

### 5단계. MY 보관함 / 재열람 / 대화 연결

- 목표:
  - 풀이가 “한 번 보는 글”이 아니라 “보관하고 다시 질문하는 참고점”으로 보이게 만들기
  - 결과보관함, PDF, 대화 이어보기를 하나의 제품 경험으로 묶기
- 중심 파일:
  - [src/app/my/results/page.tsx](/Users/kionya/saju-app/src/app/my/results/page.tsx)
  - [src/components/my/saved-readings-list.tsx](/Users/kionya/saju-app/src/components/my/saved-readings-list.tsx)
  - [src/app/dialogue/page.tsx](/Users/kionya/saju-app/src/app/dialogue/page.tsx)
  - [src/components/dialogue/dialogue-chat-panel.tsx](/Users/kionya/saju-app/src/components/dialogue/dialogue-chat-panel.tsx)

---

## 6. 리스크 메모

### 구조 리스크

- `src/app/saju/new/**` 하위 라우트 흔적이 남아 있어, 홈 CTA/입력 전환 개편 시 오래된 동선과 문구가 다시 섞일 수 있습니다.
- `심층 리포트`, `깊은 사주풀이`, `premium` 용어가 아직 일부 파일에서 혼용됩니다. 카피 일괄 정리 전에는 결제 흐름에서 혼란이 생길 수 있습니다.

### 제품 리스크

- “PDF 소장” 가치는 강하게 노출되지만, 현재 스캔 근거로 **전용 PDF 라우트/렌더러가 명확히 분리된 구조는 보이지 않습니다.**
  - 따라서 실제 제공 범위와 화면 카피를 맞춰야 합니다.
- 가격 카드/플랜 카드가 멤버십 페이지 안에 인라인으로 많아, 상품 구조를 더 쪼개면 중복 UI가 빠르게 늘어날 수 있습니다.

### 엔진/데이터 리스크

- `grounding`, `KASI 대조`, `decision trace`는 이미 사용자 노출 구조에 연결돼 있으므로, UI 개편 중 이 연결선을 끊으면 브랜드 핵심 차별점이 약해집니다.
- today-fortune, 대화, 연간/평생 리포트가 reading persistence를 공유하고 있어, 제품명/카피 개편은 자유롭지만 엔진 output shape는 함부로 바꾸면 안 됩니다.

### 디자인/브랜드 리스크

- 현재 브랜드 자산은 “차분한 네이비 + 골드 + serif accent” 쪽으로 정리되고 있습니다.
- 여기서 청월당식 웹툰/캐릭터 과장으로 가면 지금 쌓아둔 `about-engine`, `method`, 판정 근거 UI 축과 충돌합니다.
- 반대로 음양관식 “목차 과다/분량 과시”로만 가도, 기존 대화형/재방문형 장점이 묻힐 수 있습니다.

### 구현 메모

- Tailwind 설정 파일은 별도로 보이지 않으며, 실제 디자인 토큰/폰트 역할은 [src/app/globals.css](/Users/kionya/saju-app/src/app/globals.css)의 `@theme inline`에 모여 있습니다.
- 폰트 로딩은 [src/app/layout.tsx](/Users/kionya/saju-app/src/app/layout.tsx) 의 `next/font` 설정이 근거입니다.
- 따라서 고급화 작업은 **tailwind.config 수정형이 아니라 globals.css + route/component 조정형**으로 접근하는 편이 자연스럽습니다.

