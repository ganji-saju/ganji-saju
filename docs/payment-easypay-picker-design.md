# 간편결제 선택기 설계 — 결제창 순서를 우리가 정하는 방법

> 2026-09-08. 배경: 나이스페이가 간편결제를 오픈해 `cardAndEasyPay` 로 카카오·네이버·삼성이
> 전부 뜨지만(#788), **그 창 안의 순서는 우리가 못 바꾼다.**

## 0. 왜 결제창 자체는 못 고치나

나이스페이 매뉴얼(`payment-window-client.md`)이 제공하는 UI 파라미터 전부:

`disableScroll` · `disableEdgeChk` · `zIdxHigher` · `skinType`(red/green/purple/gray/dark) ·
`language` · `logoImgUrl` · `appScheme`

**결제수단 순서·탭 배치를 제어하는 값은 없다.** 그 화면은 나이스페이가 그린다. 순서를 바꾸려면
나이스페이에 요청하는 수밖에 없다.

→ 그래서 **순서를 우리 앱 화면으로 끌어온다.** 사용자가 우리 화면에서 수단을 고르면, 그 수단의
결제창이 곧바로 뜬다(중간 선택 화면 없음).

## 1. 지금 구조

```
[결제 방식]  ← TossPaymentMethodPicker (provider prop 보유)
  ( ) 카드 결제          → toNicepayMethod('CARD')     → 'cardAndEasyPay'
  ※ 실시간 계좌이체는 2026-09-08 에 나이스페이 경로에서 영구 제거(넣으면 결제가 막힌다)
                ↓
  requestNicepayPayment({ method })  → AUTHNICE.requestPay
```

관련 파일 4개:

| 파일 | 역할 |
|---|---|
| `src/lib/payments/methods.ts` | 옵션 목록 + `TossPaymentMethodCode` 유니온 |
| `src/components/payments/toss-payment-method-picker.tsx` | 선택 UI, `provider` 로 분기 |
| `src/lib/payments/nicepay-checkout.ts` | `toNicepayMethod` 매핑 + `requestPay` |
| `src/components/membership/toss-membership-checkout.tsx` | 상태 보유 + 호출(L234, L352) |

## 2. 제약: 이 옵션 목록은 토스와 공유된다

`TOSS_PAYMENT_METHOD_OPTIONS` 는 `provider` 가 toss 일 때도 그대로 쓰인다. 토스 경로는
`CARD`/`TRANSFER` 만 이해하므로 **간편결제 코드가 토스로 새면 결제가 깨진다.**

→ 목록을 **공용(both) / 나이스페이 전용(nicepay)** 으로 태깅하고, 픽커가 provider 로 거른다.
토스는 지금과 100% 동일하게 동작한다.

## 3. 설계

### 3-1. 옵션 테이블 (`methods.ts`)

```ts
export const PAYMENT_METHOD_OPTIONS = [
  { code: 'KAKAOPAY',  label: '카카오페이',     nicepay: 'kakaopay',       only: 'nicepay' },
  { code: 'NAVERPAY',  label: '네이버페이',     nicepay: 'naverpayCard',   only: 'nicepay' },
  { code: 'SAMSUNGPAY',label: '삼성페이',       nicepay: 'samsungpayCard', only: 'nicepay' },
  { code: 'CARD',      label: '신용/체크카드',  nicepay: 'card',           only: null },
] as const;
```

🔴 **실시간 계좌이체(`bank`)는 목록에 없다.** 나이스페이 안내상 계좌이체를 넣는 순간 결제
자체가 막힌다. 2026-09-08 에 픽커·매핑 양쪽에서 영구 제거했다(복구 플래그였던
`NEXT_PUBLIC_NICEPAY_TRANSFER_ENABLED` 도 삭제). 토스 경로에는 계좌이체가 그대로 남아
있으므로, 이 표에 되살리는 일이 있다면 **나이스페이 확인부터** 받을 것.

- **배열 순서가 곧 화면 순서다.** 간편결제 3종이 위, 카드가 아래 — 요청하신 배치.
- `only: 'nicepay'` 인 항목은 provider 가 toss 면 픽커가 걸러낸다.
- `nicepay` 필드가 곧 `toNicepayMethod` 의 매핑표다(switch 문 삭제, 테이블 하나로 통일).

⚠️ **`CARD` 의 의미가 바뀐다**: `cardAndEasyPay`(카드+간편결제 한 덩어리) → `card`(카드 전용).
간편결제를 우리 화면에서 이미 분리했으므로 결제창에 또 넣으면 같은 수단이 두 번 나온다.
`nicepay-checkout.test.ts` 의 고정 테스트도 같이 바꿔야 한다(그 테스트가 이 변경을 막아준다 —
의도된 브레이크다).

### 3-2. 픽커 (`toss-payment-method-picker.tsx`)

지금 이미 있는 것 — 재사용:
- `provider` prop 분기
- 나이스페이일 때 계좌이체 무조건 제외(2026-09-08 영구화)
- 숨겨진 값이 선택돼 있으면 첫 옵션으로 폴백하는 `useEffect`

추가되는 것 하나: `only: 'nicepay'` 필터. 레이아웃은 `grid sm:grid-cols-2` 가 5개도 그대로
받는다(2열 × 3행). 아이콘은 붙이지 않는다 — PG 브랜드 로고는 각사 가이드라인이 있어
텍스트 라벨로 시작하고, 필요하면 나중에 별도 건으로.

### 3-3. 호출부

`toss-membership-checkout.tsx` 는 **바뀔 게 없다**. `toNicepayMethod(paymentMethod)` 그대로.
타입만 `TossPaymentMethodCode` → `PaymentMethodCode` 로 넓힌다.

## 4. 트레이드오프

| | 지금(`cardAndEasyPay`) | 제안(분리) |
|---|---|---|
| 우리 화면 클릭 | 1 (카드) | 1 (수단 직접) |
| 결제창 안 클릭 | 1 (수단 고르기) | **0** |
| 순서 제어 | 불가 | **우리가 결정** |
| 안 열린 수단 | 조용히 안 보임 | **버튼은 보이는데 창에서 실패** ← 위험 |

**마지막 줄이 이 설계의 유일한 실제 위험이다.** `cardAndEasyPay` 는 계약에 없는 수단을 알아서
숨기지만, 우리가 버튼을 직접 그리면 계약에 없는 수단도 버튼이 보이고 **사용자가 누른 뒤에야**
실패한다(계좌이체 W004 와 같은 형태 — 그때도 결제창 마지막 단계에서 터졌다).

→ **완화**: 각 수단을 env 플래그로 감싸고, **실결제로 확인된 수단만 켠 채 배포**한다.

⚠️ 단, 플래그는 "켜도 되는 것"에만 단다. 계좌이체가 그 반례다 — 켜면 안 되는 수단에 복구
플래그를 남겨뒀다가, env 한 줄로 라이브 결제가 죽는 지뢰가 됐다(2026-09-08 삭제).
되살리면 안 되는 건 플래그가 아니라 코드에서 지우고 이유를 그 자리에 적는다.

## 5. 작업 순서

1. `methods.ts` 옵션 테이블 + `PaymentMethodCode` 유니온, `only` 필터
   (나이스페이 목록에 `TRANSFER` 를 넣지 않는다)
2. `toNicepayMethod` 를 switch → 테이블 조회로 (매핑 정본 1곳)
3. 픽커에 `only` 필터 추가 (기존 폴백 `useEffect` 가 자동으로 커버)
4. 호출부 타입 확장
5. 테스트: 토스 provider 에 간편결제 코드가 **절대 안 나온다**는 단언 + 매핑표 고정
   + 기존 "어떤 입력에도 `bank` 로 매핑되지 않는다" 단언 유지
6. 390px 렌더 확인(5개 옵션 2열 배치)

## 6. ⚠️ 시작 전에 확인할 것

1. **어떤 수단이 실제로 계약에 열렸나** — 지금은 카카오·네이버·삼성이 다 뜬다고 확인됐다.
   페이코·SSG 도 열렸는지는 미확인(열렸으면 같은 방식으로 2줄 추가).
2. **네이버페이 포인트** — `naverpayCard` 는 매뉴얼상 "신용카드 전액결제(**포인트 이용불가**)".
   포인트 결제를 원하면 별도 수단 값이 필요한지 나이스페이 확인 필요.
3. **카카오페이** — `kakaopay`(카드/머니 전액) vs `kakaopayCard` vs `kakaopayMoney` 중 무엇을
   보낼지. 기본은 `kakaopay`(사용자가 카카오 창에서 카드/머니 선택).
4. **취소/환불** — 간편결제 건이 동일 cancel API 로 되는지 원문 미대조.
5. **가상계좌(`vbank`)·휴대폰(`cellphone`)** — 매뉴얼엔 있지만 계좌이체와 같은 이유로
   막힐 수 있다. 넣기 전에 나이스페이 확인 필수(추측으로 추가하지 말 것).
