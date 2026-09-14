# 나이스페이 V2 취소 통보·조회 스키마 확정 (2026-09-14)

인계 1번("나이스 샌드박스 취소 응답 확인")의 결과. **샌드박스 결제 없이** 공식 매뉴얼(nicepayments/nicepay-manual) + 운영 DB 실측(읽기 전용 집계, 사용자 승인)으로 확정했다.
B단계(부분환불)·웹훅 위조 가드는 이 문서를 전제로 한다.

## 왜 샌드박스 테스트를 안 했나
- 통보 URL 은 운영(`https://ganjisaju.kr/api/payments/webhook/nicepay`) 하나뿐이다. staging 은 따로 설정할 수 없다(사용자 확인). staging 과 운영은 같은 DB 라서, 통보를 어느 쪽이 받든 관찰은 된다.
- **샌드박스 가맹점(`UT0033304m…`)은 통보를 한 건도 보내지 않았다.** 8/24~8/28 staging 주문 14건 · API 환불 12건에 대해 `payment_webhook_events` 0건이다. 그래서 샌드박스 결제로는 통보를 관찰할 수 없다.
- **샌드박스는 부분취소도 안 된다.** `U128` 로 거부된다(명세 test.md, `refund-service.ts:276` 실측).
- 운영 가맹점은 `UT0033314m…` 이다(7/21~9/11 실결제). `UTWEBHOOKm…` 은 콘솔 URL 등록·TEST 핑이다.

## 확정 사실
| 항목 | 값 | 근거 |
|---|---|---|
| 전송 | POST JSON(`application/json;charset=utf-8`). form 이 아니다 | hook.md · 운영 payload 실측 |
| status enum | `paid` `ready` `failed` **`cancelled`** **`partialCancelled`** `expired` — `canceled`·대문자는 명세에 없다 | hook.md·cancel.md·status-transaction.md 세 표가 같다 · 운영 `nicepay:cancelled` 8건 |
| 본문 모양 | 결제 객체 전체. 조회(`GET /v1/payments/{tid}`)·취소 응답과 같다 | 명세 · 운영 키 실측(아래) |
| 운영 통보 최상위 키 | amount, approveNo, balanceAmt, bank, buyerEmail, buyerName, buyerTel, cancelledAt, cancelledTid, cancels, card, cashReceipts, cellphone, channel, coupon, currency, ediDate, failedAt, goodsName, issuedCashReceipt, mallReserved, mallUserId, messageSource, orderId, paidAt, payMethod, receiptUrl, resultCode, resultMsg, signature, status, tid, useEscrow, vbank | DB 실측(키 이름만) |
| 잔액 | `balanceAmt` = 취소 가능 잔액(전체 − 누적 취소) | hook.md |
| 개별 취소 금액 | `cancels[].amount`. 원소 키 = tid · amount · cancelledAt · reason · receiptUrl · couponAmt(운영 실측 일치). 최상위 `cancelAmt` 는 없다(요청 파라미터 이름일 뿐) | hook.md · DB 실측 |
| 이번 취소 건 | `cancelledTid` 로 `cancels[]` 에서 찾는다. `tid` 는 항상 원거래다. ⚠️ `cancelledTid` 는 선택 필드 → 없으면 cancels 마지막 원소 또는 `amount − balanceAmt` 증분 | hook.md |
| 시각 | ISO 8601(예시 `+0900`). 해당 상태가 아니면 문자열 `'0'`(`Date.parse('0')` 은 2000-01-01 → 접두 가드 필요) | hook.md · test.md |
| 서명 | `signature = hex(sha256(tid + amount + ediDate + SecretKey))`. 본문 필드이고 선택이다. **status·orderId·cancels 는 서명 범위 밖** | hook.md |
| API 취소 시 통보 | 명세상 발송("API 또는 가맹점관리자 취소") | hook.md · admin.md |
| 응답 규약 | 200 + body `OK` + `text/html;charset=utf-8`. 우리는 `text/plain`(등록 통과, 한 줄 수정 권장) | hook.md · code.md U337/U338 |
| 재전송 | `OK` 가 아니면 **1분 간격 10회 자동 재전송**, 콘솔 수동 재전송 가능 | payment-webhook.svg 흐름도 · admin.md |
| 발신 IP | 121.133.126.86 / .87 | preparations.md |
| 취소 요청 | reason(≤100B) · orderId(요청마다 고유, 필수) · cancelAmt(선택, 없으면 전액) · signData = sha256(tid+ediDate+SecretKey). Idempotency-Key 는 **명세에 없다** | cancel.md |

## 샌드박스 실측(2026-09-14 오후 — 샌드박스 가맹점 통보 URL 을 staging 으로 바꾼 뒤)
- 등록 TEST 핑(`UTWEBHOOKm…` paid·ready·상태 없음 샘플)은 staging 으로 온다. 그러나 **실거래 통보는 오지 않는다**:
  QA 타로 3,300원 결제(12:55) 뒤 결제 통보 0건, 관리자 API 취소(14:06:17, 직접 성공) 뒤 4분까지 취소 통보 0건(자동 재전송 구간 포함). → 통보 경로는 샌드박스로 E2E 할 수 없다.
- **샌드박스 API 취소 응답**(직접 성공, 8월 12건 + 이번 1건 같은 모양): `status: cancelled` · `resultCode: 0000` · `balanceAmt: 0`(숫자) · `cancels[]`·`cancelledTid`·`signature` 포함.
- 🔍 **취소 API 응답의 `orderId` 는 원주문 번호다** — 요청에는 `buildCancelOrderId` 의 `cxl…` 을 보냈는데 응답 결제 객체는 원주문을 싣는다.

## 아직 ⚠️ 검증필요(운영 실거래로만 확인 가능)
- **API 취소 통보의 orderId** — 운영에서 API 취소가 성공한 적이 없고(운영 환불 5건은 전부 콘솔 취소가 먼저), 샌드박스는 실거래 통보를 안 보내 미실측.
  다만 위 실측처럼 취소 응답의 결제 객체가 원주문 orderId 를 싣고 통보도 같은 결제 객체라 **원주문일 가능성이 높다**(지금 핸들러의 orderId 조회로 찾힌다).
  → **다음 운영 관리자 환불 때** 그 결제키의 `payment_webhook_events` 한 줄로 확정. 가드는 orderId 대신 **tid(=paymentKey)로 주문을 찾게** 바꾸면 이 값과 무관해진다.
- 부분취소 통보의 `amount` 가 원결제 금액으로 유지되는지(서명식 입력) · `cancelledTid` 동반 여부. 샌드박스로는 확인할 수 없어 운영 소액 실거래나 명세 모양 픽스처로만 다룬다.

## 코드 갭(다음 작업 입력 — 우선순위 순)
1. 🔴 **위조 통보**(`webhook/nicepay/route.ts`): 서명 검증이 없고, 재조회 결과를 판정에 쓰지 않는다. 막는 조건은 세 가지다.
   ① `order.paymentKey === payload.tid`(또는 tid 로 주문 조회) ② 재조회 status ∈ {cancelled, partialCancelled} + 재조회 orderId·amount 가 주문과 일치 ③ signature 가 오면 대조(ediDate 는 수신값 그대로).
   조회에 실패하면 `OK` 로 응답하고 failed 로 기록한다(non-OK 는 재전송 10회만 부른다).
   ⚠️ 운영은 샌드박스 비밀키가 없어 staging 샌드박스 주문을 검증하지 못한다. "검증 실패 = 무시"로 두면 staging 테스트 취소가 전부 무시된다.
2. 🔴 **부분취소 통보 = 전액 처리**: `partialCancelled` 도 주문을 refunded 로 표기하고, 전·이용권을 전부 회수하고, GA refund 를 전액으로 보낸다. 관리자 부분환불도 API 취소라 명세상 통보가 온다.
   → B단계와 함께 고친다. 부분이면 원장 상태를 유지하고, 금액은 `cancels[cancelledTid].amount` 로 본다. **tid 우선 조회(1번)는 이것보다 먼저 배포하지 말 것** — 과회수가 켜진다.
3. 🟠 **멱등 기록이 처리보다 먼저**라서 조회 예외(`getPaymentOrderByOrderId` 가 try 밖)가 500 → 자동 재전송 10회가 전부 "duplicate → OK" 로 흡수 → 영구 미처리. 조회를 try 안으로 옮기고, duplicate 여도 기존 행이 failed 면 재처리한다.
4. 🟠 관리자 환불 × 통보 도착 순서: 전 충전 이중 차감 가능, 대화상담 전 3개가 통보 순서에 따라 미회수. 도착 순서는 미실측이다.
5. 🟠 `normalizeNicepayPaymentForRefund` 가 `cancels[].amount` 를 토스 모양(`cancelAmount`)으로 안 바꿔 전 충전 백스톱 판정이 false 가 된다. 기존 테스트 픽스처는 명세 밖 값(`canceled`)이다.
6. 🟠 취소 재시도마다 새 orderId + 명세 밖 Idempotency-Key + fetch 타임아웃 없음 → 부분취소 재시도가 이중 환불될 수 있다. 재시도 전 GET 으로 대조하고 `AbortSignal.timeout(30_000)` 을 건다.
7. 🟡 정리: 이미 취소 판정의 문구 부분일치(2013/2015 코드로), reason 100B 자르기, 응답 `text/html`, 명세 밖 status 값·form 분기·GET 핸들러 삭제, `NicepayPaymentObject` 에 balanceAmt·cancelledTid·cancels 명시.
