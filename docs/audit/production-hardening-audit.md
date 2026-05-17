# Production Hardening Audit — 2026-05-17

> **목적**: 간지사주(`https://ganjisaju.kr`) 서비스를 유료 상용화 가능한 수준으로 끌어올리기 위한 초기 감사 결과. 본 문서는 **읽기 전용 audit Phase 1** 산출물이며, 모든 후속 코드 변경은 별도 PR (Phase 2~N) 로 단계 진행한다.

---

## 0. 합의된 기준 (Phase 1 결정사항)

| 항목 | 결정값 | 근거 |
|---|---|---|
| Canonical 도메인 | `https://ganjisaju.kr` (영문 ASCII) | 사용자 지시서 + 2026-05-17 확정 |
| 브랜드명 | `간지사주` | 사용자 지시서 + 2026-05-17 확정 |
| 시간 기준 | Asia/Seoul (KST, UTC+9 고정, DST 없음) | 사용자 지시서 |
| 기본 폰트 | Noto Sans KR (preload + preconnect 보강) | 사용자 지시서 |
| 법무성 정보 | 임의 생성 금지 — env + production build 가드 | 사용자 지시서 |

---

## 1. 라우트 / 도메인 / 미들웨어

### 1.1 라우트 인벤토리 요약
페이지 라우트 **86개**, API 라우트 **53개**. 카테고리별 상세는 [`route-status-map.md`](route-status-map.md) 참고.

| 카테고리 | 페이지 수 |
|---|---|
| 운세 (today-fortune / today) | 4 |
| 사주 (saju/* + slug 결과 페이지) | 14 |
| 타로 (tarot/daily/*) | 4 |
| 궁합 (compatibility/* + gunghap) | 4 |
| 띠 (zodiac/*) | 2 |
| 별자리 (star-sign/* + compat) | 7 |
| 꿈해몽 (dream/* + dream-interpretation) | 3 |
| AI 상담 (dialogue/*) | 6 |
| 코인/멤버십 (credits, membership, pricing, pay) | 7 |
| 마이/인증 (my/*, login, signup, auth, password) | 11 |
| 관리자 (admin/*) | 7 |
| 정적/지원 (terms, privacy, help, support/*, ...) | 17 |

### 1.2 도메인 정규화 — 현 상태
- **현재 canonical (`src/lib/site.ts:5`)**: `https://xn--s39at50bo6fmwa.kr` = `https://간지사주.kr` punycode
- **LEGACY 거부 목록 (`src/lib/site.ts:8-14`)**: `ganji-saju.vercel.app`, `ganji-saju-ganji-sajus-projects.vercel.app`, `ganji-saju-ganji-saju-vercel.app` (오타 의심 — 점 누락), `ganjisaju.kr`, `www.ganjisaju.kr`
- **proxy (`src/proxy.ts`)**: Next.js 16 의 `middleware → proxy` 리네임 적용 완료. production + Vercel production env 일 때만 308 redirect
- **next.config.ts redirects/rewrites**: 없음
- **vercel.json**: cron 6건만 정의, 도메인/redirect 설정 없음 (Vercel 대시보드 직접 관리)

### 1.3 핵심 불일치
1. **사용자 지시서의 `https://ganjisaju.kr` 가 현 코드의 LEGACY 거부 목록에 포함됨** → canonical 반전 필요
2. **legacy host 오타**: `ganji-saju-ganji-saju-vercel.app` (점 누락) vs `src/app/api/auth/callback/route.ts:51` 의 `ganji-saju-ganji-saju.vercel.app` (정상)
3. **proxy 의 production-only 가드** (`VERCEL_ENV === 'production'` && `NODE_ENV === 'production'`) → preview 환경에서 canonical 정규화 안 됨

### 1.4 /onboarding 비일관성 원인 (사용자 보고 일치)
- `src/app/page.tsx:18-20`: cookie `moonlight:onboarded === '1'` 없으면 첫 방문자 무조건 `/onboarding` redirect
- cookie 는 **호스트별 격리** → `www.ganjisaju.kr` ↔ `xn--s39at50bo6fmwa.kr` 간 cookie 미공유
- Vercel 에서 `www.ganjisaju.kr` 가 production alias 미설정이거나 proxy 가 preview 에서 비활성이면 정규화 누락 → onboarding 무한 노출

### 1.5 SEO 메타데이터 / sitemap / robots
- **metadataBase**: `new URL(getSiteUrl())` → env 우선, 폴백 `xn--s39at50bo6fmwa.kr`
- **sitemap.ts**: `now = new Date()` (빌드 시점) 으로 lastmod 동결 → daily 페이지 인덱스 갱신 안 됨
- **robots.ts disallow 목록**: `/api/`, `/login`, `/credits/success`, `/saju/`, `/my`, `/admin`, `/lock-screen` — `/saju/` 전체 차단은 정적 사주 컨텐츠가 있다면 SEO 손실
- **slug 페이지 openGraph/twitter 누락**: 띠 12 + 별자리 12 + 꿈해몽 8 = 32 페이지 SNS 카드 부실

---

## 2. KST 시간 처리

### 2.1 공통 유틸 현황 — 분산 / 중복
| 유틸 | 위치 | 방식 | 정확도 |
|---|---|---|---|
| `getKoreaAccessDay()` | `src/lib/credits/detail-report-access.ts:67` | Intl + Asia/Seoul, sv-SE | 정확 |
| `getKoreaDateKey()` | `src/lib/tarot-api.ts:1070` | Intl + Asia/Seoul, sv-SE | 정확 |
| `getSeoulDateKey()` | `src/server/home/home-banners.ts:48` | Intl formatToParts + Asia/Seoul | 정확 |
| `toKstDateKey()` | `src/lib/star-sign/daily-fortune.ts:60` | `+9시간 offset` 수동 | 결과 맞음, 컨벤션 깨짐 |
| `getLocalDateTimeSnapshot()` | `src/server/today-fortune/build-today-fortune.ts:756` | Intl + timezone parameterized | 정확 (정본) |

### 2.2 KST 누락 — 🚨 P0 버그 (UTC drift)
1. **`src/app/zodiac/[slug]/page.tsx:69`**: `periodSeed` 함수에서 `new Date().getDate()/getMonth()/getFullYear()` 직접 사용 → Vercel 서버 UTC 기준으로 띠운세 점수 산출. KST 00:00 ~ 09:00 사이에 어제 점수 노출
2. **`src/lib/free-content-pages.ts:53`**: `buildTodayFortune()` 의 `new Date().getDate()` 동일 결함

### 2.3 ISR / cache key 결함
- daily 페이지 (`/today-fortune`, `/star-sign`, `/zodiac`, `/tarot/daily`) 모두 `revalidate` / `dynamic` 설정 부재
- `generateStaticParams` 정적 slug 들은 **빌드 시점 KST 가 박힘** → 새 배포 전까지 동일 컨텐츠
- 유일하게 `getCachedHomeBanners` 만 `unstable_cache(['home-banners-v1'], { revalidate: 86400 })` + dateKey cache key 정상

### 2.4 new Date() 직접 사용
- src/ 하위 **88개 파일**에서 `new Date()` 사용. 대부분 timestamp/저장용으로 안전
- 위험 영역: 페이지 SSR 로직에서 표시 데이터를 산출하는 raw `new Date()` — 위 2건이 대표 사례

---

## 3. 결제 / 상품 / 환불 / 코인 / 상담

### 3.1 결제 모듈
- **Toss SDK (브라우저)**: `src/components/membership/toss-membership-checkout.tsx`, `src/app/credits/page.tsx`
- **백엔드 confirm**: `src/app/api/payments/confirm/route.ts` → `src/lib/payments/toss.ts:confirmPayment()` (Toss `/v1/payments/confirm` 호출)
- **Toss webhook 라우트 없음** → 사용자가 success 페이지 미도달 시 entitlement 미발급 위험
- **orderId**: `order_${pkg.id}_${method}_${Date.now()}` → 같은 ms 더블 클릭 시 충돌 가능. UUID 권장
- **entitlement idempotency**: `product_entitlements (user_id, product_id, scope_key)` UNIQUE + `23505` 처리로 안전
- **코인 적립 idempotency**: `addCredits` 함수에 **paymentKey 기반 중복 적립 차단 없음** → 같은 paymentKey 로 2회 confirm 시 코인 2배 적립 가능
- **코인 차감 idempotency**: migration 015 `unlock_credit_feature_once` SECURITY DEFINER + FOR UPDATE 락 → 안전

### 3.2 상품 카탈로그 요약
13개 상품 (코인 3 + 구독 2 + 보너스 1 + lifetime 1 + taste 6). 상세는 [`payments/product-catalog.md`](../payments/product-catalog.md) 참고.

🚨 **불일치**:
- **migration 016 `product_entitlements.product_id` CHECK 에 `lifetime-report` 누락** (코드는 grant 시도) — migration 018/020 후속 추가 여부 미확인
- **FAQ vs 카탈로그 가격 표기**: monthly-calendar 가 FAQ `support/faq:39` 에서 "2코인(1,900원)" 인데 실제는 단건 1,900원 결제

### 3.3 환불 / 취소 / 노쇼 — 🚨 P0 다수
| 항목 | 상태 |
|---|---|
| 전용 환불정책 페이지 (`/refund-policy`) | **없음** |
| 환불 신청 자동화 | **없음** ("1:1 문의로 영수증과 함께 요청") |
| 49,000원 lifetime-report 환불 시 entitlement 회수 코드 | **없음** (`revokeLifetimeReportEntitlement` 부재) |
| 멤버십 해지 | `POST /api/subscription/manage action=cancel` 존재, 다음 결제일까지 혜택 유지 |
| 상담 예약 취소 UI/API | **없음** (status='cancelled' 컬럼만 존재, PATCH/DELETE 라우트 없음) |
| 노쇼 정책 페이지 | **없음** |

### 3.4 코인 시스템 — 🚨 P0 정책-구현 불일치
- FAQ: "결제 시점부터 1년간 유효", "구독 코인은 구독 종료 시 만료"
- DB: `user_credits` 에 expiration / expires_at 컬럼 **없음** + 만료 cron **없음**
- 현 구현 = **영구 유효**. 추후 1년 만료 적용 시 기존 사용자와 분쟁 위험

### 3.5 상담 예약 — 🚨 P0 표시광고법
- **상담사 출처**: `src/content/moonlight.ts` `DALBIT_TEACHERS` — 12간지 캐릭터 (실존 인물 아님)
- **`src/app/dialogue/appointment/page.tsx:29`**: 하드코딩 `meta: '경력 18년 · ★ 4.9 (312)'` — 실제 자격증명/별점/리뷰수 출처 없음
- **표시·광고 공정거래법 §3 (기만적 표시) 위반 소지** — 즉시 제거 또는 출처 명시 필요
- 예약 결제 연동 없음 (무료 예약). 슬롯 충돌 차단 OK

---

## 4. 법무 / 정책 / 사업자정보

### 4.1 정책 페이지 인벤토리
| 정책 | URL | 파일 | 개정일 | 버전관리 |
|---|---|---|---|---|
| 이용약관 | `/terms` | `src/app/terms/page.tsx` | 없음 | 없음 |
| 개인정보처리방침 | `/privacy` | `src/app/privacy/page.tsx` | 없음 | 없음 |
| 환불정책 | — | **별도 페이지 없음** | — | — |
| 마케팅 수신 동의 | — | **없음** | — | — |
| 영상/위치정보/청소년보호 | — | **없음** | — | — |

- `src/app/(public)/legal/` 디렉터리는 `.gitkeep` 만 있는 빈 폴더
- DB 동의 이력 인프라(`policy_versions`, `user_consents`) 존재하지 않음
- 정책 버저닝 인프라 설계는 [`policies/policy-versioning.md`](../policies/policy-versioning.md) 참고

### 4.2 사업자 정보 (`src/components/site-footer.tsx`)
| 항목 | 현재 표기 | 비고 |
|---|---|---|
| 상호명 | 푸꼬컴퍼니 | 실제값 추정 |
| 대표자 | 김재호 | 실제값 추정 |
| 사업자등록번호 | 215-27-64715 | 형식 정상 |
| 주소 | 서울특별시 중랑구 동일로 909, 3층 301호 일부호(묵동) | 실제값 추정 |
| 연락처 | 010-8123-9184 | 개인 휴대전화 — 대표번호로는 부적절 |
| **통신판매업 신고번호** | **누락** | 🚨 전자상거래법 §13①4호 위반 |
| **개인정보보호책임자(CPO)** | **누락** | 🚨 개인정보보호법 §31 위반 |
| **호스팅 사업자** | **누락** | Vercel + Supabase 등 표기 필요 |
| 대표 이메일 | 푸터 미표기 | `support@ganjisaju.kr` 은 contact-form 내부 상수 |

### 4.3 동의 처리
- 회원가입/로그인: 체크박스 **없음** (implicit consent 한 줄 문구만)
- 필수/선택 동의 분리: **없음**
- `TermsConsentModal` 컴포넌트는 구현되었으나 실연결 0건
- 만 14세 미만 처리: **없음** (개인정보보호법 §22-2 위반 소지)
- 마케팅 수신 동의 사전 분리: **없음** (정보통신망법 §50 위반 소지)
- 동의 이력 DB 저장: 없음

### 4.4 운영자 입력 필요 필드
임의 생성 금지. 상세는 [`legal-required-fields.md`](../legal-required-fields.md) 참고.

---

## 5. 폰트 / 메타데이터

### 5.1 Noto Sans KR 현황
- `next/font/google` 의 `Noto_Sans_KR` (weight 400/500/700/800) + `Noto_Serif_KR` (700/800)
- 둘 다 `preload: false` 설정 → 첫 페이지 FOUT
- CSS 변수 chain: `--font-dalbit-sans` → `--font-body` (45+ 위치 적용)
- **Google Fonts preconnect 미설정** → gstatic 첫 연결 비용
- subset 옵션 명시 없음

### 5.2 metadataBase
- `new URL(getSiteUrl())` → 환경변수 우선, fallback `xn--s39at50bo6fmwa.kr`
- 사용자 directive 적용 시 fallback = `https://ganjisaju.kr`

---

## 6. 빌드 / CI / 환경변수 / 테스트

### 6.1 CI/CD
- `.github/workflows/ci.yml` — Node 20, `npm test` → strict audits → typecheck → build
- `.github/workflows/playwright.yml` — Node 22 (Supabase admin client 호환), Playwright smoke E2E
- Vercel 자동 배포 (preview + production)
- vercel.json cron 6건 (`/api/notifications/dispatch` 슬롯)

### 6.2 환경변수 (.env.example) — 🚨 P0 가드 부재
17개 키 분류:
- Supabase 3, Toss 2, OpenAI 3, KASI 1, 지오코더 2, Web Push 3, Cron 2, Admin 1, 사이트 1
- **사업자 정보 env 없음** (현재 코드에 하드코딩)
- **env validator 없음** — `getRequiredEnv`/`assertEnv` 부재. `TOSS_SECRET_KEY` 등 필수 secret 빈 값으로 빌드 성공 가능

### 6.3 테스트 — 🚨 P0 CI 누락
- unit (`npm test`): 자체 runner `scripts/run-unit-tests.mjs`, `src/**/*.test.ts` 76개 실행
- **vitest (`npm run test:spec`): `src/**/*.spec.ts` 5개는 CI 미실행** (payment-duplicate-audit, fixture-19820129, saju-cross-fixtures, saju-data-v2-verification, unify-saju-scores)
- **audit:payment-idempotency:strict, audit:ai-chat-idempotency:strict, audit:lucky-hybrid:strict** 모두 CI 미통합
- e2e 3 spec (smoke / saju 인증필요 / payment-blocks)
- 결제 prepare/confirm route unit test 부재
- cron `/api/notifications/dispatch` 인증 테스트 부재

### 6.4 빌드 / 린트 / 타입
- typecheck: CI 포함, strict mode ✓
- **eslint / prettier 완전 미적용** (P1)
- next.config.ts 우회 옵션 없음 (정상)

### 6.5 배포
- Vercel project: `prj_yw0QBRyree5Ce4For1ZLwIPzdlGg`
- Speed Insights + Analytics 활성
- production canonical: `xn--s39at50bo6fmwa.kr` (DNS 정합성은 Vercel 대시보드에서 확인 필요)

---

## 7. 발견 사항 종합 — 우선순위 분류

### 🚨 P0 (상용화 차단)
1. **canonical 도메인 반전 필요** — `ganjisaju.kr` 가 LEGACY 거부 목록에 있음 (지시서 충돌)
2. **`/onboarding` www 비일관성** — cookie 호스트별 격리 + production-only proxy 가드
3. **`/zodiac/[slug]` KST UTC drift** — `new Date().getDate()` 직접 사용 (Vercel UTC 기준)
4. **`buildTodayFortune()` KST UTC drift** — `src/lib/free-content-pages.ts:53` 동일 결함
5. **`/dialogue/appointment` 가짜 평점** — "경력 18년 · ★ 4.9 (312)" 하드코딩 (표시광고법 위반 소지)
6. **통신판매업 신고번호 미표기** (전자상거래법 §13)
7. **개인정보보호책임자(CPO) 미표기** (개인정보보호법 §31)
8. **약관/방침 개정일·버전 표기 없음** (약관규제법 + 정보통신망법)
9. **개인정보처리방침 법정 필수항목 다수 누락** (보유기간/제3자제공/수탁사명/안전성 조치 등)
10. **환불정책 전용 페이지 없음** (전자상거래법 §17 청약철회 안내 의무)
11. **49,000원 lifetime-report entitlement 회수 코드 부재**
12. **상담 예약 취소 UI/API 부재** + 노쇼 정책 없음
13. **코인 유효기간 FAQ "1년" vs 구현 영구** (정책-구현 불일치)
14. **vitest *.spec.ts CI 미실행** (payment-duplicate-audit 포함)
15. **env validator 부재** — 필수 secret 누락 시 빌드 차단 없음
16. **`/membership/page.tsx` 3개 멤버십 카드 가격 = "준비 중"** — 결제 전환 차단 ([incomplete-ui-inventory §1.1](incomplete-ui-inventory.md#11))
17. **`/lock-screen` 페이지 전체 SHELL** — mock data + "준비 중" badge + disabled CTA ([§1.2](incomplete-ui-inventory.md#12))
18. **`/search` 검색 미완성** — "검색 준비 중입니다" 노출 ([§1.3](incomplete-ui-inventory.md#13))
19. **상담사 7+ 명 가격 "준비 중"** — gangi-ui 노출 ([§1.4](incomplete-ui-inventory.md#14))
20. **사용자 명세 라우트 불일치** — `/coins`, `/horoscope` 미존재 (실제: `/credits`, `/star-sign`) ([§4](incomplete-ui-inventory.md#4))

### 🟡 P1
1. legacy host 오타 (`ganji-saju-ganji-saju-vercel.app`)
2. proxy production-only 가드 — preview 환경 canonical 정규화 안 됨
3. KST 유틸 4종 중복 → 단일 `src/shared/utils/kst.ts` 통합 필요
4. daily 페이지 ISR/cache key 미설정 (dateKey cache tag 없음)
5. orderId 충돌 가능성 (`Date.now()` 기반)
6. Toss webhook 라우트 부재 — success 페이지 미도달 시 entitlement 미발급
7. `addCredits` paymentKey 기반 idempotency 없음
8. 사업자 정보 하드코딩 (env 분리 필요)
9. eslint 미적용
10. 결제 prepare/confirm route unit test 부재
11. cron 엔드포인트 테스트 부재
12. 만 14세 미만 처리 부재
13. 필수/선택 동의 분리 없음
14. 마케팅 수신 동의 사전 분리 없음
15. 호스팅 사업자 처리위탁 고지 누락 (국외이전 동의 포함)
16. CS 운영시간/연락처가 개인 휴대전화
17. `/saju/` 전체 disallow (robots) — SEO 손실 가능
18. slug 페이지 openGraph/twitter 누락 (32 페이지)
19. sitemap lastmod 빌드 시점 동결
20. 폰트 preload:false + preconnect 미설정

### 🟢 P2
1. punycode 호스트 잔존 (canonical 변경 후 자연 해소)
2. proxy.ts dashboard 가드 — 존재하지 않는 라우트 (dead code 가능)
3. 회사 정보 푸터 + `/help` 중복 하드코딩
4. 1:1 문의 mailto: 폴백 (이력 추적 불가)
5. 꿈해몽 데이터 소스 이원화 + slug SEO 미확장
6. 타로 78카드별 SEO landing 페이지 0건
7. root metadata 키워드 6개로 빈약
8. FAQ 가격 표현과 카탈로그 불일치 (monthly-calendar)
9. `DALBIT_TEACHERS` 12종 모두 `productPosition: '확장 예정'`
10. prettier 미적용
11. 분기 audit (`audit:business-activity` 등) 자동화 부재
12. Node 버전 불일치 (ci.yml 20 vs playwright.yml 22)
13. `*.spec.ts`/`*.test.ts` 이원화 (runner 2개 유지 비용)

---

## 8. 후속 작업 — Phase 2~N

본 audit 의 P0/P1 해결은 [`../superpowers/plans/2026-05-17-production-hardening.md`](../superpowers/plans/2026-05-17-production-hardening.md) 의 단계별 plan 으로 실행한다. 추가로 [`incomplete-ui-inventory.md`](incomplete-ui-inventory.md) §1 의 사용자 직접 노출 P0 (`/membership` 가격 / `/lock-screen` / `/search` / 상담사 카드) 는 Phase 4-B 후보로 동시 처리 권장.

| Phase | 주제 | 예상 PR |
|---|---|---|
| 2 | 도메인 canonical 반전 (`ganjisaju.kr`) + 브랜드 통일 + proxy 일관화 | 1 PR |
| 3 | KST 유틸 통합 + UTC drift 버그 fix | 1 PR |
| 4 | 가짜 평점 제거 + 상담사 정보 정직화 | 1 PR (긴급, P2 와 합칠 수 있음) |
| 5 | 법무 페이지 (환불정책 신설, 정책 버저닝, 동의 모달 실연결) + 푸터 사업자정보 env 화 + production 빌드 가드 | 2~3 PR |
| 6 | 결제 하드닝 (Toss webhook, orderId UUID, addCredits idempotency, lifetime-report 회수 함수) | 2 PR |
| 7 | 상담 예약 취소/노쇼 정책 + UI/API | 1 PR |
| 8 | 코인 유효기간 정책-구현 정합 (만료 적용 또는 정책 수정) | 1 PR |
| 9 | CI 보강 (vitest, audit:*:strict, env validator, eslint 도입) | 1 PR |
| 10 | SEO 확장 (slug og/twitter, sitemap dateKey, 꿈해몽 사전 확장) | 2~3 PR |

각 Phase 종료 시 본 audit 의 해당 P0/P1 항목을 ✅ 처리하고 [`../qa/production-readiness-checklist.md`](../qa/production-readiness-checklist.md) 의 체크박스를 갱신한다.
