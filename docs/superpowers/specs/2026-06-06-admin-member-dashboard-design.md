# 간지사주 어드민 — 가입자 관리 대시보드 확장 설계서

- 작성일: 2026-06-06
- 상태: 설계 확정 대기(사용자 리뷰 게이트). v2 — 코드베이스 대조·보안 검증 반영.
- 선행 자산: **기존 Phase 1**(어드민 사용자 *상세* 페이지, 이미 구현 — `docs/claude-specs/phase-1-admin-user-detail.md`), Phase 2(환불 자동화), Phase 0b(LLM 텔레메트리)
- 본 설계 단계 표기: **M1~M4** (Member dashboard). 기존 "Phase 1/2/3" 스펙과 **다른 축**이며 혼동 방지를 위해 M 접두사 사용. M3는 기존 Phase 1 상세 페이지를 재구성·계승한다.
- 어휘 규칙: 사주 데이터 표기 시 `docs/claude-specs/02-naming-policy.md` 우선(오행 "X 기운", 팔자 8글자 카드만 한자). 관리자 운영 용어는 별도.
- 구현 규칙: Next.js 16.2.6 — 코드 작성 전 `node_modules/next/dist/docs/` 확인(AGENTS.md). 마이그레이션은 `supabase` CLI **수동 적용**(자동배포 대상 아님, drift 이력).

---

## 0. 요약 (TL;DR)

현행 `/admin/users`는 **"이메일/UUID 검색 전용"** 도구다(첫 200명 클라이언트 필터 → 그 밖은 누락, 전체 목록·필터·정렬·세그먼트 전무). 이것을 **"가입한 사람 전체를 한눈에 보고, 1명을 360도로 들여다보고, CS·운영 액션까지 실행하는 가입자 관리 대시보드"**로 확장한다.

**확정된 4대 결정**

| # | 결정 | 선택 | 함의 |
|---|---|---|---|
| 1 | 1차 초점 | **전체 가입자 리스트** | 목록·필터·정렬·페이지네이션·CSV를 M1에 우선 완성 |
| 2 | 가입자 정의 | **가입=계정생성(auth.users) / 활성=30일 내 활동** | 모든 집계의 분모 고정 (§3) |
| 3 | 운영 액션 | **핵심 쓰기 액션 포함** | super_admin 전용 + 감사 필수 (§9) |
| 4 | PII·감사 | **민감정보 super_admin 한정 + 열람 감사로그 신설** | `admin_access_log` 테이블 신규 (§8) |

**단계 요약 (의존성: M1 → M2 → M3·M4)**

- **M1 — 가입자 리스트(이번 1차 핵심):** DB 직접 keyset 페이지네이션 목록 + 필터 + 정렬 + 요약 지표 컬럼 + CSV. 검색은 기존 폼 흡수. 세그먼트 칩은 **프리셋 쿼리(UI+기본 로직)**까지 M1, 코호트 지표는 M2.
- **M2 — 세그먼트·코호트:** 신규/고지출/환불대상/구독활성/이탈위험/첫결제·첫사주 미완 + D7·D30 잔존율. **마케팅성 액션은 마케팅 동의 정책 신설(전제) 후**(§15).
- **M3 — 360 상세 재구성:** 기존 Phase 1 상세 6섹션 → 요약 헤더 + 6탭 + 누락 카테고리(가족·피드백·후기·예약·알림·동의) 연결. **서버측 마스킹 + 열람 감사** 포함.
- **M4 — 운영 쓰기 액션 + 감사 뷰:** 수동 크레딧 지급·구독 정지/취소·정책 재동의 강제·일괄 환불요청 + `admin_access_log` + `/admin/users/audit`.

**병행 컴플라이언스 워크스트림 (사용자 확정 2026-06-06)**

- **C1 — 마케팅 동의 수집(M2 선행):** `policy_versions`에 `marketing` kind 추가 + 가입/설정 화면 명시 수집. **M2의 마케팅성 액션은 이 수집 완료 후** 동의자 한정으로만.
- **C2 — 개인정보 보유기간·파기 정책 수립:** 탈퇴자 데이터 보유기간·법령 보관 예외·자동 파기 배치. M단계와 병행하는 별도 정책 스펙.
- **요약 갱신 주기: 매시간**(Vercel Cron) 확정.

---

## 1. 배경 & 현행 진단

### 1-1. 현행 상태 (검증 완료)

| 항목 | 현황 | 근거 |
|---|---|---|
| 진입 | `/admin/operations` 허브 → "사용자 조회" | `admin/users/page.tsx` `backHref="/admin/operations"` |
| 목록 | **없음.** 검색어 있을 때만 결과 표시 | `page.tsx`: `query ? await searchAdminUsers(query) : []` |
| 검색 | 이메일 부분일치 / UUID 정확일치 | `searchAdminUsers` (`user-detail.ts`) |
| 천장 | `auth.admin.listUsers({perPage:200})` 첫 200명 **클라이언트 필터** → 그 밖 누락 | `user-detail.ts` |
| 상세 | `/admin/users/[id]` 6섹션 읽기전용(회원·사주·결제·AI챗·LLM·환불) | `getAdminUserDetail`(~10회 순차 쿼리) — **기존 Phase 1 산출, 유지·계승** |
| 쓰기 | 환불 워크플로(요청→승인)만 존재, 상세 화면 안에 갇힘 | `refund-actions.tsx`, `refund-service.ts` |
| 가드 | `/admin/*` 서버 가드 + `admin_users` 화이트리스트 + service_role(RLS 우회) | `admin/layout.tsx`, `admin-auth.ts` |

> **기존 Phase 1(상세, 구현됨) ↔ 본 설계(M단계)의 경계:** 기존 Phase 1은 "1명을 정확히 알 때 들여다보는 상세 페이지"를 만들었다. 본 설계는 그 위에 **목록(M1)·세그먼트(M2)·운영(M4)**을 얹고, 상세는 **M3에서 탭 구조로 재구성**한다. 즉 신설이 아니라 **확장**이다.

### 1-2. 재활용 자산 (신설 최소화)

| 자산 | 위치 | 재활용 방식 |
|---|---|---|
| `getAdminUserDetail` | `src/lib/admin/user-detail.ts` | 단일 상세는 그대로. 목록은 N+1 회피 위해 배치 집계로 별도 |
| `searchAdminUsers` | 동상 | 빠른검색(이메일/UUID) 프레임 유지. 목록 페이지네이션은 DB 직접 쿼리로 신설 |
| `extractPalja`, `buildUserLlmStats`, `determineRefundEligibility` | 동상(순수함수, `user-detail.test.ts` 고정) | 상세·세그먼트에 그대로 |
| `buildPaymentHistory`, `mapProductEntitlementToHistory`, `resolveProductEntitlementName`, `isCashCreditTransaction` | `src/lib/billing/payment-history.ts` (`payment-history.test.ts` 고정) | **LTV(`totalSpentWon`)·결제뷰** 즉시 |
| `determineCreditRefundEligibility`, `buildCreditRefundItem` | `src/lib/admin/credit-refunds.ts` | 환불 세그먼트 필터 |
| `nextRefundStatus`, `executeRefund` | `src/lib/admin/refund-service.ts` (`refund-service.test.ts` 고정) | 환불 큐/대량처리(상태머신·역할게이트) |
| `buildOperationsSnapshot`, `DailySeries` | `src/lib/admin/operations-stats.ts` | 코호트·전사지표 cross-link |
| `toLocalDateKey`(KST) | 동상 | ⚠️ **현재 미export(파일 내부 함수).** 코호트 집계에 쓰려면 구현 시 `export` 추가 필요 |
| `buildPaymentFunnelSnapshot` | `src/lib/admin/payment-funnel-stats.ts` | 개인 funnel(`user_id` 필터) |
| `isAdminUser`, `getCurrentAdminRole`, `getAdminRole` (5분 TTL) | `src/lib/admin-auth.ts` | 신규 화면·API·액션 권한게이트 |
| `admin/layout.tsx` 서버 가드 | `src/app/admin/layout.tsx` | 상속 |
| `hashUserId` | `src/server/ai/llm-telemetry.ts` | `ai_llm_runs` 매칭(근사 한계 동반) |
| 상품 표시명 lookup | `src/content/report-catalog.ts` / billing catalog | `product_id` → UI 이름 |
| `GangiPageHeader`, `AppShell`, `AppPage`, `fmtDate` | `components/gangi/gangi-ui.tsx`, `shared/layout/app-shell.tsx` | 레이아웃 일관성 |

---

## 2. 설계 원칙 & 4대 결정 근거

1. **확장이지 신설이 아니다.** ~20개 admin 대시보드가 이미 있다. 가입자 대시보드는 그것들의 **개인 단위 렌즈**이며 전사지표(`operations`)·환불(`refund`)·LLM비용(`llm-cost`)과 **cross-link**으로 연결한다.
2. **리스트 우선(결정 1).** 사용자 1차 요청("가입한 사람들의 리스트")에 직결. 세그먼트·상세·운영액션은 같은 데이터 위에 쌓는다.
3. **분모를 먼저 고정(결정 2).** "가입자 = 현존 `auth.users` 행", "활성 = 최근 30일 내 활동". 모든 지표·세그먼트가 공유(§3).
4. **쓰기·민감열람은 강하게 통제(결정 3·4).** super_admin 전용 + 감사 + idempotency + 역할게이트. **마스킹·필터링은 서버측에서** 수행(클라이언트로 원천 데이터 내려보내지 않음).
5. **성능을 처음부터 설계.** 목록 지표는 N+1(100명×10쿼리) 즉시 문제 → **요약 테이블 + 배치**.
6. **측정 한계·법적 의무를 숨기지 않는다.** 소급 결손(`ai_llm_runs` 2026-05-25~, `chapter_feedback` 2026-05-20~), 근사 매칭, 보유·파기 의무를 명시(§12·§15).

---

## 3. 핵심 개념 — 측정 언어 (분모 확정)

| 용어 | 정의 (이 대시보드 공식) | 소스 |
|---|---|---|
| **가입자(member)** | 현존 `auth.users` 행 1개 = 가입자 1명(소셜 포함). 탈퇴 시 물리 삭제되어 목록에서 사라짐(아래 주의) | `auth.users` |
| **활성회원(active)** | 최근 30일 내 `last_sign_in_at` OR `readings`/`dialogue_messages`/`payment_orders`/feedback 중 1건+ | `auth.users` + 활동 max |
| **휴면(dormant)** | 비활동 30일 초과 (활성의 여집합) | 위 |
| **이탈위험(at-risk)** | 휴면 & 누적 결제>0 (살릴 가치 있는 휴면) | 위 + `payment_orders` |
| **신규(new)** | `created_at` ≤ 7일 / ≤ 30일 (2버킷) | `auth.users.created_at` |
| **프로필 완성** | `profiles.birth_year`·`gender` non-null | `profiles` |
| **LTV** | 누적 결제액(₩) `buildPaymentHistory.totalSpentWon` | `payment_orders`/`product_entitlements` |
| **ARPU** | LTV / fulfilled 결제 건수 | `payment_orders` |
| **DTFP** | 가입→첫 결제 소요일 | `created_at` vs 첫 결제 |
| **비활동일** | now − max(last_sign_in, last_seen, 최근 활동) | 복수 소스 max |
| **환불 가능액** | 활성 entitlement + 환불 가능 코인(₩) | `determineRefundEligibility` + `determineCreditRefundEligibility` |
| **구독 상태** | `subscriptions.status` ∈ {`active`,`cancelled`,`expired`} (DB CHECK). **"구독 없음"=`subscriptions` 행 부재**(`none`은 DB 값 아님) | `subscriptions` |
| **요금제(plan)** | 앱레벨 값: `monthly`(레거시)·`plus_monthly`·`premium_monthly`. **DB CHECK 없음** → 표시는 catalog 매핑, 미지정 plan은 원문 표기 | `subscriptions.plan` + catalog |

> ⚠️ **탈퇴 회원:** 현행 `/api/account/delete`는 `auth.users`를 **물리 삭제**(`auth.admin.deleteUser`)하고 타 테이블은 `ON DELETE CASCADE` 또는 익명화. 따라서 "가입자"는 **현존 계정만** 집계되며, 탈퇴 이력은 목록에 없다. 탈퇴 이력 추적·"탈퇴 회원" 필터가 필요하면 **soft-delete(`deleted_at`) 도입은 M5 후속**(§15). 코호트 잔존율도 "현존 계정 기준"임을 UI에 명시.
> ⚠️ **활성의 last_seen 보조 소스**(`notification_preferences.last_seen_at`)는 알림 켠 사용자만 갱신 → 1차 기준은 `last_sign_in_at` + 행위 테이블 max, last_seen은 보조.

---

## 4. 정보구조(IA) & 화면

### 4-1. 사이트맵

```
/admin/operations                  (기존 허브 — 진입 카드 보강)
└─ /admin/users                    [M1] 가입자 리스트 (전체·필터·정렬·CSV)
   ├─ ?q=…                         (기존 빠른검색 흡수)
   ├─ ?segment=at-risk …           [M1 프리셋 / M2 코호트지표] 세그먼트는 목록 프리셋으로 흡수
   ├─ /admin/users/segments        [M2] 세그먼트 개요(코호트 지표 카드)
   └─ /admin/users/[id]            [M3] 가입자 360 상세 (요약 헤더 + 6탭) — 기존 Phase 1 계승
      └─ (탭6) 운영 액션            [M4] 크레딧 지급·구독제어·재동의·환불
/admin/users/audit                 [M4] 개인정보 열람·운영 감사로그 뷰 (super_admin)
```

### 4-2. `/admin/users` — 가입자 리스트 (M1 핵심)

```
┌─ 가입자 관리 ───────────────────  [가입 1,240 · 활성(30d) 612] ─┐
│ 🔍 [이메일 / UUID 빠른검색…........]            [CSV 내보내기 ↓] │
│ 세그먼트: (신규7) (신규30) (고지출) (환불대상) (구독중) (이탈위험)│
│ 필터: 회원상태[활성/휴면] 가입일[범위▾] 결제[있음/없음/₩범위]    │
│       구독[상태▾] 상품보유[▾] 가입경로[email/google/kakao]     │
│       비활동[≥N일] 프로필[완성/미완]                            │
│ 정렬: [가입일↓ ▾] (LTV↓ · 마지막활동↓ · 결제건수↓)              │
├──────────────────────────────────────────────────────────────┤
│ 표시명/이메일      가입일   LTV     결제 구독  최근활동  배지     │
│ 김OO  a***@e***   05-30   ₩39,000  3건  —     2일 전   [환불]   │
│ 이OO  b***@e***   05-29   ₩0       0건  Plus  어제     [신규]   │
│ …                                                              │
│                                  ‹ 이전  다음 ›  (keyset)       │
│ ⓘ 지표 기준: 2026-06-06 14:00 (배치 1시간 전)                   │
└──────────────────────────────────────────────────────────────┘
```

- **컬럼(요약 — 배치 집계):** 표시명·이메일(일반 admin은 마스킹), 가입일, LTV(₩), 결제 건수, 구독 상태, 보유 코인, 마지막 활동(상대시간), 상태 배지(신규/구독중/환불대상/이탈위험), 가입경로 아이콘.
  - **표시명 fallback:** `profiles.display_name` → 없으면 이메일 local-part(`a***`) → 없으면 `user_id` 앞 8자.
- **필터(쿼리스트링 SSR):** 회원상태(활성/휴면), 가입일 범위, 결제 유무·금액대, 구독 상태, 상품 보유(`product_id`), 가입경로(provider), 비활동일(≥N), 프로필 완성. **로직: 모든 필터 AND 결합, 다중값 필터는 IN, 미선택=전체 포함**(§7-3).
- **정렬:** 가입일↓(기본)·LTV↓·마지막활동↓·결제건수↓. keyset 안정성 위해 동률 tie-break `user_id`.
- **페이지네이션:** **keyset** `(정렬키, user_id) < 커서`. `auth.admin.listUsers` 폐기 → 200명 천장 해소.
- **빈 상태 UX:** 검색·필터 0건 → `[필터 초기화]` + "조건을 바꾸거나 세그먼트를 눌러보세요" + 추천 세그먼트 칩. 인원 0명 세그먼트 칩은 회색 비활성 + 카운트(0) 표기.
- **CSV 내보내기:** 현재 필터·정렬 결과 export. **상한 5,000행/요청**(초과 시 필터 좁히도록 안내), API 타임아웃 30초 초과 시 비동기 작업 ID 반환. **PII 컬럼(이메일·생년월일)은 super_admin 한정 + `export_csv` 감사**, 일반 admin은 비식별 컬럼만.

### 4-3. `/admin/users/[id]` — 가입자 360 상세 (M3, 기존 Phase 1 계승)

```
┌─ 김OO  (a***@e***.com)  ───────────────────────────────────┐
│ 가입 2026-05-12 (25일째) · 활성 · 마지막 3일 전 · 경로 google │
│ LTV ₩39,000 (3건) · 코인 5(만료임박 2) · 구독 없음 · 환불 ₩9k │
│ ⚠ 이 화면 열람은 감사로그에 기록됩니다 (super_admin: 전체표시) │
├─[회원·프로필][사주·콘텐츠][결제·크레딧][활동·참여][LLM·비용][환불·운영]─┤
│ ▸ 결제·크레딧  (실시간 재조회)                                │
│   결제 이력: 평생리포트 ₩9,900 · 올해 핵심 3줄 ₩3,900 …        │
│   코인: 보유 5 · 구독지급 0 · 만료임박(7일) 2 · 사용률 62%      │
│   구독: 없음(행 부재)                                         │
└──────────────────────────────────────────────────────────────┘
```

**탭 구성(기존 6섹션 재배치 + 누락 카테고리 연결).** ⚠️ **서버측에서 역할별 필드 필터링** — 일반 admin에게는 super 전용 필드를 응답에서 제거(HTML/DevTools 노출 방지):

| 탭 | 내용 | 소스 | admin 열람 |
|---|---|---|---|
| 1 회원·프로필 | 계정(이메일·가입일·경로·인증), 생년월일시·성별·출생지·상황, **가족 프로필**, **정책 동의 현황**(재동의 필요는 `policy_versions` JOIN) | `auth.users`,`profiles`,`family_profiles`,`user_policy_consents`⋈`policy_versions` | 마스킹(이메일·생년월일 가림) |
| 2 사주·콘텐츠 | 팔자 8글자(`extractPalja`), 조회수·시주 입력률, 주제별 AI풀이, 오늘운세 유료해금 | `readings`,`ai_interpretations`,`today_fortune_result_snapshots` | 가능(사주는 비PII성↑) |
| 3 결제·크레딧 | 결제 이력(`buildPaymentHistory`), 코인 잔액·만료임박·사용률, 구독·entitlement | `payment_orders`,`user_credits`,`credit_lots`,`subscriptions` | 합계만(영수증 상세는 super) |
| 4 활동·참여 | AI챗 **건수·메타만**, **피드백·만족도**, **후기·예약**, **알림 CTR** | `dialogue_messages`,`*_feedback`,`reviews`,`appointments`,`notification_*` | 건수/집계만 |
| 5 LLM·비용 | feature별 호출·캐시 hit·누적비용(`buildUserLlmStats`) — **근사 표기** | `ai_llm_runs` | 가능(저PII) |
| 6 환불·운영 | 환불 가능여부·요청큐(`refund-actions` 재배치) + **운영 액션(M4)** | `refund_requests` + 신규 액션 | 환불요청(admin)/승인·액션(super) |

> **대화(dialogue) 열람 원칙(모순 해소):** **원문 텍스트는 admin·super 누구도 기본 비노출.** super_admin은 **메타(시각·상담사·세션 수·fallback율)**까지, 일반 admin은 **건수만**. 원문 열람은 본 스코프 **비목표**(§14).

### 4-4. 세그먼트 (M2)

세그먼트 = **목록의 명명된 프리셋**(M1에서 칩+기본 필터 제공). `/admin/users/segments`는 **코호트 지표 카드**(M2) 개요:

| 세그먼트 | 기준 | 1차 액션 |
|---|---|---|
| 신규(7/30일) | `created_at` | 온보딩 상태 점검 |
| 고지출 | LTV ≥ 임계(₩) | VIP 관리 |
| 환불대상 | 환불 가능 entitlement/코인 > 0 | 환불 큐 |
| 구독활성 | `subscriptions.status='active'` | 갱신·이탈 모니터 |
| 이탈위험 | 휴면 & LTV>0 | 인앱 배지/추천 + **마케팅 발송**(C1 동의 수집 완료 후, **동의자 한정** — §15-1) |
| 첫결제 미완 | 가입 후 결제 0 & 활성 | 전환 유도(인앱) |
| 첫사주 미완 | 가입 후 `readings`=0 | 활성화 유도(인앱) |

코호트 지표: 가입 월 기준 **D7/D30 잔존율**(활성 정의는 §3과 **동일**: 가입 후 7/30일 시점 ±윈도우 내 활동 1건+), 평균 LTV, 인원. **현존 계정 기준**(탈퇴 제외) + 소급 결손 표기.

### 4-5. 운영 액션 (M4)

상세 탭6 + 세그먼트 대량 액션. 전부 **super_admin 전용 + 감사 + idempotency**. §9 상세.

---

## 5. 가입자 360 데이터 인벤토리 (14 카테고리)

> PII 등급 = 열람 통제(결정 4)의 기준.

| # | 카테고리 | 핵심 필드 | 소스 테이블 | PII |
|---|---|---|---|---|
| 1 | 계정·인증 | user_id, email, 인증상태, 가입일, 마지막 로그인, 경로(provider), admin 역할 | `auth.users`,`admin_users` | **high** |
| 2 | 프로필·사주기본 | 생년월일시분, 성별, 출생지, 력/시간규칙, 선호상담사, 기본상황, 메모 | `profiles` | **high** |
| 3 | 가족·관계 | 가족 수, 관계유형, 각 생년월일·성별 | `family_profiles` | **high** |
| 4 | 사주 조회·콘텐츠 | 조회수, 고유사주, 팔자, 시주입력률, AI풀이 수, 오늘운세 해금 | `readings`,`ai_interpretations`,`ai_yearly_interpretations`,`today_fortune_result_snapshots` | **high** |
| 5 | AI 대화 | 메시지 수, 세션 수, 상담사 선호, 진입경로, fallback율 (**원문 비노출**; admin=건수, super=메타) | `dialogue_messages` | **high** |
| 6 | 결제·매출 | LTV, 결제 건수, ARPU, 결제이력, 최근 funnel 단계, 첫결제 소요일 | `payment_orders`,`product_entitlements`,`credit_transactions`,`payment_funnel_events` | **high** |
| 7 | 크레딧·코인 | 보유/구독/만료임박 코인, 사용률, 거래이력, 가입보너스 소진 | `user_credits`,`credit_lots`,`credit_transactions` | medium |
| 8 | 구독·권한 | 구독 상태(active/cancelled/expired·행부재=없음), 요금제(앱레벨), 갱신일, 보유 상품권한, 빌링키 보유(키 비노출) | `subscriptions`,`product_entitlements` | medium |
| 9 | 환불 | 환불 가능액, 요청 상태(requested/processing/completed/failed/revoke_pending/rejected), 사유, 요청/승인자, Toss 응답 | `refund_requests`,`credit_lots`,`product_entitlements` | **high** |
| 10 | LLM 비용 | feature별 호출·캐시 hit율·누적비용·토큰 (**근사** — §12) | `ai_llm_runs` | low |
| 11 | 피드백·만족도 | 오늘운세 평가, AI상담 정확도(accuracy_label/score), 챕터 별점(rating/helpful_bool), 자유코멘트(comment, 비식별 처리) | `today_fortune_feedback`,`fortune_feedback`,`chapter_feedback` | medium |
| 12 | 후기·예약 | 후기 수·별점·검증구매(is_verified_purchase)·심의상태(pending/approved/rejected), 예약 건수·상태·선생님 | `reviews`,`appointments` | medium |
| 13 | 알림·참여 | 알림 설정, 마지막 조회(last_seen_at), 활성 기기(is_active), 발송·CTR(clicked_at, variant A/B/C), follow 별자리(slug) | `notification_preferences`,`push_subscriptions`,`notification_delivery_logs`,`star_sign_favorites` | medium |
| 14 | 정책 동의 | 동의 버전·시각·방법(consent_method)·UA·IP해시. **재동의 필요는 `policy_versions.requires_reconsent`를 JOIN으로 판정**. **마케팅 동의 미수집(갭)** | `user_policy_consents` ⋈ `policy_versions` | medium |

---

## 6. 지표 사전 (Metric Dictionary)

| 지표 | 공식 / 소스 | 신선도 | 한계 |
|---|---|---|---|
| 가입 경과일 | now − `created_at` | 실시간 | — |
| 마지막 활동·비활동일 | now − max(last_sign_in, readings/dialogue/feedback) | 배치 | last_seen 보조 |
| LTV(₩) | `buildPaymentHistory.totalSpentWon` | 배치 | — |
| 결제 건수·ARPU | `payment_orders` fulfilled | 배치 | — |
| 코인(보유/구독/만료임박) | `user_credits.balance` + `credit_lots(expires_at≤now+7d)` | 상세=실시간 | 목록=배치(불일치 배지) |
| 코인 사용률 | (초기−잔여)/초기 | 배치 | — |
| 구독 상태·요금제·갱신일 | `subscriptions` | 실시간 | plan은 앱레벨 |
| 환불 가능액·상태 | `determineRefundEligibility` + `refund_requests` | 실시간 | — |
| 사주 조회·고유·시주율 | `readings` | 배치 | — |
| AI챗 메시지·세션 | `dialogue_messages` count | 배치 | 내용 비노출 |
| LLM 비용·캐시율 | `buildUserLlmStats`(`ai_llm_runs`) | 배치 | **2026-05-25~, 커버리지 근사**(§12) |
| 피드백 응답률·만족도 | `*_feedback` | 배치 | `chapter_feedback` 2026-05-20~ |
| 프로필 완성도 | `profiles` non-null | 실시간 | — |
| DTFP | `created_at` vs 첫 결제 | 배치 | — |
| 결제 funnel 단계 | `payment_funnel_events`(user_id 필터) | 배치 | user_id NULL 제외 |
| 가입 경로 | provider / signup_source | 실시간 | — |
| 후기·예약 | `reviews`,`appointments` | 배치 | — |
| 푸시 CTR | `notification_delivery_logs.clicked_at` | 배치 | — |
| 정책 동의 최신성 | `user_policy_consents` ⋈ `policy_versions.requires_reconsent` | 실시간 | — |
| **코호트 잔존율 D7/D30** | 가입 코호트 × 활성(§3 정의) | **신규 집계** | 소급 결손·현존 계정 기준 표기 |

---

## 7. 데이터 레이어 & 성능 아키텍처

### 7-1. 문제
- 목록 지표 표시 시 사용자당 ~10쿼리 → 100명 = 1000쿼리(N+1).
- email은 `auth.users`에만 있어 `profiles` 단독 검색·정렬 불가.

### 7-2. 해결 — 요약 테이블 `admin_user_summary`(신규)

```sql
-- 049_admin_user_summary.sql (스케치 — 구현 시 확정)
CREATE TABLE admin_user_summary (
  user_id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email            TEXT,            -- auth.users 미러(검색·정렬용)
  display_name     TEXT,
  signup_at        TIMESTAMPTZ,
  signup_provider  TEXT,
  profile_complete BOOLEAN,
  last_active_at   TIMESTAMPTZ,     -- max(last_sign_in, readings, dialogue, feedback)
  ltv_won          BIGINT DEFAULT 0,
  paid_count       INT  DEFAULT 0,
  first_paid_at    TIMESTAMPTZ,
  credit_balance   INT  DEFAULT 0,
  credit_expiring  INT  DEFAULT 0,
  subscription_status TEXT,         -- active|cancelled|expired (행부재=없음)
  refundable_won   BIGINT DEFAULT 0,
  reading_count    INT  DEFAULT 0,
  chat_count       INT  DEFAULT 0,
  llm_cost_usd     NUMERIC(12,4) DEFAULT 0,  -- 근사
  refreshed_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON admin_user_summary (signup_at DESC, user_id);
CREATE INDEX ON admin_user_summary (ltv_won DESC, user_id);
CREATE INDEX ON admin_user_summary (last_active_at DESC, user_id);
CREATE INDEX ON admin_user_summary (email text_pattern_ops);

-- RLS: 앱 사용자 전면 차단(서비스롤만 접근). admin API는 service_role 클라이언트로만 조회.
ALTER TABLE admin_user_summary ENABLE ROW LEVEL SECURITY;
-- (정책 미생성 = 기본 deny. service_role 은 RLS 우회하므로 정책 불필요)
```

**갱신 전략(하이브리드):**
- **(A) 배치 — 확정.** `refresh_admin_user_summary()` RPC를 **매시간 Vercel Cron**(`0 * * * *`)로 호출. `auth.users`·활동·결제 테이블을 join해 전 행/변경분 재계산하며 `email`·`last_active_at`·`ltv_won` 등 갱신. UI에 `refreshed_at` 표기. (1차 전수 재계산 비용이 커지면 변경분 증분으로 전환.)
- (B) 이벤트 증분(후속). 결제/리딩/로그인 시 해당 user 행만 갱신.
- **민감·휘발 컬럼(코인·구독·환불 가능액)은 상세 진입 시 라이브 재조회** → 목록(배치)과 상세(실시간) 값이 다를 수 있어 **목록엔 "배치 N분 전" 배지, 상세엔 "실시간 재조회" 라벨**로 차이를 명시(혼동 방지).

### 7-3. 검색·정렬·페이지네이션·필터 로직
- 목록·정렬·필터 = `admin_user_summary` 직접 쿼리(service_role).
- 검색 = email/display_name `ILIKE`(요약 테이블), UUID는 PK. `auth.admin.listUsers` 폐기.
- keyset: `ORDER BY (정렬키, user_id)` + `WHERE (정렬키, user_id) < :cursor`.
- **필터 결합:** 모든 필터 **AND**. 다중값(가입경로 등)은 **IN**. 미선택 필터는 절에서 생략(=전체 포함). 빈 결과는 빈 상태 UX(§4-2).

### 7-4. email 미러 동기화
`admin_user_summary.email`은 `auth.users.email` 미러. 1차는 **배치 refresh의 join 갱신**(단순). 이메일 변경 직후~다음 배치까지 구 이메일로 검색되는 지연 존재 → 신선도 배지로 수용. 실시간성 필요 시 후속으로 auth webhook/트리거.

---

## 8. 권한 · PII · 감사 (보안 설계)

### 8-1. 역할 모델(기존 `admin-auth` 활용)
- `admin` : 목록·세그먼트·비식별 지표. 민감 PII는 **서버측 마스킹**.
- `super_admin` : 민감 PII 열람 + 운영 쓰기 액션. **모든 민감 열람·액션 감사**.
- 게이트: `getCurrentAdminRole`/`getAdminRole`(5분 TTL) 재사용. **모든 신규 `/api/admin/*`는 라우트 진입 즉시 역할 검증**(§10·§13 AC).

### 8-2. PII 마스킹 정책 (서버측 수행)

| 필드 | admin | super_admin |
|---|---|---|
| 이메일 | `a***@e***.com` | 전체 |
| 생년월일시 | 연도만/가림 | 전체 |
| 대화(dialogue) 원문 | **비노출** | **비노출**(원문은 누구도 안 봄) |
| 대화 메타(시각·상담사·세션수) | 건수만 | 메타까지 |
| 결제 영수증·상세 | 합계만 | 상세 |
| 가족 프로필 | 수만 | 상세 |
| IP해시·UA | 가림 | 표시 |

> **구현 원칙:** 마스킹·필드 제거는 **서버(SSR/Route Handler)**에서 수행. super 전용 필드는 admin 응답·HTML에 **애초에 포함하지 않는다**(DevTools 노출 차단). `src/lib/admin/masking.ts`(신규): `maskEmail(email, role)`, `maskBirthDate(y,m,d, role)` 등 + 단위테스트(TDD).

### 8-3. 감사 로그 `admin_access_log`(신규)

```sql
-- 050_admin_access_log.sql (스케치)
-- 보유기간: 기본 12개월 후 purge. 단 환불/환급 감사는 전자금융 관련 법령상 장기보관 검토(별도 archive).
CREATE TABLE admin_access_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,        -- view_detail | view_pii | export_csv | grant_credit | revoke_credit | suspend_sub | cancel_sub | force_reconsent | refund_request | refund_approve | batch_refund_request | purge_deleted_user
  target_user UUID,
  reason      TEXT,                 -- 마스킹 해제/액션 사유
  meta        JSONB,                -- 액션 파라미터(금액·건수·dryRun 등)
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON admin_access_log (target_user, created_at DESC);
CREATE INDEX ON admin_access_log (actor_id, created_at DESC);
ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;  -- service_role write, super_admin read
```

- 기록 시점: 상세 진입(`view_detail`), 마스킹 해제(`view_pii`+사유), CSV export, **모든 쓰기 액션**.
- 조회 UI: `/admin/users/audit`(super_admin) — actor/target/기간 필터.
- 기존 `refund_requests.requested_by/approved_by`도 이 뷰에 통합 노출.

### 8-4. 보안 구현 체크리스트 (MUST — 모든 신규 API/화면 공통)
- [ ] 라우트 진입 즉시 `getCurrentAdminRole` 검증. 부족 시 403/redirect.
- [ ] super 전용 데이터는 **서버에서 제거 후** 응답(클라이언트로 원천 미전송).
- [ ] 민감 열람·모든 쓰기 액션에 `admin_access_log` 기록.
- [ ] 쓰기 액션 idempotency 키(중복/리플레이 방지).
- [ ] 테스트: `admin` 역할로 super 전용 라우트 호출 시 **403** 확인.
- [ ] CSV/대량 응답: PII 컬럼 화이트리스트 + 행 상한 + 감사.

---

## 9. 운영(쓰기) 액션 카탈로그 (M4)

> 전부 super_admin 전용 · 확인 모달 · idempotency · `admin_access_log` 기록 · 기존 서비스 재사용 우선.

| 액션 | 동작 | 재사용/신규 | 안전장치 |
|---|---|---|---|
| 수동 크레딧 지급/회수 | `credit_transactions`(type=`admin_grant`/`admin_revoke`)·`credit_lots` 발급 | 신규(기존 credit 함수 패턴, `044`/`015` idempotency 준수) | 사유 필수·idempotency·일일 한도 |
| 구독 일시정지/취소 | `subscriptions.status` 변경 (Toss 빌링키 해지 연동은 별도 검토 — §15) | 일부 신규 | 환불·정산 영향 경고 |
| 정책 재동의 강제 | `policy_versions.requires_reconsent=true`(해당 정책) | 신규 | 영향 사용자 수 표시 |
| 환불 요청/승인 | `refund-service`(요청→승인 상태머신) | **재사용** | 역할게이트 기존 |
| 일괄 환불요청(세그먼트) | `POST /batch-refund {userIds, dryRun}`. **dryRun=true(영향 건수, admin 가능) → dryRun=false 실제 enqueue(super 전용)** | 신규(서비스 루프) | 건수 상한(예 1,000)·드라이런·감사 |
| (보류) 프로필 편집 | `profiles` 수정 | 신규 | **M4 후순위** — 데이터 정합 리스크, 별도 승인 |

> **idempotency**: 기존 결제/크레딧 패턴(`044_credit_payment_idempotency`, `015_idempotent_credit_unlocks`) 준수.

---

## 10. API / 라우트 설계 (역할게이트 명시)

| 경로 | 메서드 | 역할 | 비고 |
|---|---|---|---|
| `/admin/users` (page) | SSR GET | admin | 목록·필터·정렬·세그먼트(쿼리스트링). 응답 마스킹 서버측 |
| `/api/admin/users/list` | GET | admin | keyset 페이지(JSON). admin이면 마스킹 필드만 |
| `/api/admin/users/export` | GET | admin / **super(PII 컬럼)** | CSV. 행 상한·타임아웃. `export_csv` 감사 |
| `/admin/users/[id]` (page) | SSR GET | admin | 360 상세. 진입 시 `view_detail` 감사. super 전용 필드 서버 제거 |
| `/api/admin/users/[id]/pii` | POST | **super** | 마스킹 해제(사유) → `view_pii` 감사 |
| `/api/admin/users/[id]/credit` | POST | **super** | 크레딧 지급/회수 + idempotency + 감사 |
| `/api/admin/users/[id]/subscription` | POST | **super** | 구독 제어 + 감사 |
| `/api/admin/users/[id]/reconsent` | POST | **super** | 재동의 강제 + 감사 |
| `/api/admin/users/batch-refund` | POST | admin(dryRun) / **super(실행)** | 일괄 환불요청 |
| `/api/admin/refund` (기존) | POST | admin/super | 환불 요청·승인(재사용) |
| `/admin/users/audit` (page) | SSR GET | **super** | 감사로그 뷰 |
| `/api/admin/users/summary/refresh` | POST/Cron | service | 요약 테이블 갱신 |

---

## 11. 신설 마이그레이션 (수동 적용)

> `supabase` CLI 수동 push 필요(자동배포 아님).

1. `049_admin_user_summary.sql` — 요약 테이블 + 인덱스 + RLS(deny) + `refresh_admin_user_summary()` RPC.
2. `050_admin_access_log.sql` — 감사 로그 + 인덱스 + RLS + 보유기간 주석.
3. (M4) `051_admin_credit_actions.sql` — `credit_transactions.type` 확장(`admin_grant`/`admin_revoke`) + idempotency 유니크.
4. (C1) `052_marketing_consent.sql` — `policy_versions`에 `marketing` kind 시드 + 수집 경로(`consent_method`) 정의. 수집 UI는 가입/설정 화면(별도 작업).
5. (C2) `053_data_retention.sql` — 탈퇴자 파기 배치 RPC(`purge_deleted_user_data()`) + 법령 보관 예외 테이블 화이트리스트. (정책 확정 후)
6. Vercel Cron 등록(`vercel.ts` crons): 요약 갱신 `0 * * * *`(매시간) + 파기 배치 월 1회.

---

## 12. 측정 한계 · 리스크 · 가정

| 항목 | 한계/리스크 | 대응 |
|---|---|---|
| LLM 비용 매칭 | `ai_llm_runs.user_id_hash`(SHA256 prefix) **충돌은 사실상 무시 가능**, 다만 비로그인/소급분 NULL → **커버리지 근사** | UI "약(근사)" 배지, "데이터 시작일(2026-05-25)" 표기, 정확비용 비주장 |
| 소급 데이터 결손 | `ai_llm_runs` 2026-05-25~, `chapter_feedback` 2026-05-20~ | "데이터 시작일" 표기, 코호트 보정 |
| 요약 신선도 | 배치 지연(**최대 1시간** — 매시간 Cron) + 목록/상세 불일치 | `refreshed_at` 배지 + 휘발 컬럼 상세 라이브 재조회 |
| 가입자 정합 | `auth.users` vs `signup_bonus` vs `profiles` 불일치 가능 | 분모는 현존 `auth.users` 단일 기준(결정 2·§3) |
| 탈퇴 회원 | 물리 삭제로 목록에서 사라짐 / 타 테이블 익명화 잔존 | "현존 계정 기준" 명시, 이력 추적은 M5(soft-delete) |
| 소셜 로그인 | `profiles` 없이 로그인 가능 → "프로필 미완" | 완성도 컬럼으로 가시화 |
| PII 노출 | 집약 화면 자체가 고위험 | super 게이트 + **서버측 마스킹** + 감사(§8) |
| 마케팅 발송 | **마케팅 동의 미수집** | 캠페인 트리거는 동의 정책 신설 전까지 **비포함**(§15) |
| 대량 액션 | 오작동 시 광범위 영향 | 드라이런·건수상한·idempotency·감사 |
| 데이터 보유·파기 | 탈퇴자 데이터 보유기간/파기 절차 미비(PIPA) | §15 후속 정책 + 법령 보관 예외 식별 |
| Next 16 규약 | 학습데이터와 상이 | 구현 전 `node_modules/next/dist/docs` 확인(AGENTS.md) |
| `toLocalDateKey` 미export | 코호트 집계 재사용 차단 | 구현 시 `export` 추가(테스트 영향 확인) |

---

## 13. 단계별 로드맵 & 수용 기준(AC)

> 의존성: **M1 → M2 → (M3 ∥ M4)**. M1의 세그먼트 칩은 기본 프리셋(필터)만, 코호트 지표는 M2. M3 상세의 "환불·운영 탭"은 환불(기존)까지 M3, 신규 쓰기 액션은 M4.

### M1 — 가입자 리스트 (1차 핵심)
- 산출: `049` 요약 테이블 + refresh RPC, `/admin/users` 목록(필터·정렬·keyset·빈상태), `/api/admin/users/list`·`/export`, 빠른검색 통합, `masking.ts`.
- **기능 AC:** (1) 200명 천장 없이 전체 페이지네이션. (2) 가입일·LTV·마지막활동 정렬. (3) 필터(회원상태·가입일·결제·구독·상품·경로·비활동·프로필) AND 동작. (4) 목록 1페이지 쿼리 O(1)(N+1 아님). (5) CSV export + 행상한 + 타임아웃 처리. (6) `refreshed_at` 표기. (7) 빈 결과 UX.
- **보안 AC:** (8) `/api/admin/users/list`·`/export` 역할게이트. (9) 일반 admin 응답은 **서버측 마스킹**(이메일/생년월일). (10) export PII 컬럼 super 한정 + `export_csv` 감사.
- TDD(순수): keyset 커서 인코딩/디코딩, 필터→WHERE 빌더, `maskEmail`/`maskBirthDate`.

### M2 — 세그먼트·코호트
- 산출: `?segment=` 프리셋 7종, `/admin/users/segments` 개요, D7/D30 잔존율(`operations-stats` 패턴 확장, `toLocalDateKey` export).
- **선행:** C1(마케팅 동의 수집) — 마케팅 발송형 액션의 전제.
- **AC:** 세그먼트별 인원·평균 LTV·잔존율(현존 계정·소급결손 표기), 클릭 시 목록 프리셋 진입, 0명 세그먼트 비활성 표기. 마케팅 발송은 C1 완료 후 **동의자 한정**(미완 시 인앱 액션만).

### M3 — 360 상세 재구성
- 산출: 요약 헤더 + 6탭, 누락 카테고리(가족·피드백·후기·예약·알림·동의) 연결, 모바일 탭/아코디언.
- **AC:** 기존 6섹션 보존 + 신규 카테고리, 상세 진입 `view_detail` 감사, **super 전용 필드 서버 제거**, 대화 원문 비노출/메타만(super).

### M4 — 운영 액션 + 감사 뷰
- 산출: `050` 감사로그, `/admin/users/audit`, 크레딧 지급·구독제어·재동의·일괄 환불요청, `view_pii` 사유 해제, `051` credit type 확장.
- **AC:** 모든 쓰기 super 전용·idempotent·감사. 일괄 환불 2단계(dryRun→실행). 감사 뷰 actor/target/기간 조회. admin이 super 라우트 호출 시 403 테스트.

---

## 14. 비목표 (Out of Scope)

- 대화(`dialogue_messages`) **원문 열람** — 건수/메타만(PII 최소화).
- **회원 차단·제재(fraud/abuse)** — `admin_users`에 status 컬럼 없음. 회원 상태머신(active/suspended) 신설은 별도 정책·스펙(M5 후보).
- 마케팅/CRM 발송 트리거 — 동의 정책 선행(§15).
- 가입자 데이터 *대량* 정정/병합 — 별도 데이터 거버넌스.
- 전사 KPI 대시보드 신설 — 기존 `operations`·`llm-cost`·`payment-funnel` 재사용(cross-link만).
- 프로필 자유 편집 — M4 후순위, 정합성 검토 후.
- 탈퇴 이력 soft-delete·완전 파기 자동화 — M5 후속(§15).

---

## 15. 후속 · 미해결

> 1·2·3은 2026-06-06 사용자 확정. 별도 스펙으로 분리하되 M단계와 일정 연동.

1. **[확정·C1] 마케팅 동의 수집 도입 — M2 마케팅 발송 선행.** `052_marketing_consent.sql`로 `policy_versions`에 `marketing` kind 추가 + **가입/설정 화면에서 명시적 수집 UI**. 발송 전 `user_policy_consents ⋈ policy_versions(marketing)` **동의자만**, 비동의자 사전 차단 + 대상 COUNT vs 동의 COUNT 감사. → **C1 전용 스펙 착수 필요.**
2. **[확정·C2] 개인정보 보유기간·파기 정책 수립(PIPA).** 탈퇴자 익명화 데이터 보유기간 정의, 법령 보관 예외(전자상거래법 5년·전자금융 등) 테이블 화이트리스트, `purge_deleted_user_data()` 월 배치 + `admin_access_log('purge_deleted_user')`. 현행 `/api/account/delete` 동작을 기준선으로 정리. → **C2 전용 정책 스펙 착수 필요.**
3. **[확정] 요약 갱신 주기 = 매시간**(`0 * * * *`). 전수 재계산 비용 증가 시 증분 전환.
4. **구독 Toss 빌링 연동 깊이** — 취소 시 빌링키 해지까지 갈지(M4 내 별도 검토).
5. **CSV export 컬럼 화이트리스트** — PII 포함 범위·행상한(5,000) 최종 확정.
6. **`admin_access_log` 보유기간** — 기본 12개월 + 환불 감사 장기보관 분리 검토(C2와 연계).
7. **M5 후보** — 탈퇴 이력 soft-delete, 회원 차단/제재 상태머신.

---

## 부록 A. 현행 → 목표 매핑 한눈에

| 기능 | 현행 | 목표(M1~M4) |
|---|---|---|
| 전체 목록 | ❌ (검색만, 200천장) | ✅ keyset 전체 |
| 필터/정렬 | ❌ | ✅ 8필터(AND)·4정렬 |
| 세그먼트/코호트 | ❌ | ✅ 7세그·D7/D30 |
| 360 상세 | 6섹션 단일스크롤(Phase 1) | 요약헤더+6탭+신규 카테고리(M3) |
| 운영 쓰기 | 환불만 | 크레딧·구독·재동의·일괄(super+감사) |
| PII 통제 | 전 admin 동일 | super 한정 + **서버측 마스킹** |
| 감사 | ❌ | ✅ `admin_access_log` + 뷰 |
| 성능 | N+1 | 요약 테이블 + 배치(+상세 라이브) |
| 탈퇴·파기 | 물리삭제만 | 정책 명문화(M5/후속) |
