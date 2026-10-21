# 한 장짜리 랜딩 + 비회원 주문 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/saju-report` 한 장짜리 랜딩에서 로그인 없이 종합사주(29,900)·2027 신년운세(19,900)를 카드 또는 무통장으로 주문받고, 관리자가 외부 주문 PDF를 만들어 확인 후 문자·이메일 링크로 보낸다.

**Architecture:** 주문 업무 상태는 새 테이블 `report_orders`가 갖고, 카드 결제는 기존 `payment_orders`(user_id null 허용) + 나이스페이 return/fulfill/webhook 을 그대로 탄다. 풀이 생성은 기존 `generateExternalReport`·`generateExternalNewYearReport`·`saveExternalReport`, 손님 화면은 기존 `ExternalReportView` 를 재사용한다.

**Tech Stack:** Next.js(App Router, 이 저장소 버전 — `node_modules/next/dist/docs/` 확인), Supabase(service client), NicePay, Solapi 문자, Resend, vitest(`*.test.ts`) + node test(`*.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-10-21-one-page-landing-design.md`

## Global Constraints

- 화면·문구에 한자 금지(사진 이미지 예외는 사용자 결정). 시간대는 "자시(밤 11:30~자정)"처럼 한글+시각.
- 가격: 종합사주 1인 29,900원(정가 60,000원 취소선) · 2027 신년운세 19,900원(정가 40,000원 취소선). 청구 금액은 서버 카탈로그(관리자 가격 덮어쓰기 반영)만.
- 50대 이상: 본문 18px 이상, 버튼 높이 56px 이상, 대비 4.5:1 이상, 390px 가로 넘침 0.
- 주문자 이름·연락처·생년월일을 로그·퍼널·에러 응답에 남기지 않는다.
- 무통장 계좌 env: `REPORT_BANK_NAME`·`REPORT_BANK_ACCOUNT`·`REPORT_BANK_HOLDER`. 하나라도 비면 무통장 선택지 숨김·API 거부.
- 마이그레이션 운영 적용은 사용자 승인 후 supabase-ganji 로 수동.
- 검증 명령: `./scripts/with-node22.sh npm test`, `./scripts/with-node22.sh npm run test:spec`, `./scripts/with-node22.sh npx tsc --noEmit`.

## Review Focus

1. 카드 결제 후 return 이 실패해도(창 닫음·네트워크) 정산 크론이 fulfill 하면 `report_orders` 가 `paid` 로 바뀌어야 한다 → Task 4 의 fulfill 분기 테스트로 고정.
2. user_id 가 없는 주문이 나이스페이 취소 통보를 받으면 이용권 회수(user uuid '' 조회)로 무한 재전송되면 안 된다 → Task 4 웹훅 테스트.
3. 결과 링크: 틀린 토큰·`sent` 아닌 주문·보관기간 지난 주문은 모두 같은 "찾을 수 없음" → Task 7 테스트.
4. 같은 IP 연속 주문(스팸 무통장 주문) → Task 3 의 횟수 제한 테스트.
5. 음력 윤달·시간 모름·자시 두 칸 입력이 생성기 입력으로 올바르게 바뀌어야 한다 → Task 1 테스트.

---

### Task 1: 주문 도메인(순수 로직)

**Files:**
- Create: `src/lib/report-orders/report-order.ts`
- Test: `src/lib/report-orders/report-order.test.ts`

**Interfaces:**
- Produces:
  - `type ReportProduct = 'lifetime' | 'new-year'`
  - `REPORT_PACKAGE_BY_PRODUCT: Record<ReportProduct, 'report_lifetime' | 'report_new_year'>`
  - `type ReportPayMethod = 'card' | 'bank'`
  - `type ReportOrderStatus = 'pending_payment' | 'awaiting_deposit' | 'paid' | 'generated' | 'sent' | 'cancelled' | 'refunded'`
  - `HOUR_SLOTS: readonly { id: string; label: string; hour: string; minute: string }[]` — 14칸: `ja-night`(밤 11:30~자정, 23:45) · `ja-early`(자정~새벽 1:29, 00:45) · 축(01:30~03:29, 02:30) … 해(21:30~23:29, 22:30) · `unknown`(모름)
  - `parseReportOrderForm(payload: unknown): { ok: true; order: ReportOrderInput } | { ok: false; error: string }`
    - `ReportOrderInput = { product; payMethod; name; phone; email; memo: string; cashReceipt: boolean; birth: ExternalReportRequest; consent: { privacy: true; terms: true } }`
    - `birth` 는 `ExternalReportRequest`(src/lib/admin/external-report.ts) 형식: `timeRule:'standard'`, 출생지 빈 문자열, `unknownBirthTime = slot==='unknown'`.
    - 검증: 이름 1~20자·제어문자 금지 · 휴대폰 `^01[016789]\d{7,8}$`(하이픈 제거 후) · 이메일 단순 형식·≤100자 · 메모 ≤300자 · 동의 둘 다 true · 윤달은 음력에서만.
  - `canTransition(from: ReportOrderStatus, to: ReportOrderStatus): boolean` — 허용: pending_payment→paid|cancelled · awaiting_deposit→paid|cancelled · paid→generated|refunded · generated→generated(다시 만들기)|sent|refunded · sent→sent(다시 보내기)|refunded.
  - `maskName(name: string): string` — "김민지"→"김*지", 2자 "김민"→"김*".

- [ ] **Step 1: 실패하는 테스트 작성** — `parseReportOrderForm` 정상(양력·시간 있음 → hour '23' minute '45' for ja-night), 시간 모름(unknownBirthTime true, hour ''), 음력 윤달, 잘못된 휴대폰·동의 누락·이름 21자 거부; `canTransition('sent','paid') === false`, `canTransition('awaiting_deposit','paid') === true`; `maskName`.
- [ ] **Step 2: 실행해 실패 확인** — `./scripts/with-node22.sh npx vitest run src/lib/report-orders/report-order.test.ts` → FAIL(모듈 없음)
- [ ] **Step 3: 구현** — 생년월일 범위 검사는 `parseExternalReportRequest` 를 그대로 호출해 같은 규칙을 쓴다(kind 는 product 에서).
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS
- [ ] **Step 5: 커밋** — `feat(report-orders): 비회원 주문서 검증·시간대·상태 전이`

### Task 2: 마이그레이션 + 저장소 함수 + 카탈로그 상품

**Files:**
- Create: `supabase/migrations/091_report_orders.sql`
- Create: `src/lib/report-orders/report-order-store.ts`
- Modify: `src/lib/payments/catalog.ts` (kind `'report_order'`, 패키지 2개)
- Modify: `src/lib/payments/order-ledger.ts` (`createPaymentOrder` 의 `userId: string | null`)
- Test: `src/lib/payments/catalog.test.ts` 에 케이스 추가(있으면), `src/lib/report-orders/report-order-store.test.ts`

**Interfaces:**
- Consumes: Task 1 타입
- Produces (`report-order-store.ts`, 모두 service client, 첫 인자 생략 시 `createServiceClient()`):
  - `createReportOrder(input: ReportOrderInput & { amount: number; listAmount: number; paymentOrderId: string | null; source: string | null }): Promise<ReportOrderRow>` — status: card→`pending_payment`, bank→`awaiting_deposit`; `order_no` = `GS-R-YYMMDD-XXXX`(4자 대문자 난수); `result_token` = `randomBytes(32).toString('base64url')`; `deposit_due_at` = bank 면 +3일.
  - `markReportOrderPaidByPaymentOrder(paymentOrderId: string): Promise<void>` — pending_payment→paid, 이미 paid 이후면 무시(멱등).
  - `markReportOrderRefundedByPaymentOrder(paymentOrderId: string): Promise<void>` — 멱등.
  - `transitionReportOrder(id: string, to: ReportOrderStatus, patch?: Record<string, unknown>): Promise<ReportOrderRow>` — `canTransition` 위반이면 throw, 조건부 update(`eq('status', from)`)로 경합 차단.
  - `getReportOrder(id)`, `getReportOrderByToken(token)`, `listReportOrders(filter: 'awaiting_deposit'|'paid'|'generated'|'sent'|'closed', page)`.
  - `type ReportOrderRow` = 테이블 컬럼 camelCase.
- 테이블 `report_orders`: `id uuid pk default gen_random_uuid()`, `order_no text unique not null`, `product text check in ('lifetime','new-year')`, `amount int not null`, `list_amount int not null`, `pay_method text check in ('card','bank')`, `status text check (Task 1 목록)`, `name text`, `phone text`, `email text`, `birth_input jsonb`, `memo text`, `cash_receipt boolean default false`, `payment_order_id text unique`(payment_orders.order_id), `external_report_id uuid references admin_external_reports(id)`, `result_token text unique`, `deposit_due_at`, `deposit_confirmed_at`, `deposit_confirmed_by uuid`, `generated_at`, `reviewed_at`, `reviewed_by uuid`, `sent_at`, `send_result jsonb`, `refunded_at`, `refund_note text`, `consented_at timestamptz not null`, `source text`, `purged_at timestamptz`, `created_at`, `updated_at`. RLS enable, 정책 없음, `revoke all on report_orders from anon, authenticated`. 같은 파일에 `alter table payment_orders alter column user_id drop not null;` 및 `admin_external_reports` 에 service_role delete 권한(보관기간 삭제용).
- 카탈로그: `{ id:'report_lifetime', name:'종합사주 1인', credits:0, price:29900, kind:'report_order', compareAt:60000 }`, `{ id:'report_new_year', name:'2027 신년운세 PDF', credits:0, price:19900, kind:'report_order', compareAt:40000 }` — 주석으로 "⚠️ 정가 표시는 사용자 결정(표시광고법 고지)" 남김.

- [ ] **Step 1: 테스트** — 카탈로그에 두 패키지(가격·compareAt·kind) / `createReportOrder` 가 bank 면 `awaiting_deposit`+`deposit_due_at`, card 면 `pending_payment`, 토큰 길이 ≥ 43 (supabase 클라이언트는 기존 테스트의 가짜 클라이언트 패턴을 따른다).
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현 + 마이그레이션 작성.** `tsc` 로 `PaymentPackageKind` 추가가 깨뜨린 switch·목록을 찾아 report_order 를 일반 사용자 상품 목록(가격표·메뉴·사이트맵)에서 제외한다(`/admin/pricing` 에는 보여 가격 수정 가능).
- [ ] **Step 4: `userId` 사용처 전수 확인** — `grep -rn "\.userId\|user_id" src/lib/payments src/app/api/payments src/app/api/admin src/lib/admin` 결과 중 report_order 주문이 지나갈 수 있는 곳을 목록으로 적고(Task 4 에서 막을 곳 표시), 관리자 결제 목록이 user_id null 을 표시할 수 있는지(이메일 조인 실패 시 "비회원") 고친다.
- [ ] **Step 5: PASS + tsc** 
- [ ] **Step 6: 커밋** — `feat(report-orders): report_orders 테이블·저장소·카탈로그 상품 2종`

### Task 3: 주문 API `POST /api/report-orders`

**Files:**
- Create: `src/app/api/report-orders/route.ts`
- Create: `src/lib/report-orders/bank-account.ts` (`getReportBankAccount(): { bank; account; holder } | null`)
- Create: `src/lib/report-orders/notify.ts` (Task 6 에서 확장)
- Test: `src/app/api/report-orders/route.spec.ts`

**Interfaces:**
- Consumes: Task 1 `parseReportOrderForm`, Task 2 `createReportOrder`, `createPaymentOrder`, `getChargePrice`(관리자 가격 덮어쓰기 리졸버 — 기존 `resolveChargeForUser` 가 쓰는 가격 조회 함수를 찾아 재사용)
- Produces: 응답 `{ ok:true, payMethod:'card', orderId, amount, goodsName }` | `{ ok:true, payMethod:'bank', orderNo, amount, bank, account, holder, depositDueAt }` | `{ ok:false, error }`
- `notify.ts`: `sendOrderReceivedText(order: ReportOrderRow): Promise<void>` (무통장: 계좌·금액·기한 / 카드: 접수 확인) — 실패는 삼킨다(주문은 유지).

- [ ] **Step 1: 테스트** — 같은 출처 아니면 403 · 8KB 초과 400 · 검증 실패 400 · 무통장인데 계좌 env 없음 400 · 카드면 `createPaymentOrder` 가 `userId:null`, `listAmount` = 서버 가격(요청 body 의 금액 무시)으로 호출 · 같은 IP 10분에 5건 초과 429(메모리 Map, `ponytail:` 주석으로 인스턴스별 한계 명시) · 응답·로그에 이름/휴대폰 미포함.
- [ ] **Step 2: FAIL 확인** — `./scripts/with-node22.sh npm run test:spec -- src/app/api/report-orders/route.spec.ts`
- [ ] **Step 3: 구현** — 카드: payment_orders 먼저 만들고 그 orderId 로 report_orders 생성, metadata `{ provider, origin, checkoutPath:'/saju-report', reportOrder:true }`. 퍼널 `logPaymentFunnelEvent` prepare_ready 는 userId null 로 기록.
- [ ] **Step 4: PASS**
- [ ] **Step 5: 커밋** — `feat(report-orders): 비회원 주문 API(카드·무통장)`

### Task 4: 결제 경로 연결(fulfill · return · webhook)

**Files:**
- Modify: `src/lib/payments/fulfillment.ts` (claim 직후 `pkg.kind === 'report_order'` 분기)
- Modify: `src/app/api/payments/nicepay/return/route.ts` (`resolveNicepayResultHref` 에 report_order → `/saju-report/complete?no=<orderNo 대신 orderId>`)
- Modify: `src/app/api/payments/webhook/nicepay/route.ts` (전액 취소: report_order 면 회수 건너뛰고 `markReportOrderRefundedByPaymentOrder`; 부분취소 통보는 기존대로 기록만)
- Test: 각 파일의 기존 테스트 파일에 케이스 추가

**Interfaces:**
- Consumes: Task 2 `markReportOrderPaidByPaymentOrder`, `markReportOrderRefundedByPaymentOrder`
- Produces: fulfill 결과 `{ success:true, product:null, plan:null, ... }` (이용권·전 지급 없음), 완료 화면 경로 `/saju-report/complete?order=<payment orderId>`

- [ ] **Step 1: 테스트** — fulfill: report_order 주문은 `addCredits`·`grantTasteProductEntitlement`·`attachOwnedReading` 미호출, `markPaymentOrderFulfilled` + `markReportOrderPaidByPaymentOrder` 호출(source 가 'reconciliation' 이어도 동일) · return: report_order 면 완료 경로로 303 · webhook: report_order 전액취소 → `revokeCredits`·`revokeEntitlementsOfPayment` 미호출, `markReportOrderRefundedByPaymentOrder` 호출, 200.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 전체 결제 테스트 PASS** — `npm test` + `npm run test:spec` (기존 결제 테스트 회귀 0)
- [ ] **Step 5: 커밋** — `feat(report-orders): 카드 결제 승인·정산·취소 통보를 비회원 주문에 연결`

### Task 5: 랜딩 화면 `/saju-report` + 완료·입금 안내

**Files:**
- Create: `src/app/saju-report/page.tsx` (서버, metadata: title absolute "간지사주 — 종합사주·2027 신년운세", noindex 아님)
- Create: `src/app/saju-report/landing-content.ts` (PPT 4~14장 문구 상수, 설계서 §5 의 수정 문구 반영, `REVIEWS: readonly { name: string; text: string; rating?: number }[] = []`)
- Create: `src/app/saju-report/order-form.tsx` (client) · `src/app/saju-report/saju-report.module.css`
- Create: `src/app/saju-report/complete/page.tsx` (카드 완료: 주문번호·"영업일 1~2일 안에 문자·이메일로 보내 드립니다")
- Create: `public/saju-report/*.webp` (PPT 이미지 → sharp 로 webp, 폭 1200 이하)
- Test: `src/app/saju-report/order-form.test.tsx`, `src/app/saju-report/landing-content.test.ts`

**Interfaces:**
- Consumes: Task 1 `HOUR_SLOTS`, Task 3 API 응답, `requestNicepayPayment`/`toNicepayMethod`(카드), `getReportBankAccount()` 존재 여부(서버에서 boolean 으로 props 전달), 카탈로그 가격(관리자 덮어쓰기 반영 조회 함수 — Task 3 에서 찾은 것)
- 구성: 설계서 §5 표 순서 11칸. 하단 고정 "풀이 신청하기"(body portal — `createPortal(document.body)`, 기존 고정 CTA 규칙). 랜딩 전용 간단 머리글(로고만), 기존 `SiteFooter`(사업자 정보) 사용. 사진 아래 "이미지는 연출 사진입니다". 상담사 사진엔 이름·직함 없음. 후기 칸은 `REVIEWS.length===0` 이면 렌더 안 함. 하단에 `/ai-disclaimer`·`/privacy`·`/terms`·`/refund-policy` 링크.
- 무통장 결과는 같은 페이지에서 입금 안내 카드로 바꿔 보여 준다(은행·계좌·예금주·금액·입금자명=주문자 이름·기한).

- [ ] **Step 1: 테스트** — content: 한자 0자(`/[一-鿿]/`) · "계좌이체" 문구 없음 · "70쪽 이상" 포함 · "전문가들이 정성을 다해 풀이" 없음. form: 필수 미입력 시 제출 막힘·안내 · 무통장 비활성(props false)이면 선택지 없음 · 무통장 제출 성공 시 계좌 안내 표시 · 카드 제출 시 `requestNicepayPayment` 가 API 의 `amount` 로 호출.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — 본문 18px+, 버튼 56px+, 대비 4.5:1(기존 대비 가드 유틸이 있으면 재사용).
- [ ] **Step 4: PASS + 390px 실화면** — dev 서버에서 headless 390px 스크린샷, `document.documentElement.scrollWidth <= 390` 확인.
- [ ] **Step 5: 커밋** — `feat(saju-report): 한 장짜리 랜딩·주문서·완료 화면`

### Task 6: 관리자 주문 화면 + 생성·발송

**Files:**
- Create: `src/app/admin/report-orders/page.tsx`, `src/app/admin/report-orders/report-orders-client.tsx`, `src/app/admin/report-orders/[id]/page.tsx`(미리보기 = `ExternalReportView`)
- Create: `src/app/api/admin/report-orders/[id]/route.ts` (POST `{ action }`)
- Modify: `src/lib/report-orders/notify.ts` (`sendReportReadyMessages(order): Promise<{ sms: boolean; email: boolean }>`)
- Modify: `src/lib/admin/nav.ts` (운영 도구에 "랜딩 주문", super_admin)
- Test: `src/app/api/admin/report-orders/[id]/route.spec.ts`, `src/lib/admin/nav.test.ts` 갱신

**Interfaces:**
- Consumes: Task 2 저장소, `generateExternalReport`/`generateExternalNewYearReport`/`saveExternalReport`, `getExternalReport`, `cancelNicepayPayment`, `markPaymentOrderRefunded`, `getCurrentAdminRole`, `logAdminAccess`, `solapiSendText`, `sendNotificationEmail`
- actions: `confirm_deposit`(awaiting_deposit→paid) · `generate`(paid|generated→generated, external_report_id 갱신, maxDuration 300, 계정별 동시 생성 차단은 external-report 라우트와 같은 방식) · `send`(generated|sent→sent, 문자·이메일, 하나라도 성공하면 sent, `send_result` 기록) · `cancel`(pending_payment|awaiting_deposit→cancelled) · `refund_card`(paid|generated|sent & card → `cancelNicepayPayment(tid,{reason,orderId})` → `markPaymentOrderRefunded` → refunded) · `mark_refunded`(bank, 메모 필수).
- 목록: 상태 필터 · 입금 기한 지남 표시 · 무통장 입금 확인 합계(기간: 이번 달) · 생성 경고(`generationWarning`) 표시.
- 문자 문구: `[간지사주] {이름}님, 요청하신 {상품명} 풀이가 준비됐어요.\n{링크}\n링크는 1년간 열 수 있어요.` 이메일: `sendNotificationEmail({ to, displayName:name, title:'{상품명} 풀이가 준비됐어요', body:'아래 버튼으로 풀이를 보고 PDF로 저장할 수 있어요.', url:'/r/{token}' })`.

- [ ] **Step 1: 테스트** — super_admin 아니면 403 · 다른 출처 403 · 허용 안 된 전이 409 · send 는 문자 실패·메일 성공이어도 sent · refund_card 가 bank 주문이면 400 · 응답에 휴대폰·생년월일 미포함.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: 구현**
- [ ] **Step 4: PASS**
- [ ] **Step 5: 커밋** — `feat(admin): 랜딩 주문 관리(입금 확인·풀이 생성·확인 후 발송·환불)`

### Task 7: 손님 결과 화면 `/r/[token]`

**Files:**
- Create: `src/app/r/[token]/page.tsx`, `src/app/r/[token]/print-button.tsx`
- Test: `src/app/r/[token]/page.test.tsx`

**Interfaces:**
- Consumes: `getReportOrderByToken`, `getExternalReport`, `ExternalReportView`, `externalReportPrintTitle`
- 규칙: status `sent` 이고 `purged_at` null 일 때만 렌더. 아니면 `notFound()`(모든 경우 동일). metadata: `robots: { index:false, follow:false }`, 공유 미리보기 제목 "간지사주 풀이"(이름 없음). 하단에 `/ai-disclaimer` 링크.

- [ ] **Step 1: 테스트** — 없는 토큰·generated 상태·purged 모두 notFound · sent 면 문서 렌더 · metadata 에 이름 없음.
- [ ] **Step 2: FAIL** → **Step 3: 구현** → **Step 4: PASS**
- [ ] **Step 5: 커밋** — `feat(saju-report): 손님 결과 링크 화면`

### Task 8: 보관기간 삭제 크론

**Files:**
- Create: `src/app/api/cron/report-orders-purge/route.ts`
- Modify: `vercel.json` (매일 04:20 KST = `20 19 * * *`)
- Test: `src/app/api/cron/report-orders-purge/route.spec.ts`

**Interfaces:**
- 기존 크론 인증 방식(CRON_SECRET) 그대로. `sent_at < now()-365일` 또는 (`cancelled`·`refunded` 이고 `updated_at < now()-365일`) 이면 name/phone/email/birth_input/memo/result_token 을 null, `purged_at=now()`, 연결된 `admin_external_reports` 행 삭제(external_report_id null 로 먼저 끊고).
- [ ] **Step 1~4: 테스트(인증 없으면 401 · 기한 지난 것만 지움) → FAIL → 구현 → PASS**
- [ ] **Step 5: 커밋** — `feat(report-orders): 발송 1년 뒤 개인정보·풀이 원본 삭제 크론`

### Task 9: 마무리 검증 · 기록 · PR

- [ ] `npm test` · `test:spec` · `tsc` · `next build` 전부 통과(출력 붙여 기록)
- [ ] 390px 실화면: 랜딩 전체 · 주문서 · 무통장 안내 · 관리자 목록 · 결과 화면(로컬 DB 없이 가능한 범위는 테스트 데이터로)
- [ ] Codex 교차 검토 2회(`codex exec -s read-only ... </dev/null`) → `docs/ai-review/2026-10-21-one-page-landing/`
- [ ] 보안 검토(security-review 스킬): 비회원 결제 경로·토큰·RLS
- [ ] 개인정보처리방침 수정안 문서화(`docs/ops/2026-10-21-privacy-report-orders.md`) — DB 새 버전 발행은 사용자 승인 후
- [ ] PROGRESS.md 맨 위 기록 → PR. 머지·마이그레이션 091 운영 적용·`/` 교체는 사용자 확인 후.
