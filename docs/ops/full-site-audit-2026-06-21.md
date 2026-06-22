# 간지사주 전체 사이트 검증 리포트 — 2026-06-21

> 방법: 정적 베이스라인(타입체크·유닛·감사 스크립트) + **검증자가 직접 ~20개 핵심 파일을 읽어 적대적으로 확인**한 결과.
> 14차원 병렬 감사 워크플로(wf_96388978-30d)는 14개 xhigh 에이전트가 4분간 787k 토큰을 소모하며 **세션 사용량 한도(12:20 KST 리셋)** 를 쳐서 0건 반환 → 인라인 순차 감사로 전환.
> 따라서 본 리포트는 **보안·결제·컴플라이언스·사주엔진 정합성에 집중한 부분 감사**다. a11y·성능·프론트 상태·DB 드리프트는 한도 리셋 후 별도 완료 필요(§7).

---

## 0. 베이스라인 (모두 GREEN)

| 검사 | 결과 |
|---|---|
| `npm test` (커스텀 하네스) | ✅ 874 assertion, 0 실패 |
| `npm run typecheck` | ✅ exit 0 |
| `audit:dead-anchors / mockup-placeholders / redesign-coverage :strict` | ✅ pass |
| `audit:lucky-hybrid` | ✅ pass |
| DB 의존 감사(payment-idempotency 등) | ⚠️ 로컬 Supabase env 부재로 미실행 |
| git 추적 시크릿 | ✅ `.env.example`만 추적, 노출 없음 |

---

## 1. P1 — 우선 수정 (보안/비용/접근통제)

### P1-1. AI 풀이 라우트 2종 인증 누락 → 비인증 LLM 비용 증폭 + 페이월 우회
- **파일**: `src/app/api/interpret/route.ts`, `src/app/api/interpret/yearly/route.ts`
- **사실**:
  - 두 라우트 모두 `supabase.auth.getUser()` **없음**. `readingId`만 받아 `resolveReading` 후 OpenAI 생성.
  - `regenerate: true` 를 보내면 캐시를 우회하고 매번 새 OpenAI 호출 발생(`interpret`=maxOutputTokens 900 / `interpret/yearly`=`maxDuration 75`s 대형 생성).
  - 공격자가 인증 없이 `{readingId, regenerate:true}` 를 반복 POST → **OpenAI 토큰 무한 소진(비용 DoS)**.
  - `interpret/yearly` 는 **엔타이틀먼트 체크도 없음** → 연간 풀이가 유료/인증 기능이라면 **페이월 우회**.
- **대조 근거(같은 팀이 패턴을 알고 있음)**: `interpret/compatibility` = `getUser`(401) + `hasCompatibilityAccess`(403), `interpret/lifetime` = `getUser`(401) + `getLifetimeReportEntitlement`(403). 또한 `credits/use` 는 `reading.userId !== user.id → 403` 소유권 체크 보유. **4개 중 2개만 빠진 명백한 누락.**
- **수정**:
  1. 두 라우트에 `getUser()` 추가, 미인증 401.
  2. `reading.userId && reading.userId !== user.id → 403` 소유권 체크(`credits/use` 패턴 복사).
  3. `interpret/yearly` 에 엔타이틀먼트 게이트 추가(yearly 가 유료라면).
  4. `regenerate` 경로에 사용자/IP 레이트리밋(예: 분당 N회) — 인증되더라도 비용 상한.
- **확신도**: high (코드 직접 확인).

### P1-2. 내부 검증 API 6종 — fail-open
- **파일**: `src/lib/verification-access.ts` → `src/app/api/verification/{saju,lifetime,yearly,today-fortune,classics,profile-linkage}/route.ts`
- **사실**:
  - `isAllowedVerificationEmail()`: 허용목록이 **비어 있으면 `true` 반환**(line 18-20).
  - `getVerificationAccessStatus()`: `!hasSupabaseServerEnv` 이면 `status:'allowed'` 반환(line 29-34).
  - 즉 `INTERNAL_VERIFICATION_EMAILS` env 미설정 시 **로그인한 누구나** 6개 내부 감사 엔드포인트 접근(엔진 내부, profile-linkage, lifetime 감사 데이터 노출). supabase env 부재 시 익명까지.
- **영향**: config 의존. 프로덕션에 env 가 설정돼 있으면 노출 안 됨 → 그러나 **fail-open 설계 자체가 리스크**(env 누락/오타 1번에 전 노출). profile-linkage 는 사용자 연결 데이터일 수 있어 더 민감.
- **수정**: 허용목록이 비면 **default-deny**(빈 목록 = 전면 차단). supabase env 부재 시 'allowed' 대신 'forbidden'. 가능하면 `getCurrentAdminCheck` 로 일원화.
- **확신도**: high.

---

## 2. P2 — 의미있는 보강

### P2-1. 보안 헤더 전무
- **파일**: `next.config.ts` (no `headers()`), 전역.
- **사실**: CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options(nosniff), Referrer-Policy, Permissions-Policy **하나도 없음**.
- **영향**: 클릭재킹(iframe 삽입) 방어 없음, 저장형/반사형 XSS 발생 시 CSP 차단막 없음, MIME 스니핑.
- **수정**: `next.config.ts` 에 `async headers()` 추가 — 최소 `X-Frame-Options: DENY`(또는 CSP frame-ancestors 'none'), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP 는 Report-Only 로 먼저 도입 후 위반 수집→enforce. (HSTS 는 Vercel 커스텀 도메인이 일부 자동 처리하나 명시 권장.)

### P2-2. Toss 웹훅 서명 미검증
- **파일**: `src/app/api/payments/webhook/toss/route.ts`
- **사실**: 웹훅 페이로드의 HMAC/서명 검증 **없음**. 다만 `getPayment(paymentKey)` 로 Toss 정본 결제를 재조회(line 67)하고 그 결과로 정산 → **위조 결제로 무료 언락 불가**(P0 아님).
- **잔여 리스크**: 위조 이벤트 스팸(로그 오염/처리 부하), orderId+paymentKey 추측 시 정산 트리거.
- **수정**: Toss 웹훅 시크릿/서명 헤더 검증을 정본 재조회 **앞단**에 추가(defense-in-depth + 조기 거절). 확신도: high.

### P2-3. CI 가 회귀 가드 4종+ 미실행 (돈 관련 포함)
- **파일**: `.github/workflows/ci.yml`
- **사실**: ci.yml 은 `dead-anchors`·`mockup-placeholders`·`redesign-coverage` 만 실행. 아래 가드는 **npm 스크립트로 존재하나 CI 에 없음**:
  - `audit:payment-idempotency:strict` ← **결제 이중과금 가드(사실상 P1급)**
  - `audit:ai-chat-idempotency:strict`
  - `audit:lifetime-report:strict`
  - `audit:lucky-hybrid:strict`
  - (+ `narrative-tone`, `business-activity`, `user-entitlements`)
- **영향**: 결제 멱등/리포트 무결성 회귀가 PR 에서 **그린으로 통과**될 수 있음.
- **수정**: ci.yml 에 위 strict 감사 추가. DB 의존 감사는 dev/staging service_role 로 별도 job(또는 nightly).

### P2-4. 메타데이터 누락 34/116 페이지
- **사실**: `generateMetadata`/`metadata` 보유 82개 / 전체 116개. 나머지 34개는 루트 레이아웃 title·description 상속 → **중복 타이틀**.
- **영향**: 색인 대상 콘텐츠 페이지의 SEO 희석(검색 스니펫/CTR 저하). (단계 페이지·CSR 전용은 허용 가능 — 색인 대상 위주로 선별.)
- **수정**: 색인 대상 동적/콘텐츠 라우트에 `generateMetadata` 추가(타로/사주/별자리/꿈 slug 페이지 우선).

---

## 3. P3 — 마이너

| # | 위치 | 내용 | 수정 |
|---|---|---|---|
| P3-1 | `payments/reconcile`, `notifications/dispatch` | 크론 시크릿 비교가 `===`(타이밍) — `summary/refresh` 는 `safeEqual` | 상수시간 비교로 통일 |
| P3-2 | `api/geo/birth-location` | 공개 엔드포인트 레이트리밋 없음 (OSM Nominatim 프록시 남용/쿼터 소진) | IP 레이트리밋 + 결과 캐시(이미 일부 캐시 있음) |
| P3-3 | `domain/saju/report/interpretation-rule-table.ts:49` | 명령형 "반드시 비우세요" 가 validator 금지토큰 '반드시'와 충돌 가능 | 해당 카피가 chapter-validator 통과하는지 확인/예외화 |
| P3-4 | `domain/safety/safe-redirect.ts` | 위기 키워드 매처가 자모분해/치환 난독화 미포착 | 안전망 한계 인지(차단 보장 아님), 필요 시 강화 |
| P3-5 | `business-info.ts:36` | 프로덕션 가드가 `VERCEL_ENV==='production'` 에만 발동 | 비-Vercel 배포 시 미발동(현 배포는 Vercel이라 영향 없음) |

---

## 4. 확인된 강점 (실수로 "고치지" 말 것)

- **IDOR 소유권 체크 일관성**: `reviews/[id]`, `family-profiles`, `tarot/snapshots`, `dialogue/messages`, `today-fortune/unlock`, `fortune-calendar/unlock`, `compatibility/access`, `credits/use` — 모두 `user.id` 소유권 403 강제. (interpret 2종만 예외=P1-1)
- **사주 엔진 고품질**: `equation-of-time.ts`(균시차) + `birth-location.ts`/`pillars.ts`(경도 진태양시 보정) + 자시/야자시 처리 구현. 저가 사주앱이 흔히 빠뜨리는 균시차까지 반영.
- **정직성/금지어 3중 가드**: `terminology.ts`·`total-review-validator.ts`·`chapter-validator.ts` 가 반드시/절대/대박/암흑기 등 차단 + fixture spec(`fixture-19820129.spec.ts`)로 본문 금지표현 0 단언. 어휘 신조어("X의 결") 위반 0건.
- **결제 멱등 아키텍처**: order-ledger 상태머신 + 웹훅 정본 재조회 + `unlock_credit_feature_once`(reused 플래그) 멱등 RPC.
- **법적 고지 fail-closed**: `assertProductionBusinessEnv()` 가 import 시점에 필수 사업자정보 env 누락이면 **프로덕션 빌드 차단**.
- **크론 라우트 전부 시크릿 게이트**, 어드민 화이트리스트(`admin-auth.ts`) env+DB 이중 + super_admin 분리.
- **시크릿 비노출**: `NEXT_PUBLIC_*` 에 service_role/secret 노출 0, 추적 env 파일 0.

---

## 5. 적대적 검증으로 **기각**한 오탐 (참고)

- ❌ `auth/callback` 오픈리다이렉트 — `next` 가 origin 접두 + `//` 거부 → 동일 출처만. 안전.
- ❌ `geo/birth-location` SSRF — 사용자 입력은 **고정 호스트의 `q` 파라미터**에만 들어감(호스트 비제어). 불가.
- ❌ `verification/*` 무인증 노출 — 별도 가드 `requireVerificationApiAccess` 존재(단, fail-open 은 P1-2로 별건).
- ❌ 법적 고지 누락 — 빌드타임 가드로 fail-closed.
- ❌ `safe-redirect.ts` = URL 리다이렉트 취약점 — 실제로는 위기/의료/금전/법률 키워드 **안전 라우팅 기능**(양질).

---

## 6. 즉시 액션 (권장 순서)

1. **P1-1** `interpret`·`interpret/yearly` 인증+소유권+엔타이틀먼트+레이트리밋 (비용/페이월).
2. **P1-2** `verification-access` default-deny 전환.
3. **P2-3** ci.yml 에 payment-idempotency 등 strict 감사 추가(회귀 차단).
4. **P2-1** 보안 헤더 추가(클릭재킹/nosniff/CSP-RO).
5. **P2-2** 웹훅 서명 검증.

---

## 7. 미완료 — 한도 리셋(12:20 KST) 후 별도 완료 필요

병렬 워크플로가 세션 한도로 죽어 아래 차원은 **머신 감사 미수행**:
- **접근성(a11y)** — alt/aria/포커스/대비/모달 트랩.
- **성능** — N+1·순차 await·`use client` 과다·이미지 최적화·revalidate.
- **프론트 상태** — 로딩/에러/빈 상태, 하이드레이션, 클라이언트/서버 경계 누수.
- **DB 드리프트/RLS** — ⚠️ Supabase MCP 가 무관 프로젝트(richdoc-ops)를 가리켜 로컬 검증 불가. `deduct_credits` RPC 원자성, 민감 테이블(admin_access_log·refund_requests·payment_orders) RLS, 코드↔마이그레이션 드리프트를 **수동**(`supabase db lint`/advisors + staging service_role 로 `audit:payment-idempotency:strict`)으로 확인 권장.
- **렌더 출력 정직성** — grep 한계. 빌더 조립 실제 문장으로 비문/한자 잔존 재확인 권장(메모리 피드백).

→ **업데이트**: 아래 §8(P1 수정 완료) + §9(Part B 인라인 감사)로 처리함. 병렬 워크플로 대신 메인 루프 인라인 순차로 진행(한도 회피).

---

## 8. Part A — P1 2건 수정 완료 (브랜치 `fix/interpret-auth-and-verification-failclosed`)

검증: `npm test` **878 ok / 0 실패**(+4 신규 회귀 테스트), `npm run build`(타입체크 포함) **exit 0**.

| 항목 | 변경 | 파일 |
|---|---|---|
| **P1-1a** interpret(base) 비인증 LLM 비용 차단 | 캐시 응답은 공개 유지, **신규/regenerate 생성 경로에 `getUser`(401)+소유권(403)** 게이트 추가 | `src/app/api/interpret/route.ts` |
| **P1-1b** interpret/yearly 비인증 + 페이월 우회 차단 | `getUser`(401)+소유권(403)+**3-way 이용권**(평생 OR plus/premium 구독 OR year-core)(403). premium page 의 yearlyAccessLabel 로직과 동일 | `src/app/api/interpret/yearly/route.ts` |
| **P1-2** verification fail-open 제거 | 허용목록 빈 경우 **프로덕션 default-deny**(dev/preview 만 허용), supabase env 부재 시 프로덕션 forbidden. 순수 판정함수 `isVerificationEmailAllowed` 분리 | `src/lib/verification-access.ts` |
| 회귀 가드 | fail-open 재발 차단 유닛테스트 4건 | `src/lib/verification-access.test.ts` (신규) |

설계 판단: base interpret 패널(`SajuAiInterpretationPanel`)은 **어디서도 import 안 되는 orphaned 코드**로 확인 → 라이브 플로 영향 없음. yearly 게이트는 premium page 의 3-way OR(평생/구독/year-core)을 정확히 복제해 결제 모델 깨짐 방지.

**남은 후속(권장)**: §2-3(CI 가드 추가), §2-1(보안 헤더), §2-2(웹훅 서명) — 별도 PR.

---

## 9. Part B — 나머지 5개 차원 인라인 감사 결과

워크플로 한도로 못 돌린 차원을 메인 루프 인라인(grep+타깃 리드)으로 처리. 결과: **심각 이슈 없음, 대체로 양호.**

| 차원 | 결과 |
|---|---|
| **클라/서버 경계** | ✅ `'use client'` 111개 중 **service client/서버 모듈 import 0건** — 시크릿 클라 누수 없음. |
| **DB 드리프트** | ✅ 코드 `.from('table')` 참조 전부 마이그레이션에 존재 — **드리프트 0**. |
| **RLS** | ✅ 민감 테이블 6종(payment_orders·refund_requests·admin_users·admin_access_log·credit_lots·user_credits) **전부 RLS enable 마이그레이션 존재**. |
| **크레딧 race** | ✅ `credit_lots.amount_remaining` 에 `CHECK (>=0)` DB 제약 + 멱등 `unlock_credit_feature_once` RPC → 동시 과차감 DB단 차단. |
| **접근성(a11y)** | ✅ raw `<img>` 0(next/image), `div/span onClick` 0(전부 button), `<html lang="ko">` 설정. 구조 신호 매우 양호. (모달 focus-trap/aria-modal 은 미정독 — 심층 필요시 추가) |
| **성능** | P3: `report-entitlements.ts:90` for-loop 내 `await`(N+1, acceptedKeys 소수라 경미) → `Promise.all` 권장. `select('*')` 5개 파일(소규모 테이블 추정). |
| **렌더 정직성(한자)** | ⚠️ **P3/P2 검토**: `report-document.tsx` 의 eyebrow 라벨에 한자 노출 — `干支`/`四柱八字`/`五行 균형`/`大運`/`神煞(神煞)`/`干支四柱`, `saju/[slug]/page.tsx:499` `사주팔자(四柱)`. naming-policy "본문 한자 0(8글자 카드에서만)" 기준과 충돌 가능. **디자인 액센트로 의도한 것인지 사용자 확인 필요**(메모리: 한자 잔존 민감). |

**Part B 결론**: 보안/데이터 정합성 측면 추가 P0/P1 **없음**. 유일한 판단 필요 항목은 report-document 한자 eyebrow(정책 vs 디자인 의도).

