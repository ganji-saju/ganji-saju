// 할인쿠폰이 "전 유료 표면"을 덮는다는 주장은 아래 불변식 위에 서 있다.
// 하나라도 깨지면 새 결제 경로가 할인을 우회하고 있다는 뜻이다.
//
// 선례: src/lib/admin/admin-type-ramp.test.ts 가 같은 방식으로 src 전체를 스캔한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FILES = tsFiles(SRC).map((f) => ({ rel: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }));

test('payment_orders 를 insert 하는 곳은 order-ledger 1곳뿐', () => {
  const hits = FILES.filter(
    (f) => /from\('payment_orders'\)[\s\S]{0,120}\.insert\(/.test(f.text)
  ).map((f) => f.rel);
  assert.deepEqual(hits, ['src/lib/payments/order-ledger.ts'], hits.join(', '));
});

test('createPaymentOrder 호출부는 prepare 1곳뿐', () => {
  const hits = FILES.filter(
    (f) => /createPaymentOrder\s*\(/.test(f.text) && !f.rel.endsWith('order-ledger.ts')
  ).map((f) => f.rel);
  assert.deepEqual(hits, ['src/app/api/payments/prepare/route.ts'], hits.join(', '));
});

test('PG 결제창을 여는 컴포넌트는 체크아웃 1곳뿐', () => {
  const hits = FILES.filter(
    (f) =>
      /requestNicepayPayment\s*\(|loadTossPayments\s*\(/.test(f.text) &&
      !f.rel.endsWith('nicepay-checkout.ts')
  ).map((f) => f.rel);
  assert.deepEqual(hits, ['src/components/membership/toss-membership-checkout.tsx'], hits.join(', '));
});

// 🔴 타입이 못 잡는 자리. 여기가 어긋나면 confirm:66 / nicepay-return:216 의 금액 대조에서
//   **쿠폰 없는 결제까지 전건 거부**된다(매출 0 사고).
test('prepare 응답의 amount 는 order.amount 다 — 정가(listAmount)를 내보내지 않는다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  assert.ok(/amount:\s*order\.amount/.test(src), 'prepare 응답이 order.amount 를 써야 한다');
  assert.ok(
    !/amount:\s*listAmount\b/.test(src),
    'prepare 가 정가를 응답·퍼널에 그대로 내보내면 안 된다'
  );
});

// 할인율·금액을 클라이언트에서 받으면 서버가 유일한 진실이라는 전제가 무너진다.
// prepare 는 요청 본문을 `payload` 로 받는다 — 두 이름 다 본다(원래 가드는 body 만 봐서 실효가 없었다).
test('prepare 는 body 에서 할인율·최종금액을 읽지 않는다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  for (const key of ['discountRate', 'discountPercent', 'discountWon', 'percent', 'finalAmount', 'chargeAmount', 'amount']) {
    assert.ok(
      !new RegExp(`\\b(body|payload)\\b[^\\n]{0,40}\\b${key}\\b`).test(src),
      `${key} 를 요청 본문에서 읽으면 안 된다`
    );
  }
});

// 🔴 PR3 — 쿠폰이 붙은 뒤 폴백이 남아 있으면 "할인 실패 → 조용히 다른 금액 청구"가 된다(설계 §3-3).
test('PG 청구액은 prepare 응답(order.amount)뿐 — 체크아웃 컴포넌트에 prop 금액 폴백이 없다', () => {
  const src = FILES.find((f) => f.rel === 'src/components/membership/toss-membership-checkout.tsx')!.text;
  assert.ok(!/prepare\.amount[^;\n]*:\s*amount\b/.test(src), 'prepare.amount 가 없을 때 prop amount 로 폴백하면 안 된다');
  assert.ok(/const chargeAmount = prepare\.amount;/.test(src), 'PG 금액은 prepare.amount 를 그대로 써야 한다');
});

test('체크아웃 화면 금액에 카탈로그 정가 폴백(?? paymentPackage.price)이 없다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/membership/checkout/page.tsx')!.text;
  assert.ok(!/\?\?\s*paymentPackage\.price/.test(src), '화면 금액은 resolveChargeForUser 결과만 쓴다');
  assert.ok(/resolveChargeForUser\(/.test(src), '체크아웃은 prepare 와 같은 함수로 금액을 내야 한다');
});

// 🔴 리뷰 발견(2026-09-11): prepare 가 화면 금액을 몰라, 미리보기 뒤 요율이 바뀌면 화면보다 비싸게 청구됐다.
//   expectedAmount 는 **대조 전용**이다 — 주문 금액 인자로 흘러가는 순간 클라이언트가 가격을 정한다.
test('prepare 는 화면 금액(expectedAmount)을 대조에만 쓰고, 체크아웃이 그 값을 보낸다', () => {
  const route = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  assert.ok(/expectedAmount !== quote\.chargeAmount/.test(route), '표시가 ≠ 청구가면 멈춰야 한다');
  assert.ok(!/:\s*expectedAmount\b/.test(route), 'expectedAmount 를 어떤 인자·필드 값으로도 넘기면 안 된다');
  const client = FILES.find((f) => f.rel === 'src/components/membership/toss-membership-checkout.tsx')!.text;
  assert.ok(/expectedAmount:\s*amount\b/.test(client), '체크아웃이 표시 금액을 prepare 로 보내야 대조가 작동한다');
});

test('prepare 는 쿠폰을 resolveChargeForUser 로 계산하고 주문에 넘긴다(coupon: null 고정 금지)', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  assert.ok(/resolveChargeForUser\(/.test(src));
  assert.ok(!/coupon:\s*null/.test(src), 'coupon: null 로 되돌리면 쿠폰이 조용히 꺼진다');
  assert.ok(/listAmount:\s*quote\.listAmount/.test(src), '정가는 화면과 같은 quote 에서 가져온다');
});

// 전역 가격 표시 맵은 루트 레이아웃의 **전 방문자 공유 캐시**다(layout.tsx 에 인증 호출 0건).
// 사용자별 값을 넣으면 앱 전체가 동적 렌더가 되어 캐시가 폐기되고, generateMetadata·
// search-index 처럼 사용자 컨텍스트가 없는 소비처는 담을 그릇조차 없다.
test('가격 표시 맵에 user/coupon 의존 값을 넣지 않는다', () => {
  const display = FILES.find((f) => f.rel === 'src/lib/payments/price-display.ts');
  if (!display) return; // 파일 구조가 바뀌면 이 가드는 의미를 잃는다 — 그때 다시 쓴다.
  assert.ok(
    !/\buserId\b|\bcoupon\b/.test(display.text),
    'price-display 는 사용자별 값을 몰라야 한다(체크아웃에서만 할인 표기)'
  );
});

// 리뷰 발견(2026-09-11): 세션 쿠키가 SameSite=Lax 라 다른 사이트가 연 `?coupon=` 링크에도 실린다 —
//   미리보기(조회 예산 차감)를 교차 사이트 요청에서 하면 남의 페이지가 이 사용자의 예산을 대신 태운다.
test('체크아웃은 교차 사이트 요청에서 쿠폰 미리보기를 하지 않는다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/membership/checkout/page.tsx')!.text;
  assert.ok(/sec-fetch-site'\)\s*===\s*'cross-site'\s*\?\s*undefined\s*:\s*coupon/.test(src));
});

// PR5(2026-09-13) 입력칸 — 코드가 URL 에 실리면 방문기록·GA·리퍼러로 새고, 다른 사이트가 연 링크가 이 사용자의 조회 예산을
//   태운다(위 가드는 `?coupon=` 링크용). 입력은 서버 액션(POST — Next 가 Origin 을 검사)으로 받아 체크아웃 전용 짧은 쿠키에 둔다.
const CHECKOUT_PAGE = () => FILES.find((f) => f.rel === 'src/app/membership/checkout/page.tsx')!.text;

test('쿠폰 입력칸은 서버 액션으로 받아 체크아웃 전용 짧은 쿠키에 둔다 — 코드가 URL 에 남지 않는다', () => {
  const action = FILES.find((f) => f.rel === 'src/app/membership/checkout/coupon-action.ts');
  assert.ok(action, '입력칸 서버 액션 파일이 있어야 한다');
  assert.ok(/^'use server';/m.test(action.text));
  const set = action.text.match(/\.set\(COUPON_INPUT_COOKIE,[\s\S]*?\}\)/)?.[0] ?? '';
  for (const opt of [/httpOnly:\s*true/, /sameSite:\s*'lax'/, /path:\s*'\/membership\/checkout'/, /maxAge:\s*30 \* 60/]) {
    assert.ok(opt.test(set), `쿠키 옵션 ${opt} 가 빠졌다`);
  }
  assert.ok(!/redirect\(/.test(action.text), '쿠키만 바꾸면 Next 가 같은 화면을 다시 그린다 — 코드를 실은 URL 로 보내지 않는다');
  assert.ok(/<form action=\{submitCouponInput\}/.test(CHECKOUT_PAGE()), '입력칸은 서버 액션 폼이어야 한다');
  assert.ok(!/method="get"/i.test(CHECKOUT_PAGE()), 'GET 폼이면 코드가 URL 에 실린다');
});

// 액션은 URL 을 바꾸지 않는다 — QR 로 들어와(`?coupon=A`) 다른 코드 B 를 입력하면 URL 의 A 가 이기면 안 된다.
test('체크아웃은 입력칸 쿠키를 ?coupon= 링크보다 먼저 쓴다(링크의 교차 사이트 가드는 그대로)', () => {
  assert.ok(
    /cookieStore\.get\(COUPON_INPUT_COOKIE\)\?\.value\s*\|\|\s*\(requestHeaders\.get\('sec-fetch-site'\)\s*===\s*'cross-site'\s*\?\s*undefined\s*:\s*coupon\)/.test(
      CHECKOUT_PAGE()
    )
  );
});

// payment_funnel_events 는 건수로 집계된다 — 입력칸 제출마다 checkout_viewed 가 늘면 "도달했는데 안 산다"가 부푼다.
test('입력칸 제출로 다시 그릴 때 checkout_viewed 를 또 남기지 않는다', () => {
  assert.ok(/if \(paymentPackage && !funnelSkipReason && !requestHeaders\.has\('next-action'\)\)/.test(CHECKOUT_PAGE()));
});

test('입력칸은 쿠폰이 붙는 상품에만 — 전이 전달물인 상품(설계 §7)엔 띄우지 않는다', () => {
  assert.ok(/isCouponEligiblePackage\(paymentPackage\)/.test(CHECKOUT_PAGE()));
});
