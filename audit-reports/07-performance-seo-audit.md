# 07. Performance · SEO Audit

> 2026-05-13 · Lighthouse 13.3.0 (desktop + mobile) · 10개 라우트 메타 분석
> 원본 리포트: [`lighthouse/2026-05-13-*-{desktop,mobile}.report.html`](lighthouse/) · [`2026-05-13-seo-metadata-raw.txt`](2026-05-13-seo-metadata-raw.txt)

---

## 1. Performance 예산 vs 실측

### 목표
- LCP ≤ 2.5s · CLS ≤ 0.1 · INP ≤ 200ms · TBT ≤ 200ms · 모바일 perf ≥ 80

### 데스크탑 (5 routes)

| route | perf | a11y | best | seo | LCP | FCP | TBT | CLS | SI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home          | 89 | 91 | 100 | 100 | 1.13s | 0.53s | 0ms | 0.000 | 3.47s |
| pricing       | 99 | 96 | 100 | 100 | 0.82s | 0.62s | 0ms | 0.000 | 0.62s |
| saju-new      | 99 | 96 | 100 | **66** | 0.85s | 0.57s | 0ms | 0.007 | 0.63s |
| credits       | 100 | 96 | 100 | 100 | 0.76s | 0.48s | 0ms | 0.000 | 0.54s |
| today-fortune | 100 | 96 | 100 | 100 | 0.77s | 0.53s | 0ms | 0.000 | 0.65s |

→ 데스크탑 예산 전부 통과. home SI 3.47s만 약간 높음 (hero 비디오 영향).

### 모바일 (5 routes, simulated 4G + slow CPU)

| route | perf | a11y | best | seo | **LCP** | FCP | TBT | CLS | TTI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| home          | 87 | 91 | 100 | 100 | **3.69s** | 2.19s | 10ms | 0.000 | 3.70s |
| pricing       | 84 | 96 | 100 | 100 | **3.84s** | 2.64s | 10ms | 0.000 | 3.84s |
| saju-new      | 83 | 96 | 100 | **66** | **4.19s** | 2.16s | 90ms | 0.011 | 4.19s |
| credits       | 85 | 96 | 100 | 100 | **3.86s** | 2.45s | 10ms | 0.000 | 3.86s |
| today-fortune | 83 | 96 | 100 | 100 | **4.01s** | 2.46s | 20ms | 0.000 | 4.04s |

**🟠 P1**: 모바일 LCP 평균 **3.92s** (목표 +1.42s 초과). Google CWV "Needs Improvement" 영역. 5/5 페이지 미달.

### Lighthouse 공통 개선 기회
- `unused-javascript`: 0.30-0.60s 절감 가능
- `unused-css-rules`: 0.15-0.30s 절감
- (home) `render-blocking-insight`, `legacy-javascript-insight`

---

## 2. SEO 메타 매트릭스 (10 routes)

| 라우트 | title (길이) | meta desc (길이) | canonical | og:image | og 페이지별 | JSON-LD |
|---|---|---|---|---|---|---|
| `/` | 달빛인생 (4) | 오늘의 운세… (55) | **❌** | ❌ | ❌ | 0 |
| `/free` | 무료운세 \| 달빛인생 (11) | 오늘운세… (47) | ✅ | ❌ | ❌ | 0 |
| `/pricing` | 가격 한눈보기 \| 달빛인생 (14) | 달빛인생의… 550원/990원 (53) | ✅ | ❌ | ❌ | 0 |
| `/saju/new` | 사주 시작하기 \| 달빛인생 (14) | 지금 궁금한… (65) | ✅ | ❌ | ❌ | 0 |
| `/credits` | 코인 센터 \| 달빛인생 (12) | 분야별 깊이보기… (41) | ✅ | ❌ | ❌ | 0 |
| `/dialogue` | 대화 \| 달빛인생 (9) | 달빛인생 대화방… (27) | ✅ | ❌ | ❌ | 0 |
| `/tarot/daily` | 타로 \| 달빛인생 (9) | 질문을 고르고… (39) | ✅ | ❌ | ❌ | 0 |
| `/zodiac` | 내 띠 운세 \| 달빛인생 (13) | 생년월일과 입춘… (45) | ✅ | ❌ | ❌ | 0 |
| `/today-fortune` | 오늘의 운세 \| 달빛인생 (13) | 오늘 연락, 돈… (60) | ✅ | ❌ | ❌ | 0 |
| `/membership` | 멤버십 \| 달빛인생 (10) | 달빛인생의 소액 풀이… (43) | ✅ | ❌ | ❌ | 0 |

---

## 3. 핵심 SEO 발견

### 🟠 P1-3 `/saju/new` 색인 차단 ⚠️
- Lighthouse SEO **66**, `is-crawlable: Page is blocked from indexing`
- 원인: `robots.txt`의 `Disallow: /saju/` (슬래시 포함) → 결제 전환의 핵심 입구가 검색 노출 0
- 권고: `Allow: /saju/new` 명시, 또는 `Disallow: /saju/$`로 결과 페이지만 차단

### 🟠 P1-4 OG 메타 페이지별 미적용
- 모든 라우트에서 `og:title = 달빛인생`, `og:description = 오늘의 운세와 타로부터…` 동일
- SNS 공유 시 페이지 차별화 실패
- 권고: 라우트별 `metadata.openGraph` 명시

### 🟠 P1-4b og:image 전 페이지 누락
- 카카오톡/페이스북 공유 카드에 이미지 미표시
- 권고: `public/og-default.jpg` (1200×630) 추가 + `metadata.openGraph.images`

### 🟠 P1-5 홈 `/` canonical 누락
- 다른 9개 라우트는 정상 — 홈만 누락
- 권고: `app/page.tsx`에 `metadata: { alternates: { canonical: '/' } }`

### 🟡 P2-6 JSON-LD 구조화 데이터 0건
- 권고: `Organization`, `WebSite`, `BreadcrumbList`, `Product` schema 추가
- `Product` schema는 결제 카탈로그와 연동 → catalog SSOT 활용 가능

### 🟡 P2-7 홈 title "달빛인생" 4글자
- 키워드 부족
- 권고: "달빛인생 — 무료 사주·타로·오늘운세·궁합" 등 50자 내외

### 🟡 P2-5 canonical 호스트 www 불일치
- `src/lib/site.ts:5` `CANONICAL_SITE_URL = 'https://xn--s39at50bo6fmwa.kr'` (apex)
- 실제 페이지 redirect: `www.xn--s39at50bo6fmwa.kr`
- robots.txt `Host:` 도 apex
- → 한쪽으로 통일 필요

---

## 4. robots.txt / sitemap.xml — ✅ 대체로 OK

`https://www.xn--s39at50bo6fmwa.kr/robots.txt`:
```
User-Agent: *
Allow: /, /credits, /today-fortune, /tarot/daily, /zodiac/, /star-sign/, /dream-interpretation/
Disallow: /api/, /login, /credits/success, /saju/, /my
Host: https://xn--s39at50bo6fmwa.kr
Sitemap: https://xn--s39at50bo6fmwa.kr/sitemap.xml
```
- 보호 라우트(`/api/`, `/my`, `/login`) 정상 차단 ✓
- ⚠️ `/saju/` 광범위 차단 → P1-3 (`/saju/new` 색인 차단)
- ⚠️ Host/Sitemap이 apex — 실제 canonical과 불일치 → P2-5

`/sitemap.xml` 존재 + 핵심 라우트 포함 ✓

---

## 5. 권고 fix

### P1 — 모바일 LCP 최적화
1. **번들 split**: `/saju/new`의 unused JS 0.6s 절감 — birth-input flow 외 컴포넌트 lazy
2. **이미지 priority**: home `moonlight-teacher-hero` poster `priority` + responsive `sizes`
3. **폰트 weight 축소**: Noto Sans KR 6종 → 3-4종 (`05-typography-card-layout-audit.md` 1절)
4. **CSS code split**: 라우트별 chunk 분리

### P1 — SEO
1. robots.txt 정밀화
2. 페이지별 OG 명시
3. og:image 추가
4. 홈 canonical 추가

### P2 — JSON-LD
- `app/layout.tsx`에 `WebSite` + `Organization` 1회
- 페이지별 `BreadcrumbList`
- pricing에 `Product` schema

---

## 6. 우선순위 분류

- **P0**: 0
- **P1**: 5 (LCP 5페이지 / 색인 차단 / OG 페이지별 / og:image / 홈 canonical)
- **P2**: 3 (JSON-LD / 홈 title / canonical 호스트 통일)
