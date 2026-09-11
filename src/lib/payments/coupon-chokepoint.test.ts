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
test('prepare 는 body 에서 할인율·최종금액을 읽지 않는다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  for (const key of ['discountRate', 'discountPercent', 'finalAmount', 'chargeAmount']) {
    assert.ok(!new RegExp(`body[\\s\\S]{0,40}${key}`).test(src), `${key} 를 body 에서 읽으면 안 된다`);
  }
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
