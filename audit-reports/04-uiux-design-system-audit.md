# 04. UI/UX · Design System Audit

> 2026-05-13 · `audit-reports/screenshots/` 60장 (10 라우트 × 6 viewport) 기반
> 토큰 출처: [`src/app/styles/tokens.css`](../src/app/styles/tokens.css)

---

## 1. 디자인 시스템 개요

### 스택
- **shadcn/ui** `base-nova` 스타일, baseColor: `neutral`, cssVariables: true
- **컴포넌트 별칭**: `@/components`, `@/ui`, `@/lib/utils`
- **아이콘**: Lucide
- **다크 모드**: `.dark` 클래스로 oklch 색상 재정의

### 토큰 파일 매핑
| 파일 | 역할 |
|---|---|
| [`src/app/styles/tokens.css`](../src/app/styles/tokens.css) | 모든 디자인 토큰 (color, font, spacing, radius, shadow) — 150줄 |
| [`src/app/globals.css`](../src/app/globals.css) | 통합 import |
| [`src/app/styles/app-shell.css`](../src/app/styles/app-shell.css) | 모바일 dock, 데스크탑 사이드바 등 레이아웃 모드 |
| [`src/app/styles/mobile-polish.css`](../src/app/styles/mobile-polish.css) | 모바일 특화 폴리시 |

---

## 2. 컬러 토큰 + WCAG 대비 분석

(상세 JSON은 [`design-token-diff.json`](design-token-diff.json) 참조)

| 토큰 | 값 | 흰 배경 대비 | AA 정상 텍스트 (≥4.5) | AA 큰 텍스트 (≥3.0) |
|---|---|---:|---|---|
| `--app-pink` | `#ff4f9a` | 2.95:1 | ❌ | ❌ |
| `--app-pink-strong` | `#d81b72` | 4.62:1 | ✅ | ✅ |
| `--app-pink-soft` | `#fff0f7` | — | (배경용) | |
| `--app-jade` | `#0f9f7a` | 4.51:1 | ✅ | ✅ |
| `--app-coral` | `#ff6b6b` | 3.41:1 | ❌ | ✅ |
| `--app-plum` | `#c04de0` | 3.92:1 | ❌ | ✅ |
| `--app-sky` | `#368ee8` | 3.69:1 | ❌ | ✅ |

### 권고
- `--app-pink`를 본문/CTA 텍스트로 사용 시 → `--app-pink-strong`으로 교체
- 또는 핑크 배경 + 흰 텍스트 (역상) 사용 (`#ffffff` on `#ff4f9a`: 3.0:1, 큰 텍스트 OK)
- `--app-coral`, `--app-plum`, `--app-sky`도 본문 텍스트로 사용 시 큰 텍스트(18pt+)에 제한

---

## 3. 컴포넌트 라이브러리 구조

```
src/components/
├── ui/                  ← shadcn 기본 6개 (button, card, badge, input, label, separator)
├── layout/              ← 8개 (section-header, section-surface, feature-card, swipe-section-deck, action-cluster)
├── home/                ← moonlight-hero-video, product-report-card
├── saju/                ← saju-result-story, five-element-orbit-chart, evidence-panel, decision-trace
├── today-fortune/       ← premium-lock-card (결제), birth-info-stepper
├── membership/          ← toss-membership-checkout (결제 UI)
├── payments/            ← toss-payment-method-picker
├── dialogue/            ← dialogue-chat-panel (단일 Modal/Dialog 사용)
├── counselor/, tarot/, classics/, ai/, content/, report/
└── detail-unlock.tsx    ← 65줄 — 550원 unlock 컴포넌트
```

총 65개 컴포넌트.

### shadcn `button` variants 사용 현황
- 6 variants: default, outline, secondary, ghost, destructive, link
- 사용 빈도: 대다수 페이지에서 사용 (라이브 확인)

---

## 4. 레이아웃 모드 시스템

`src/app/layout.tsx`에서 `data-app-layout` / `data-reading-comfort` 속성 주입:
- `data-app-layout="vertical"` (모바일 기본, 하단 dock)
- `data-app-layout="horizontal"` (데스크탑, 상단 nav)
- `data-reading-comfort="standard" | "large"` (시니어 친화 글자 크기)

localStorage 저장. 사용자가 `/my/settings`의 `LayoutModeControl`로 토글.

### 반응형 검증 (60장 스크린샷)

| viewport | 라우트 | 가시성 |
|---|---|---|
| 360x740 (Galaxy 표준) | 10/10 | ✓ 모든 페이지 모바일 dock 정상 |
| 390x844 (iPhone 14) | 10/10 | ✓ |
| 430x932 (iPhone 14 Pro Max) | 10/10 | ✓ |
| 768x1024 (iPad portrait) | 10/10 | ✓ |
| 1024x768 (iPad landscape) | 10/10 | ✓ horizontal 모드 진입 |
| 1440x1100 (large desktop) | 10/10 | ✓ |

---

## 5. 결제 CTA 시각 일관성 — ⚠️ P2

스크린샷 비교로 식별한 가격 표기 형식 9가지:

| 컴포넌트 | 표기 |
|---|---|
| `detail-unlock.tsx` | "550원 풀이" |
| `premium-lock-card.tsx` | "550원 또는 N코인" / "550원 바로 열기" |
| `today-premium-panel.tsx` | "550원 풀이" |
| `saju/[slug]/page.tsx` | "오늘 자세히 보기 · 550원" (중간점) |
| `pricing/page.tsx` | "550원/990원 소액 풀이" (slash) |
| `gangi-market.ts` | "550원~", "990원~" (틸드) |
| `gangi-ui.tsx` | "990원~" |
| `compatibility-section.tsx` | "990원 이상" |
| `membership/checkout` | "550원", "990원" (단순) |

→ 사용자 가격 인지 일관성 저하. `formatPriceLabel(pkg, style)` 헬퍼 도입 권고.

---

## 6. CTA 위치 & 모바일 dock 충돌 — ⚠️ P2

- `home @ 360x740` (Lighthouse `target-size` 위반): 일부 터치 타겟 < 44pt
- `saju-new @ 360x740`: 입력 stepper next 버튼이 하단 dock와 매우 근접 (44pt 검증 필요)

권고: 모든 CTA 버튼의 최소 터치 영역 `min-height: 44px; min-width: 44px`. dock과 페이지 본문 사이 `padding-bottom: env(safe-area-inset-bottom) + 88px`.

---

## 7. i18n 부재 — 🟢 P3

- `lang="ko"` 고정, i18n 라이브러리 미설치
- 모든 텍스트 한국어 하드코딩
- 현재 한국 한정 운영 시 우선순위 낮음. 다국어 확장 계획 시 작업 필요.

---

## 8. 우선순위 분류

- **P0**: 0
- **P1**: 1 (color-contrast — `06-accessibility-audit.md`와 중복)
- **P2**: 3 (가격 표기 9가지 / target-size / 핑크 외 컬러 토큰 컨트라스트)
- **P3**: 1 (i18n)
