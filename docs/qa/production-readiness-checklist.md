# Production Readiness Checklist — 배포 전 차단 조건

작성일: 2026-05-17 / Phase 1 = 초기 체크리스트. Phase 2~N 진행에 따라 ✅ 갱신.

> **사용 규칙**: 모든 P0 항목이 ✅ 되기 전엔 production 배포 금지. P1 은 부분 배포 허용 (해당 영역만 hidden / disabled). 본 체크리스트는 [`../audit/production-hardening-audit.md`](../audit/production-hardening-audit.md) §7 의 우선순위와 1:1 매칭.

---

## 🚨 P0 (상용화 차단 — 모두 ✅ 필수)

### 도메인 / 라우팅
- [ ] Canonical 도메인 = `https://ganjisaju.kr` 로 통일 (Phase 2)
- [ ] LEGACY 거부 목록에서 `ganjisaju.kr`, `www.ganjisaju.kr` 제외
- [ ] 한글 도메인 / punycode / www / Vercel preview 모두 canonical 로 301
- [ ] Vercel 대시보드에 `ganjisaju.kr` + `www.ganjisaju.kr` + `간지사주.kr` 모두 production alias 등록
- [ ] `/onboarding` www 비일관성 해소 (cookie 호스트 격리 → canonical 단일화로 자연 해소 확인)

### KST 시간 처리
- [ ] `src/app/zodiac/[slug]/page.tsx:69` raw `new Date()` → KST 유틸 치환 (Phase 3)
- [ ] `src/lib/free-content-pages.ts:53` raw `new Date()` → KST 유틸 치환 (Phase 3)
- [ ] 공통 유틸 `src/shared/utils/kst.ts` 도입 + 기존 4종 (getKoreaAccessDay/getKoreaDateKey/getSeoulDateKey/toKstDateKey) 통합
- [ ] daily 페이지 ISR cache key 에 KST dateKey 반영

### 표시광고 / 상담사
- [ ] `src/app/dialogue/appointment/page.tsx:29` 가짜 "경력 18년 · ★ 4.9 (312)" 제거 (Phase 4)
- [ ] AI 페르소나임을 사용자에게 명시 (DALBIT_TEACHERS 12종)

### 법무 — 사업자 정보
- [ ] 통신판매업 신고번호 표기 (env 입력 후 Phase 5)
- [ ] 개인정보보호책임자(CPO) 4개 필드 표기 (env 입력 후 Phase 5)
- [ ] 호스팅 사업자 표기 (Vercel, Supabase)
- [ ] 사업자 정보 env 화 + production 빌드 가드

### 법무 — 정책
- [ ] `/terms`, `/privacy` 개정일 + 버전 표기 (Phase 5)
- [ ] `/refund-policy` 페이지 신설 (Phase 5)
- [ ] 개인정보처리방침 법정 필수항목 (보유기간 / 제3자제공 / 수탁사명 / 안전성 조치) 채움
- [ ] `policy_versions` + `user_policy_consents` 마이그레이션 적용
- [ ] `TermsConsentModal` 회원가입 / saju-intake 에 실연결 + 필수/선택 분리

### 결제 / 환불
- [ ] lifetime-report 49,000원 entitlement 회수 함수 추가 (Phase 6)
- [ ] admin 환불 처리 UI + Toss cancel API 연동
- [ ] 코인 유효기간 정책 vs 구현 정합 (정책 유지 = DB+cron 추가, 구현 유지 = FAQ 수정) — Phase 8

### 상담 예약
- [ ] 사용자 취소 UI/API (`PATCH /api/appointments`) (Phase 7)
- [ ] 노쇼 정책 페이지 (Phase 7)

### CI / 빌드 / 환경변수
- [ ] vitest `*.spec.ts` CI 실행 (Phase 9 — `npm run test:spec` 추가)
- [ ] `audit:payment-idempotency:strict` CI 실행 (Phase 9)
- [ ] `audit:ai-chat-idempotency:strict` CI 실행 (Phase 9)
- [ ] env validator (`src/lib/env-guard.ts`) production 빌드 시 필수 secret 누락 차단 (Phase 5+9)
- [ ] migration 016 `lifetime-report` CHECK 제약 확인 + 누락 시 갱신 migration (Phase 6)

### 미완성 UI 정리 (Phase 4-B, [incomplete-ui-inventory.md](../audit/incomplete-ui-inventory.md))
- [ ] `/membership/page.tsx` 3개 "준비 중" 카드 → hidden 또는 가격 확정
- [ ] `/lock-screen` → `notFound()` 또는 라우트 제거
- [ ] `/search` → noindex + 헤더 검색 진입점 hidden (또는 검색 완성)
- [ ] `gangi-ui.tsx` 상담사 "준비 중" 카드 → hidden
- [ ] `/help` "1:1 문의 준비 중" 배지 → contact-form 정식화 또는 카피 통일

### 사용자 명세 라우트 매핑 (Phase 2 또는 10)
- [ ] `/coins` → `/credits` 301 alias 결정 + 적용
- [ ] `/horoscope` → `/star-sign` 301 alias 결정 + 적용
- [ ] `/dream-interpretation` 인덱스 페이지 신설 결정

---

## 🟡 P1 (배포 후 즉시 후속 — 1~2 주 내)

### 라우팅 / proxy
- [ ] proxy production-only 가드 완화 (preview 환경에서도 canonical 정규화)
- [ ] legacy host 오타 (`ganji-saju-ganji-saju-vercel.app`) 수정
- [ ] `/saju/` 전체 disallow 재검토 (정적 사주 컨텐츠 분리)

### KST 유틸 / 캐시
- [ ] `toKstDateKey` offset 방식 → Intl 방식으로 통일 (`src/shared/utils/kst.ts`)
- [ ] sitemap lastmod 동적화 (KST dateKey 기반)

### 결제 보강
- [x] orderId UUID 화 (`Date.now()` → 서버 `crypto.randomUUID()`)
  - 코드/DB: `/api/payments/prepare`가 `payment_orders` row와 `ord_${crypto.randomUUID()}` 형식 orderId를 만들고, `/credits`/멤버십 결제창은 prepare 응답 orderId만 사용.
- [x] Toss webhook 라우트 신설 (`/api/payments/webhook/toss`) + idempotency
  - 코드/DB: `payment_webhook_events.event_hash` dedupe + Toss 조회 검증 + 공통 fulfillment.
  - 운영 대기: Toss 개발자센터에 production URL 등록 필요.
- [x] `addCredits` paymentKey 기반 idempotency
  - DB: `044_credit_payment_idempotency.sql` prod 적용 완료. `processed_credit_payments.payment_key` UNIQUE로 중복 코인 적립 차단.
- [ ] 결제 prepare/confirm route unit test

### 인증 / 동의
- [ ] 만 14세 미만 처리 (생년월일 검증 + 보호자 동의 UI 또는 차단)
- [ ] 필수/선택 동의 분리 (현 implicit consent → 명시적 체크박스)
- [ ] 마케팅 수신 동의 사전 분리 (이메일/SMS/푸시 각각)
- [ ] 호스팅 사업자 처리위탁 고지 (국외이전 동의 포함)

### CS
- [ ] CS 운영시간 푸터 노출
- [ ] 사업자 대표회선 결정 (010 외)

### SEO / 폰트
- [ ] 32 slug 페이지 openGraph/twitter 보강 (띠 12 + 별자리 12 + 꿈해몽 8)
- [ ] sitemap lastmod 동적화
- [ ] Google Fonts preconnect 추가
- [ ] 폰트 preload 정책 재검토

### 테스트 / 린트
- [ ] eslint 도입 (next lint)
- [ ] cron `/api/notifications/dispatch` 인증 테스트

---

## 🟢 P2 (장기 — 분기 단위)

상세는 [`../audit/production-hardening-audit.md`](../audit/production-hardening-audit.md) §7 P2 참고.

- [ ] punycode 호스트 잔존 정리 (canonical 변경 후 자연 해소 검증)
- [ ] proxy.ts `/dashboard` 가드 dead code 확인 후 제거
- [ ] 회사 정보 single source (푸터 + `/help` 중복 제거)
- [ ] 1:1 문의 시스템 구축 (mailto: 폴백 대체)
- [ ] 꿈해몽 사전 100~500건 확장
- [ ] 타로 78카드 landing page 신설
- [ ] root metadata 키워드 강화
- [ ] FAQ 가격 표현 통일 (monthly-calendar)
- [ ] prettier 도입
- [ ] 분기 audit 자동화 (GitHub scheduled workflow)
- [ ] Node 버전 통일 (ci 20 / playwright 22)
- [ ] `*.spec.ts` / `*.test.ts` 이원화 정리

---

## 배포 전 최종 점검 명령어 (Phase 9 완료 후)

```bash
# 1. typecheck
npm run typecheck

# 2. 모든 strict audit
npm run audit:dead-anchors:strict
npm run audit:mockup-placeholders:strict
npm run audit:redesign-coverage:strict
npm run audit:payment-idempotency:strict
npm run audit:ai-chat-idempotency:strict
npm run audit:lucky-hybrid:strict

# 3. test
npm test                # *.test.ts (자체 runner)
npm run test:spec       # *.spec.ts (vitest)

# 4. e2e (로컬에서 cred 설정 후)
npm run e2e

# 5. build
npm run build

# 6. env validator 가 production env 누락 시 throw 확인
PRODUCTION_ENV_CHECK=1 npm run build
```

모두 exit 0 + 위 P0 체크리스트 ✅ 완료 시 배포 가능.

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-17 | 초기 작성 (Phase 1 audit) |
