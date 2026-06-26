# 토스페이먼츠 → 나이스페이(NICEPAY V2) 결제 연동 가이드

> 2026-06-26 작성. 토스 입점 심사 지연 대비 — 나이스페이를 **병행 연동**해 두고 먼저 승인되는 PG로 스위치.
> 공식 문서 기준: github.com/nicepayments/nicepay-manual, developers.nicepay.co.kr
> ⚠️ 결제 정합(금액 위변조 방지)·운영 안정성 최우선. "게재 전 확인" 항목은 콘솔/공식 문서로 반드시 재확인.

---

## 0. 두 가지 결정 (질문 답) — 둘 다 **현행 토스와 동일 패턴**

| 항목 | 선택 | 이유 |
|---|---|---|
| **결제창 승인방식** | **서버승인 (Server Approval)** | 인증 완료 후 `returnUrl`로 받은 `authToken`·`amount`·`signature`를 **서버가 검증한 뒤** 서버가 승인 API(`POST /v1/payments/{tid}`)를 호출. 금액 위변조를 서버에서 차단(공식: 클라이언트승인은 변조 책임이 전부 가맹점). 대량 트래픽 시 Server 승인 권고. 현행 토스 `confirm`(서버에서 `pkg.price!==amount` 거부)과 **완전히 동일 구조** |
| **API 인가방식** | **Basic 인증** | `Authorization: Basic Base64(clientKey:secretKey)`. Access Token은 30분 만료 + **갱신(refresh) 미지원** → 만료/재발급/동시성 관리 부담만 큼. 현행 토스도 Basic(`toss.ts:15`) |

⚠️ **콘솔 전제조건**:
- 서버승인 결제창은 **clientKey가 "Server 승인 방식"으로 발급된 경우에만** 사용 가능. 나이스페이 가맹 콘솔에서 키 발급 종류를 확인/설정해야 함.
- Basic 인증도 콘솔에서 "시크릿키 인증방식 = Basic"으로 발급해야 함.

---

## 1. 키를 어디에 넣나 (환경변수)

나이스페이는 키 2종 발급(콘솔 로그인 > 개발정보 탭): **clientKey(=clientId, 결제창용)** + **secretKey(서버 API용)**. 샌드박스/운영 키는 분리.

현행 토스 네이밍(`TOSS_SECRET_KEY` / `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `.env.example:12-13`)에 맞춰:

```bash
# .env.local (로컬 개발 — git 미추적). 값은 받으신 키로.
NEXT_PUBLIC_NICEPAY_CLIENT_KEY=발급받은_clientKey   # 결제창 호출(브라우저 노출 OK)
NICEPAY_SECRET_KEY=발급받은_secretKey               # 서버 승인/취소(절대 노출 금지)

# 듀얼 PG 스위치 (어느 PG로 결제할지)
PAYMENT_PROVIDER=nicepay                            # toss | nicepay
```

**프로덕션/프리뷰 (Vercel)**: ganji-saju 프로젝트 → Settings → Environment Variables 에 위 3개 추가.
- `NEXT_PUBLIC_NICEPAY_CLIENT_KEY`, `PAYMENT_PROVIDER` → Production + Preview
- `NICEPAY_SECRET_KEY` → Production + Preview, **Sensitive 체크**(읽기 불가 보호)
- 샌드박스로 먼저 테스트 시 테스트 키 사용 → 운영 전환 시 운영 키로 교체

> ⚠️ 키만 넣어선 결제 안 됨. 아래 §3 연동 코드가 이 변수들을 참조해야 동작.

---

## 2. 나이스페이 결제 흐름 (서버승인)

```
[브라우저] AUTHNICE.requestPay({ clientId, method, orderId, amount, goodsName, returnUrl })
   ↓ 사용자 인증(카드/간편/계좌 등)
[NICEPAY → returnUrl] POST: authResultCode('0000'=성공), tid, clientId, orderId, amount, authToken, signature, mallReserved
   ↓
[가맹점 서버] ① signature 검증: hex(sha256(authToken + clientId + amount + secretKey)) == signature ?
              ② 주문 DB의 금액(pkg.price) == amount ?  (현행 confirm 로직 재사용)
              ③ 승인 호출: POST https://api.nicepay.co.kr/v1/payments/{tid}
                 헤더 Authorization: Basic base64(clientKey:secretKey), body { amount, ediDate, signData... }
   ↓ 승인 응답(resultCode 0000) → 주문 confirmed + entitlement grant (현행 fulfillment 재사용)
[웹훅] 결제완료·가상계좌 입금·취소 시 NICEPAY → POST(json). 비즈니스 로직 전 signature·금액 검증 필수
```

- **SDK**: `<script src="https://pay.nicepay.co.kr/v1/js/"></script>` (샌드박스도 동일 URL, 키로 환경 구분)
- **승인 API**: `POST https://api.nicepay.co.kr/v1/payments/{tid}` (샌드박스 `sandbox-api...` — §6 확인)
- **취소 API**: `POST https://api.nicepay.co.kr/v1/payments/{tid}/cancel` (reason 필수, cancelAmt 생략=전체취소)
- **망취소(net-cancel)**: 승인 호출 read-timeout 시 망취소 처리 → 미결제/중복결제 방지 (서버승인 필수 구현)
- **가상계좌(vbank)**: 발급→입금 비동기라 **웹훅 입금통보 처리 필수**

---

## 3. 현행 토스 통합 → 나이스페이 교체 지점 (file:line)

**핵심: payment_orders 테이블·상태머신·orderId 생성·금액 검증·catalog 단일출처는 그대로 재사용.** PG 호출부와 서명검증만 교체.

| 구분 | 현행 (토스) | 교체 |
|---|---|---|
| 환경변수 | `.env.example:12-13` TOSS_* | NICEPAY_* (§1) |
| 구독 필드 | `subscription.ts:20,48` toss_billing_key/customer_key | nicepay billingKey(BID) |
| **결제 준비** | `prepare/route.ts:252-264` createPaymentOrder, orderId 생성 | **불변**(orderId·금액검증 유지) |
| 주문 생성 | `order-ledger.ts:84-86,161-203` | **불변**(DB 레이어) |
| **PG 승인** | `toss.ts:29-40` confirmPayment | → nicepay 승인 `POST /v1/payments/{tid}` |
| PG 조회 | `toss.ts:42-68` getPayment/ByOrderId | → nicepay 조회 |
| PG 취소 | `toss.ts:72-108` cancelPayment | → nicepay `/{tid}/cancel` |
| **금액 검증** | `confirm/route.ts:60-71`, `confirmation.ts` pkg.price!==amount | **불변**(재사용) |
| 웹훅 서명 | `webhook-signature.ts:1-62` HMAC-base64 | → **sha256-hex** 검증으로 교체 |
| 웹훅 라우트 | `webhook/toss/route.ts:1-106` | → `webhook/nicepay/route.ts` (헤더명·페이로드 정규화) |
| 상태 매핑 | `reconciliation.ts:18-24` DONE/IN_PROGRESS/EXPIRED/CANCELED/ABORTED | → nicepay 상태값 매핑표 |
| 결제창 호출 | checkout 컴포넌트(Toss SDK) | → AUTHNICE.requestPay |

**권장 구조 — PG 어댑터**: `toss.ts`의 인터페이스(승인/취소/조회/서명검증)를 추상화해 `nicepay.ts`를 같은 시그니처로 구현하고, `PAYMENT_PROVIDER` env로 어댑터를 선택. → **토스/나이스페이 둘 다 연동해두고 env 한 줄로 스위치.**

```
src/lib/payments/
  toss.ts        (현행)
  nicepay.ts     (신규 — toss.ts와 동일 시그니처: confirm/get/cancel + Basic auth + sha256 서명)
  provider.ts    (신규 — PAYMENT_PROVIDER 보고 toss|nicepay 어댑터 반환)
```

차이 요약: 인증 `Basic base64(secretKey:)` → `Basic base64(clientKey:secretKey)`, 서명 HMAC-base64 → sha256-hex, 엔드포인트 `api.tosspayments.com/v1/payments/confirm` → `api.nicepay.co.kr/v1/payments/{tid}`.

---

## 4. 마이그레이션 체크리스트 (순서)

1. [ ] **콘솔**: 나이스페이 가맹 가입 + 테스트(샌드박스) 상점 생성, **clientKey 발급 종류 = Server 승인**, **secretKey 인증방식 = Basic** 확인
2. [ ] **키**: NICEPAY_CLIENT_KEY / NICEPAY_SECRET_KEY / PAYMENT_PROVIDER 환경변수 등록(.env.local + Vercel)
3. [ ] **어댑터**: `nicepay.ts`(승인/취소/조회 + Basic + sha256) + `provider.ts`(스위치)
4. [ ] **승인 라우트**: confirm 라우트가 어댑터 통해 nicepay 승인 호출 + 기존 금액검증(pkg.price) 재사용 + **망취소** 처리
5. [ ] **웹훅**: `webhook/nicepay/route.ts` + sha256 서명검증 + 가상계좌 입금통보 처리
6. [ ] **결제창**: checkout 컴포넌트에 AUTHNICE.requestPay 분기(returnUrl = 승인 라우트)
7. [ ] **상태 매핑**: reconciliation에 nicepay 상태값 추가
8. [ ] **환불/구독**: cancel + 빌링키(BID) 발급/승인(`/v1/subscribe/...`) — 정기결제 쓰면
9. [ ] **샌드박스 테스트**: 카드/가상계좌/취소/웹훅 E2E (테스트카드 `123412******1234`, 결과 0000)
10. [ ] **운영 전환**: 도메인 sandbox-api→api, 테스트키→운영키, 실거래 1건 테스트, `PAYMENT_PROVIDER=nicepay`

---

## 5. 듀얼 PG 운영 (토스/나이스페이 먼저 되는 쪽)

- 두 어댑터를 모두 유지하고 `PAYMENT_PROVIDER` env로 선택 → **재배포만으로 PG 전환**
- 토스 심사 통과 시 `=toss`, 나이스페이 먼저면 `=nicepay`
- 주문/entitlement/catalog는 PG 무관하게 동일 → 데이터 영향 없음
- 단, **빌링(정기구독)** 은 PG별 billingKey가 달라 마이그레이션 중인 구독자는 PG 고정 필요(전환 시 신규 결제부터 새 PG)

---

## 6. ⚠️ 게재(연동) 전 반드시 공식 문서/콘솔로 재확인

리서치는 공식 문서 기반이나 추출 모델 한계로 아래는 **원문 대조 필수**:
1. **승인/취소 API 정확한 호스트** (운영 `api.nicepay.co.kr` 확인 / **샌드박스 prefix** `sandbox-api...` 전 엔드포인트 적용 여부) — `api/payment.md`
2. **Authorization 형식** 정확히 (Basic base64 인코딩 규칙: `clientKey:secretKey` 순서) — `common/api.md`
3. **서명 규칙** 바이트 단위: 인증응답 `sha256(authToken+clientId+amount+secretKey)`, 승인 `signData=sha256(tid+amount+ediDate+secretKey)` — `payment-window-server.md`
4. **결제 상태/결과코드표** (0000=정상만 확정, 분기용 세부코드는 `manual-code.php` 원문)
5. **웹훅 서명 헤더명·검증식** — `hook.md`
6. **빌링키 encData 암호화**(AES, IV/패딩/encMode) — NICEPAY 샘플코드와 바이트 대조
7. **간편결제(카카오/네이버페이) method 문자열·추가 파라미터** — 사용할 수단만 개별 확인
8. **정산**(주기·수수료) — 개발문서 밖, **가맹 계약/콘솔**에서 확인

**출처**: github.com/nicepayments/nicepay-manual (payment-window-server.md, payment-window-client.md, common/api.md, payment-access-token.md, hook.md, payment-subscribe.md, payment.md), developers.nicepay.co.kr
