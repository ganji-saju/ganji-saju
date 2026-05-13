# 00. Executive Summary — 간지사주/달빛인생 유료버전 오픈 전 전수조사

> **Audit date**: 2026-05-13 · **Target**: `/Users/kionya/ganji-saju` · `https://www.xn--s39at50bo6fmwa.kr`
> **Mode**: read-only · test-mode · 0 source modification
> **Audit scope**: 정적 코드 + 라이브 도메인 + Playwright E2E (5×10 매트릭스) + Lighthouse (10) + axe-core (10) + Toss sandbox 결제 트레이스 + P0 실증

---

## 🚦 GO / NO-GO 판정

> **NO-GO** — 결제 confirm 후 `addCredits()`가 paymentKey 멱등 체크 없이 동작해 **코인 중복 적립 가능**.
> Phase 5에서 **재현 검증 완료** (`balance 3 → 6 → 9`, `credit_transactions` row 2개 생성).

### 정량 요약

| 우선순위 | 건수 | 의미 |
|---|---:|---|
| 🔴 **P0** | 2 | 유료 오픈 차단 |
| 🟠 **P1** | 7 | 오픈 48시간 내 수정 권고 |
| 🟡 **P2** | 9 | 2주 내 개선 |
| 🟢 **P3** | 4 | 백로그 / discardable |
| ✅ 통과 | 12+ | 단위 검증 완료 |

---

## 🔴 P0 — 당장 조치 (2건)

### 1. `addCredits` 멱등성 부재 → 코인 중복 적립 가능 (실증 완료)
- **위치**: [`supabase/migrations/002_credit_functions.sql:52-82`](../supabase/migrations/002_credit_functions.sql), 호출자 [`src/lib/credits/deduct.ts:143`](../src/lib/credits/deduct.ts), 결제 confirm 흐름 [`src/app/api/payments/confirm/route.ts:61`](../src/app/api/payments/confirm/route.ts)
- **재현**: 같은 paymentKey로 `add_credits` 2회 호출 → balance 3→6→9 (delta +6)
- **영향 상품**: `credit_1`/`credit_3`/`credit_7`/`subscription_30` (코인이 핵심 deliverable인 4종)
- **수정안 (택1)**:
  - SQL 함수 안에서 `metadata->>'paymentKey'` UNIQUE 사전 조회 후 no-op
  - 호출자 `addCredits()`에서 paymentKey lookup → 존재 시 early-return
- **검증**: `node /tmp/ganji-audit-2026-05-13/payment-trace.mjs` 재실행 → 2차 호출이 no-op 되면 GO

### 2. 결제 confirm 트랜잭션 원자성 부재 → 코인-권한 불일치 위험
- **위치**: [`src/app/api/payments/confirm/route.ts:60-110`](../src/app/api/payments/confirm/route.ts)
- **위험**: `addCredits` → `activateSubscription` → `grantEntitlement` → `upsertSnapshot` 5개 호출이 별개 트랜잭션. 중간 실패 시 잔액↔권한 불일치.
- **수정안**: 단일 PL/pgSQL RPC `finalize_payment(...)`로 통합 또는 outbox + retry 패턴

> 두 P0 모두 결제 confirm 후처리의 같은 코드 블록에 위치하므로 **하나의 PR로 함께 fix 권고**.

---

## 🟠 P1 — 48시간 내 권고 (7건)

| # | 항목 | 근거 |
|---|---|---|
| P1-1 | 보안 응답 헤더 5종 누락 (CSP·X-Frame-Options·Referrer-Policy·X-Content-Type-Options·Permissions-Policy) | curl 실측, HSTS만 적용됨 |
| P1-2 | 결제 가격 UI 13곳 하드코딩 (catalog SSOT 위반) | grep 결과, `src/content/moonlight.ts` 외 12곳 |
| P1-3 | `/saju/new`가 robots.txt `Disallow: /saju/`로 색인 차단 | Lighthouse SEO 66, `is-crawlable: blocked` |
| P1-4 | 모든 페이지 OG 메타 동일 + og:image 누락 | curl 메타 fetch 10개 라우트 모두 |
| P1-5 | 홈(`/`)의 canonical link 누락 | 다른 9개는 정상, 홈만 누락 |
| P1-6 | axe-core color-contrast serious 위반 — 10페이지 누적 ~111개 노드 | `--app-pink #ff4f9a` 본문 텍스트 대비 2.95:1 (AA 4.5:1 미달) |
| P1-7 | 모바일 LCP 5/5 라우트 예산(2.5s) 초과 — 평균 3.92s | Lighthouse mobile 측정 |

---

## 🟡 P2 — 2주 내 개선 (9건)

| # | 항목 | 비고 |
|---|---|---|
| P2-1 | `/dialogue/[expert]` 페이지 레벨 게이트 부재 | API는 게이트, 페이지는 무인증 노출 |
| P2-2 | `/my/settings` 무인증 노출 | 정적 콘텐츠만, 데이터 누설 X (네임스페이스 일관성 문제) |
| P2-3 | `/api/dialogue/safety` 익명 무제한 POST | rate-limit 부재 |
| P2-4 | 도메인 3-hop 리다이렉트 | `ganjisaju.kr → www → punycode → www-punycode` |
| P2-5 | canonical 호스트 www 불일치 | `src/lib/site.ts:5` apex vs 실제 www |
| P2-6 | JSON-LD 구조화 데이터 0건 | rich snippet 미적용 |
| P2-7 | 홈 title "달빛인생" 4글자 | 키워드 부족 |
| P2-8 | 가격 표기 9가지 불일치 | `formatPriceLabel` 헬퍼 도입 권고 |
| P2-9 | `saju-new` 모바일 TBT 90ms / `home` `target-size` 위반 | 입력 폼 hydration · 터치 타겟 < 44pt |

---

## 🟢 P3 — 백로그 / 버려도 됨 (4건)

| # | 항목 | 비고 |
|---|---|---|
| P3-1 | `src/proxy.ts:77-78`의 `/dashboard` 미들웨어 가드 dead code | 해당 라우트 미존재 — 삭제 권고 |
| P3-2 | 응답 헤더 `X-Powered-By: Next.js` 노출 | `next.config.ts`에 `poweredByHeader: false` |
| P3-3 | i18n 미적용 | 현재 한국 한정 운영 시 우선순위 낮음 |
| P3-4 | 한글 도메인 `간지사주.kr` macOS curl IDN 핸드셰이크 이슈 | 실제 브라우저 동작은 정상 (curl 도구 한계) — 버려도 됨 |

---

## ✅ 통과·정상 동작 항목

- TypeScript 타입체크 PASS · 빌드 PASS (134 페이지 정적 생성)
- 클라이언트 번들에 서버 secret 누설 **0건** (`.next/static/chunks` grep)
- 결제 confirm에서 catalog 가격 재조회 + amount 일치 검증 (가격 조작 차단)
- `grantTasteProductEntitlement` paymentKey 멱등 + DB UNIQUE 제약
- `requireAccount` 보호 라우트 (`/my/*`) 정상 307→`/login?next=...`
- Supabase RLS — 결제·과금 테이블 모두 SELECT-only (쓰기는 service-role)
- 데스크탑 Lighthouse perf 89-100, CLS 모든 라우트 < 0.012, TBT < 100ms
- axe-core critical = 0
- 5×10 페르소나 매트릭스 50칸 모두 기대 동작 (`02-paid-funnel-audit.md` 참조)
- open-redirect 차단 ✓ (`/login?next=https://attacker.example` → 외부로 안 튕김)
- 결제 sandbox 게이트 4종 모두 정확히 거부 (가짜 paymentKey / 금액 조작 / 비로그인 / 잘못된 packageId)
- HSTS 헤더 `max-age=63072000` (2년)
- 신규가입 보너스 트리거(`handle_new_user`)에서 +3 코인 자동 부여

---

## 📋 GO 조건

본 감사 통과해 유료 오픈하려면:

1. **P0-1, P0-2 fix + 단위 테스트** — 같은 paymentKey 2번 confirm 시 코인이 1회만 적립되는지 자동 회귀 테스트 추가
2. **P1-1, P1-3 fix** — 보안 헤더 추가, `/saju/new` 색인 허용
3. **(권고) P1-2, P1-6 fix** — catalog SSOT UI 동기화, color-contrast 토큰 교체

위 충족 시 본 리포트를 **GO**로 갱신 가능.

---

## 🗑 버려도 될 산출물 (legacy `2026-05-13-*.md`)

본 캐노니컬 시리즈(00–10 + 2 JSON)가 모든 내용을 흡수했으므로 `2026-05-13-` 접두어 파일들은 다음 시점에 삭제 또는 `_legacy/`로 이동 가능:

- `2026-05-13-MASTER-REPORT.md` → 00에 흡수
- `2026-05-13-route-inventory.json` → 01.csv + route-status-map.json에 흡수
- `2026-05-13-catalog-consistency.md` → 02에 흡수
- `2026-05-13-entitlement-matrix.{md,json}` → 02 + route-status-map.json에 흡수
- `2026-05-13-payment-flow-trace.{md,log}` → 02·03에 흡수
- `2026-05-13-security-surface.md` → 03·08에 흡수
- `2026-05-13-design-tokens-audit.md` → 04·05에 흡수
- `2026-05-13-a11y.{md,json}` → 06에 흡수 (json만 남기는 것 권고)
- `2026-05-13-perf-budget.md` → 07에 흡수
- `2026-05-13-seo-meta.md` + `2026-05-13-seo-metadata-raw.txt` → 07에 흡수 (raw만 남기는 것 권고)
- `2026-05-13-redirect-and-security-headers.md` + `2026-05-13-redirect-chain.txt` → 08에 흡수 (txt만 남기는 것 권고)
- `2026-05-13-typecheck.log`, `2026-05-13-build.log`, `2026-05-13-lighthouse-summary.log`, `2026-05-13-playwright-output.log` → 운영 로그, 보존 OK
- `2026-05-13-persona-matrix.log` → 보존 OK

남길 것 (참조 가치 있음): 모든 `*.log`/`*-raw.txt`/`-chain.txt`/`a11y.json` (원본 데이터)
폐기 권고: 모든 `2026-05-13-*.md` (00–10이 흡수)

---

## 📁 산출물 매핑 (이 시리즈)

- `00-executive-summary.md` — **본 문서** (요약 + GO/NO-GO + 액션 리스트)
- `01-route-inventory.csv` — 라우트 100+ × 인증/결제/상태 매트릭스 (CSV)
- `02-paid-funnel-audit.md` — 결제 카탈로그 + entitlement 매트릭스 + 결제 흐름 통합
- `03-auth-payment-credit-integration-audit.md` — 인증/결제/코인/RLS 통합 분석
- `04-uiux-design-system-audit.md` — UI/UX·디자인 시스템 토큰
- `05-typography-card-layout-audit.md` — 타이포그래피·카드·레이아웃
- `06-accessibility-audit.md` — axe-core + WCAG
- `07-performance-seo-audit.md` — Lighthouse + Core Web Vitals + SEO 메타
- `08-technical-risk-audit.md` — 보안 헤더 + secret 표면 + 빌드 헬스
- `09-launch-blockers.md` — P0 + P1만 (오너/ETA/수정안 포함)
- `10-fix-backlog.md` — P2 + P3 백로그
- `design-token-diff.json` — 색·폰트·spacing·radius 토큰 + WCAG 대비치
- `route-status-map.json` — route × persona × outcome 매트릭스
