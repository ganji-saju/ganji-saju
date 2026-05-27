# Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 간지사주 서비스를 유료 상용화 가능한 수준으로 끌어올린다. 디자인 변경 없이 상용화 리스크 제거 + 결제 가능한 완성도/신뢰도 확보.

**Architecture:** Phase 별 1~3 PR 로 분할. 각 PR 은 typecheck + 기존 strict audit + CI 통과 + 사용자 머지 승인 후 다음 Phase 진행. P0 우선, P1 후속, P2 분기 단위.

**Tech Stack:** Next.js 16 App Router (proxy 컨벤션) / React 19 / Supabase (RLS + migrations) / Toss Payments SDK / Vercel (preview+production) / Tailwind v4 / Playwright + Vitest.

**합의된 기준 (2026-05-17 확정):**
- Canonical: `https://ganjisaju.kr` (영문 ASCII)
- 브랜드: `간지사주`
- 시간: Asia/Seoul KST
- 폰트: Noto Sans KR
- 법무성 정보: 임의 생성 금지 (env + production 빌드 가드)

**의존 문서:**
- [audit](../../audit/production-hardening-audit.md) (P0/P1/P2 우선순위)
- [route-status-map](../../audit/route-status-map.md)
- [legal-required-fields](../../legal-required-fields.md) (운영자 입력)
- [policy-versioning](../../policies/policy-versioning.md) (Phase 5 설계)
- [product-catalog](../../payments/product-catalog.md) (결제 audit)
- [seo-content-plan](../../seo/seo-content-plan.md) (Phase 10)
- [production-readiness-checklist](../../qa/production-readiness-checklist.md) (✅ 갱신 대상)

---

## Phase 로드맵

| Phase | 주제 | PR 수 | 의존 | 운영자 입력 필요 |
|---|---|---|---|---|
| **1** | Audit + plan (본 문서) | 1 | — | — |
| **2** | 도메인 canonical 반전 + 브랜드 통일 | 1 | Vercel 대시보드 alias 확인 | Vercel 대시보드 권한 |
| **3** | KST 유틸 통합 + UTC drift fix | 1 | — | — |
| **4** | 가짜 평점 제거 (긴급) | 1 (소) | — | AI 페르소나 표기 가이드 |
| **5** | 법무 페이지 + 정책 버저닝 + 푸터 env 화 + 빌드 가드 | 3 (5-A/B/C) | 운영자 env 입력 | 사업자/CPO/정책 시행일 등 |
| **6** | 결제 하드닝 (Toss webhook + UUID + idempotency + 환불 회수) | 2 (6-A/B) | Phase 5 정책 페이지 | 환불 기준 수치 |
| **7** | 상담 예약 취소/노쇼 정책 + UI/API | 1 | — | 노쇼 정책 문구 |
| **8** | 코인 유효기간 정책-구현 정합 | 1 | — | "1년 유효" 유지/삭제 결정 |
| **9** | CI 보강 + eslint | 1 | Phase 5 env 가드 | — |
| **10** | SEO 확장 (slug og + sitemap + 꿈해몽) | 2~3 (10-A/B/C) | Phase 2 canonical | 꿈해몽 데이터 큐레이션 |

각 Phase 시작 시 별도 plan 파일 (`docs/superpowers/plans/2026-05-17-production-hardening/phase-N-주제.md`) 을 작성하고, 그 안에 bite-sized 작업을 정의한다. 본 문서는 master overview.

---

## Phase 2 — 도메인 Canonical 반전 + 브랜드 통일

### 목표
`xn--s39at50bo6fmwa.kr` (간지사주.kr punycode) → `https://ganjisaju.kr` 로 canonical 반전. `간지사주` → `간지사주` 브랜드명 통일.

### 영향 파일
- Create: `docs/superpowers/plans/2026-05-17-production-hardening/phase-2-domain.md`
- Modify: `src/lib/site.ts` (CANONICAL_SITE_URL, SITE_NAME, LEGACY_SITE_HOSTS 반전)
- Modify: `src/proxy.ts` (canonical 호스트 변경, preview 가드 완화)
- Modify: `src/app/layout.tsx` (title.template `간지사주` → `간지사주`)
- Modify: `src/app/sitemap.ts` / `src/app/robots.ts` (canonical 정합)
- Modify: 본문에서 "간지사주" 표기 검토 (`SITE_NAME` import 외에 잔존 하드코딩 grep)
- Modify: `.env.example` (NEXT_PUBLIC_SIT E_URL 기본값 갱신)
- Test: `src/lib/site.test.ts` (신규) — canonical / legacy 판정 단위 테스트
- 운영자 작업: Vercel 대시보드에서 `ganjisaju.kr`, `www.ganjisaju.kr`, `간지사주.kr` (xn--) 모두 production alias 등록 확인

### 핵심 변경 안 (요약 — 세부는 phase-2 plan 에서)
```ts
// src/lib/site.ts
export const SITE_NAME = '간지사주';
export const CANONICAL_SITE_URL = 'https://ganjisaju.kr';

const LEGACY_SITE_HOSTS = new Set([
  'ganji-saju.vercel.app',
  'ganji-saju-ganji-sajus-projects.vercel.app',
  'ganji-saju-ganji-saju.vercel.app',  // 오타 수정
  'xn--s39at50bo6fmwa.kr',              // 간지사주.kr punycode 도 alias 로 301
  'www.xn--s39at50bo6fmwa.kr',
  'www.ganjisaju.kr',                    // www → non-www 통일
]);
```

### 검증
- `npm test` + `npm run test:spec` pass
- Vercel preview 에서 `www.ganjisaju.kr`, `간지사주.kr` 진입 시 `ganjisaju.kr` 로 301 확인
- onboarding 무한 노출 사라지는지 production 배포 후 확인

### 위험 / 롤백
- Vercel alias 가 production 으로 묶여 있지 않으면 redirect loop 가능 — 운영자가 Vercel 대시보드 alias 먼저 확인 후 PR 머지
- 롤백: 1-commit revert (canonical 만 변경, DB 영향 없음)

---

## Phase 3 — KST 유틸 통합 + UTC drift Fix

### 목표
공통 KST 유틸 `src/shared/utils/kst.ts` 신설. 기존 4종 (getKoreaAccessDay / getKoreaDateKey / getSeoulDateKey / toKstDateKey) 을 deprecate. P0 UTC drift 버그 2건 fix.

### 영향 파일
- Create: `docs/superpowers/plans/2026-05-17-production-hardening/phase-3-kst.md`
- Create: `src/shared/utils/kst.ts` 신설
  - `getKstNow(): Date`
  - `getKstDateKey(date?: Date): string` // YYYY-MM-DD
  - `formatKoreanDate(date: Date, opts?): string`
  - `getDailyVersion(): string` // KST dateKey, 캐시 키 용도
- Modify: `src/app/zodiac/[slug]/page.tsx:69` raw `new Date()` → `getKstDateKey()`
- Modify: `src/lib/free-content-pages.ts:53` raw `new Date()` → `getKstDateKey()`
- Modify: `src/lib/credits/detail-report-access.ts`, `src/lib/tarot-api.ts`, `src/server/home/home-banners.ts`, `src/lib/star-sign/daily-fortune.ts` 기존 유틸 → `src/shared/utils/kst.ts` re-export (호환성 유지) 후 단계적 제거
- Test: `src/shared/utils/kst.test.ts` (Asia/Seoul 경계 케이스: UTC 14:59 / 15:00 = KST 23:59 / 00:00)
- Modify: daily 페이지 (today-fortune / star-sign / zodiac / tarot) 의 cache key 에 KST dateKey 반영

### 검증
- 기존 KST 관련 테스트 모두 pass
- 새 유닛 테스트: UTC 14:59:59 = KST 23:59:59 / UTC 15:00:00 = KST 00:00:00 다음 날
- zodiac 띠운세 점수가 UTC 새벽에도 KST 기준으로 정확한지 확인

### 위험 / 롤백
- 기존 4종 유틸 제거 X (re-export 만) → 점진 마이그레이션. 롤백 안전

---

## Phase 4 — 가짜 평점 제거 + 미완성 UI 정리 (긴급)

### PR 분해
- **4-A**: 가짜 평점 제거 (표시광고법 즉시 대응)
- **4-B**: 사용자 직접 노출 "준비 중" UI 정리 ([`incomplete-ui-inventory.md`](../../audit/incomplete-ui-inventory.md) §1)

### 4-A 영향 파일
- Modify: `src/app/dialogue/appointment/page.tsx:29` — `meta: '경력 18년 · ★ 4.9 (312)'` 제거
- Modify: 동일 라인의 DEFAULT_TEACHER metadata 를 "AI 페르소나" 안내 카피로 대체
- Modify: `src/content/moonlight.ts` `DALBIT_TEACHERS` 12종 — 사용자에게 AI 임을 명시할 카피 추가 필요한지 검토
- 운영자 입력: AI 페르소나 표기 가이드 ([`legal-required-fields.md`](../../legal-required-fields.md) §1.2)

### 4-B 영향 파일 (선택 — 별도 PR 가능)
- Modify: `src/app/membership/page.tsx:48,56,64` — 3개 "준비 중" 카드 hidden 또는 가격 확정 후 카드 활성
- Modify: `src/app/lock-screen/page.tsx` — `notFound()` 처리 또는 라우트 자체 제거
- Modify: `src/app/search/page.tsx` + 헤더 진입점 — 검색 기능 hidden (메인 헤더에서 검색 아이콘 제거 또는 코밍순 안내)
- Modify: `src/components/gangi/gangi-ui.tsx` — `DALBIT_TEACHERS` 의 "준비 중" 가격 항목 필터링 강화 (`gangi-market.tsx:374` 의 `isComingSoon` 활용)
- Modify: `src/features/notifications/notification-center-page.tsx:879~904` — 4건 "준비 중" 알림 옵션 hidden 또는 카피 통일
- Modify: `src/app/help/page.tsx:54` — "✦ 준비 중" 1:1 문의 배지 처리

### 위험
- 사용자가 평점/경력 보고 결제하던 흐름이 있다면 일시적 전환율 하락 가능. 그러나 법적 리스크가 압도
- 4-B 카드 hidden 시 카탈로그 노출 감소 — 정확한 가격 확정이 우선이면 4-B 머지 시점 조정 가능

### Phase 5 와 합칠 수 있으나, 법적 리스크 = 즉시 별도 PR 권장

---

## Phase 5 — 법무 페이지 + 정책 버저닝 + 사업자정보 env 화

### 목표
사업자 정보 env 화 + production 빌드 가드 + 정책 버저닝 인프라 + `/refund-policy` 신설 + `TermsConsentModal` 실연결.

### PR 분해
- **5-A**: 사업자 정보 env 화 + `src/lib/business-info.ts` + production 빌드 가드 (`src/lib/env-guard.ts`)
- **5-B**: 정책 버저닝 DB 마이그레이션 + `policy_versions` seed v1.0.0 + `getCurrentPolicyVersion` 유틸 + `/terms` `/privacy` 헤더 (개정일+버전+이전이력 링크)
- **5-C**: `/refund-policy` 신설 + 개인정보처리방침 법정 필수항목 채움 + `TermsConsentModal` 회원가입/saju-intake 실연결 + 필수/선택 분리

### 의존
- 운영자가 [`legal-required-fields.md`](../../legal-required-fields.md) §3 env 키 입력 완료
- 운영자가 환불 기준 수치 / 정책 시행일 확정

### 영향 파일 (5-A 예시)
- Create: `src/lib/business-info.ts` — env 읽고 typed 객체 export
- Create: `src/lib/env-guard.ts` — production 빌드 시 누락 throw
- Modify: `src/components/site-footer.tsx` — 하드코딩 → `business-info` import
- Modify: `src/app/help/page.tsx` 회사정보 중복 제거
- Modify: `.env.example` — 신설 env 키 (BUSINESS_*, CPO_*, HOSTING_PROVIDERS, PAYMENT_PROVIDERS, CS_OPERATING_HOURS, POLICY_*_VERSION/EFFECTIVE_DATE)
- Modify: `next.config.ts` 또는 `src/lib/env-guard.ts` 가 production build 시 import 되어 throw
- Test: `src/lib/business-info.test.ts` + `env-guard.test.ts`

### 검증
- production 환경변수 빈 값 → build throw
- staging/dev = placeholder 허용 (warn 만)
- 푸터에 통신판매업 신고번호 + CPO 노출 확인

---

## Phase 6 — 결제 하드닝

### 목표
Toss webhook 신설 + orderId UUID + addCredits idempotency + lifetime-report entitlement 회수 함수 + admin 환불 처리.

### PR 분해
- **6-A**: orderId UUID + addCredits paymentKey idempotency + Toss webhook 라우트 + migration (`payment_idempotency` 테이블)
- **6-B**: `revokeProductEntitlement` 함수 + admin 환불 UI + Toss `/v1/payments/{paymentKey}/cancel` 연동 + `refund_requests` 마이그레이션

### 영향 파일 (6-A)
- Modify: `src/app/credits/page.tsx`, `src/components/membership/toss-membership-checkout.tsx` — orderId = `crypto.randomUUID()`
- Modify: `src/lib/credits/balance.ts` (또는 addCredits 정의 파일) — paymentKey 매개변수 + DB UNIQUE 검증
- Create: `supabase/migrations/0XX_payment_idempotency.sql` — `credit_grants (payment_key text unique, ...)`
- Create: `src/app/api/payments/webhook/toss/route.ts` — Toss webhook 처리 + idempotency
- Test: `src/lib/credits/balance.test.ts` 보강 + webhook route unit test

### 검증
- `audit:payment-idempotency:strict` pass
- `audit:ai-chat-idempotency:strict` pass
- `payment-duplicate-audit.spec.ts` vitest pass (Phase 9 에서 CI 통합)

---

## Phase 7 — 상담 예약 취소/노쇼

### 영향 파일
- Modify: `src/app/api/appointments/route.ts` — PATCH (취소) 추가
- Create: `src/app/dialogue/appointment/[id]/cancel/page.tsx` (또는 my/appointments 에서 처리)
- Create: `/policies/no-show` 정책 페이지 (운영자 입력 후)
- Modify: 예약 완료 toast 에 "취소 정책 보기" 링크 추가
- Test: `src/app/api/appointments/route.test.ts` (신규)

---

## Phase 8 — 코인 유효기간 정합

### 두 옵션 중 선택 (운영자 결정)
- **A) 정책 유지**: `user_credits.expires_at` 컬럼 + 만료 cron 추가
- **B) 구현 유지**: FAQ "1년 유효" 문구 삭제 + 새 카피

### 권장: A (수익화 측면), 단 기존 사용자 = 영구 유효 grandfather 처리 필수

---

## Phase 9 — CI 보강 + eslint

### 영향 파일
- Modify: `.github/workflows/ci.yml` — `npm run test:spec` 추가 + `audit:payment-idempotency:strict` + `audit:ai-chat-idempotency:strict`
- Create: `eslint.config.js` (Next.js 16 flat config)
- Modify: `package.json` — `lint` script 추가
- Modify: `next.config.ts` — eslint 활성 (production build 시 fail)

### 검증
- 모든 strict audit + vitest + e2e CI pass
- eslint 신규 위반 0건 (기존 위반은 ignore-existing 또는 점진 개선)

---

## Phase 10 — SEO 확장

상세는 [`../seo/seo-content-plan.md`](../../seo/seo-content-plan.md) 참고.

### PR 분해
- **10-A**: 32 slug 페이지 openGraph/twitter/keywords 보강
- **10-B**: sitemap lastmod 동적화 + canonical 정합 (Phase 2 의존)
- **10-C**: 꿈해몽 사전 100건 1차 (자체 작성)

---

## 각 Phase 공통 워크플로우

```
1. main → git switch -c chore/phase-N-주제
2. phase-N plan 파일 작성 (bite-sized tasks)
3. TDD: 테스트 작성 → 실패 확인 → 구현 → 통과 → commit
4. 본 plan 의 해당 Phase 체크 [x] 갱신
5. production-readiness-checklist.md 해당 항목 [x] 갱신
6. typecheck → all unit/spec tests → strict audits → build 확인
7. push + PR + CI watch
8. 사용자 머지 승인 → merge + 브랜치 삭제
9. 다음 Phase 시작
```

각 Phase commit message 규칙: `chore(phase-N): <주제> — <변경 핵심>`

---

## Self-Review (Phase 1 plan 자체 점검)

**Spec coverage**:
- [x] 1. 저장소 분석 → audit Phase 1 완료
- [x] 2. 법무성 정보 임의 생성 금지 → Phase 5 env 가드 + legal-required-fields.md
- [x] 3. 대표 도메인 `https://ganjisaju.kr` 통일 → Phase 2
- [x] 4. KST 기준 + 공통 유틸 → Phase 3
- [x] 5. Noto Sans KR 기준 유지 → P1 (Phase 10 SEO 와 같이 처리 가능)
- [x] 7 최종 산출물 docs — Phase 1 에서 7개 모두 작성

**Placeholder scan**: 본 plan 자체에는 TBD/TODO 없음. Phase-N plan 작성 시 동일 원칙 적용.

**Type consistency**: `getKstDateKey() / getKstNow() / formatKoreanDate() / getDailyVersion()` 4종 시그니처를 Phase 3 plan 에서 일관 유지.

---

## Execution Handoff (Phase 1 머지 후)

Phase 1 PR 머지 후 사용자에게 다음 안 제안:

**Option A (권장)**: Phase 4 (가짜 평점 제거) 먼저 — 법적 리스크 최소화 + 작업 크기 작음. 그 후 Phase 2 (도메인) + Phase 3 (KST) 병렬 가능

**Option B**: Phase 2 (도메인) 부터 — 사용자 영향 가장 큼 + 운영자 Vercel 대시보드 확인 동시 진행

**Option C**: Phase 5 (법무) 부터 — 운영자 env 입력값이 준비된 상태라면 가장 큰 진척

사용자 선택에 따라 다음 Phase plan (bite-sized) 작성 후 진행.
