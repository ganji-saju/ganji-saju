# 05. Typography · Card · Layout Audit

> 2026-05-13 · 타이포그래피·카드 컴포넌트·페이지 레이아웃 통합 감사
> 스크린샷: `audit-reports/screenshots/*.png` 60장

---

## 1. 타이포그래피 시스템

### 폰트 토큰 (`src/app/styles/tokens.css`)
```css
--font-body: var(--font-dalbit-sans), "Noto Sans KR", sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", monospace;
```

### Google Fonts 로드 (`src/app/layout.tsx`)
- **Noto Sans KR** — weight: 400, 500, 600, 700, 800, 900 (총 6종)
- `display: 'swap'`, `preload: false`
- CSS variable: `--font-dalbit-sans`

### Type weight 의미 토큰
```css
--app-type-title: 700;
--app-type-emphasis: 600;
--app-type-body: 450;  /* Variable Font weight */
```

### ⚠️ 성능 영향
- 6종 weight × 한국어 폰트 (글리프 수십만) = 무거운 download
- Lighthouse `unused-css-rules`와 `unused-javascript` 0.30-0.60s 절감 권고와 직결
- 권고: 실제 사용 weight (대개 400/600/700)로 축소 → 폰트 download 40-50% 감소 예상

---

## 2. 카드 컴포넌트 일관성

### shadcn `Card` 패밀리 (`src/components/ui/card.tsx`)
- Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter

### 도메인 카드 (스크린샷 기준)
| 컴포넌트 | 용도 |
|---|---|
| `FeatureCard` (layout/feature-card) | 가격·기능·콘텐츠 카드 (기본형) |
| `SectionSurface` (layout/section-surface) | 카드 그룹 컨테이너 |
| `SectionHeader` (layout/section-header) | 카드 그룹 헤더 (eyebrow + title + description) |
| `ProductGrid` (layout/product-grid) | 카드 grid (columns 1/2/3 자동 조정) |
| `PageHero` (shared/layout/app-shell) | 페이지 상단 hero (badges + title) |
| `MoonlightHeroVideo` (home) | 홈 hero 비디오 카드 |
| `ProductReportCard` (home) | 상품 리포트 카드 |
| `PremiumLockCard` (today-fortune) | 결제 잠금 카드 |
| `DetailUnlock` (detail-unlock.tsx) | 분야별 unlock 카드 |
| `GangiTodayDetailLockCard` (saju/[slug]/today-detail) | inline 잠금 카드 |

### 일관성 관찰 (스크린샷 비교)

✅ 통일된 부분:
- 카드 border-radius: `--radius` (0.625rem) 또는 `--radius-2xl` (1.25rem)
- 카드 shadow: `--app-shadow: 0 18px 52px rgba(216, 27, 114, 0.12)` (핑크 톤)
- 카드 grid columns transition (1 → 2 → 3)

⚠️ 불일치 영역:
- 가격 표시 형식 9가지 (`04-uiux-design-system-audit.md` 5절)
- 잠금 카드 디자인 — `PremiumLockCard` vs `GangiTodayDetailLockCard` vs `DetailUnlock` (각각 다른 visual)

권고: 잠금 카드 단일 컴포넌트 `<PaywallCard pkg={pkg} reason="entitlement">` 도입.

---

## 3. 페이지 레이아웃 패턴

### AppShell + AppPage + PageHero 패턴
거의 모든 페이지가:
```tsx
<AppShell header={<SiteHeader />} className="gangi-subpage-shell">
  <AppPage className="gangi-subpage space-y-6">
    <PageHero badges={[...]} title="..." />
    <section>...</section>
  </AppPage>
</AppShell>
```

### 네비게이션 (`src/lib/site-navigation.ts`)
- `PRIMARY_NAV_ITEMS` (글로벌 헤더)
- `MOBILE_QUICK_LINKS` (모바일 dock)

### 모바일 dock
- `data-app-layout="vertical"`일 때 활성
- z-index 추정 30-50 (충돌 가능성은 `04-uiux-design-system-audit.md` 6절 참조)

---

## 4. 시각 위계 (스크린샷 기반)

### Home (`/`)
- PageHero (badges + tagline) → MoonlightHeroVideo → ProductReportCard 3개 → 도메인 카드 grid (12지신/타로/궁합)
- 비디오 hero가 LCP 후보 (mobile 3.69s) — preload 최적화 가능

### Pricing (`/pricing`)
- PageHero → 가격 카드 grid (코인팩 4 / 멤버십 2 / 소액상품 6 / 보관형 1)
- "550원/990원" metadata에 하드코딩 (P1)

### Saju New (`/saju/new`)
- PageHero → birth-info-stepper (4단계: consent → empathy → nickname → birth)
- 모바일 LCP 4.19s (예산 미달, P1)
- `is-crawlable` blocked (robots.txt, P1)

### Today-detail (잠금 vs Premium)
- Guest~Plus: lock card만 (41KB)
- Premium: 점수 보드 + 흐름 카드 + 분야 grid (60KB, +18KB)
- Phase 4 매트릭스에서 검증

---

## 5. 우선순위 분류

- **P0**: 0
- **P1**: 1 (Noto Sans KR weight 6종 → 축소 권고, perf 영향)
- **P2**: 2 (가격 표기 통일 / 잠금 카드 컴포넌트 통합)
- **P3**: 1 (i18n)
