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

/** 주석을 뺀 코드 — 설명 문구가 금지 패턴에 걸리지 않게(줄 끝 주석은 남는다). */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// PR7(2026-09-13) — 처음 정규식은 작은따옴표 `.insert` · 이름 그대로의 호출 · SDK 헬퍼 두 이름만 봐서
//   큰따옴표(layout.tsx 가 실제로 쓴다) · upsert · 별칭 import · 결제창 직접 호출이 초록으로 지나갔다(뮤테이션 실측).
test('payment_orders 를 insert 하는 곳은 order-ledger 1곳뿐', () => {
  const hits = FILES.filter(
    (f) => /from\(\s*['"]payment_orders['"]\s*\)[\s\S]{0,120}\.(insert|upsert)\(/.test(f.text)
  ).map((f) => f.rel);
  assert.deepEqual(hits, ['src/lib/payments/order-ledger.ts'], hits.join(', '));
});

test('createPaymentOrder 호출부는 prepare 1곳뿐', () => {
  const hits = FILES.filter(
    (f) =>
      /import\s*\{[^}]*\bcreatePaymentOrder\b|\bcreatePaymentOrder\s*\(/.test(f.text) &&
      !f.rel.endsWith('order-ledger.ts')
  ).map((f) => f.rel);
  assert.deepEqual(hits, ['src/app/api/payments/prepare/route.ts'], hits.join(', '));
});

test('PG 결제창을 여는 컴포넌트는 체크아웃 1곳뿐', () => {
  const hits = FILES.filter(
    (f) =>
      /requestNicepayPayment\s*\(|loadTossPayments\s*\(|\bAUTHNICE\b|@tosspayments\//.test(f.text) &&
      !f.rel.endsWith('nicepay-checkout.ts')
  ).map((f) => f.rel);
  assert.deepEqual(hits, ['src/components/membership/toss-membership-checkout.tsx'], hits.join(', '));
});

// 🔴 타입이 못 잡는 자리. 여기가 어긋나면 confirm:66 / nicepay-return:216 의 금액 대조에서
//   **쿠폰 없는 결제까지 전건 거부**된다(매출 0 사고).
// PR7 — 파일 어디든 `amount: order.amount` 가 있으면 통과하던 가드였다. 퍼널 로그에 이미 그 줄이 있어
//   실제 응답을 `quote.listAmount` 로 바꿔도 초록이었다(뮤테이션 실측) → **성공 응답 객체 안**을 본다.
test('prepare 응답의 amount 는 order.amount 다 — 정가(listAmount)를 내보내지 않는다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  const response = stripComments(src.slice(src.lastIndexOf('return NextResponse.json({')));
  assert.ok(/orderId: order\.orderId,/.test(response), '마지막 응답이 주문 성공 응답이어야 한다(구조가 바뀌면 이 가드를 다시 써라)');
  assert.deepEqual(response.match(/\bamount:[^,\n]*/g), ['amount: order.amount'], '응답 금액은 order.amount 하나뿐');
});

// 할인율·금액을 클라이언트에서 받으면 서버가 유일한 진실이라는 전제가 무너진다.
// PR7 — 금지 키 목록은 구조분해(`const { finalAmount } = payload`)와 목록에 없는 키(`payload.listAmount`)를 놓쳤다(뮤테이션 실측)
//   → 읽는 키를 **허용 목록**으로 고정하고, 그 밖의 payload 사용(구조분해·전개·다른 함수로 넘기기)은 전부 막는다.
test('prepare 가 요청 본문에서 읽는 키는 허용 목록뿐 — 금액·할인율은 서버가 정한다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/payments/prepare/route.ts')!.text;
  const keys = new Set<string>();
  const rest = src.replace(/readString\(payload, '(\w+)'\)|payload\.(\w+)/g, (_, read: string, prop: string) => {
    keys.add(read ?? prop);
    return '';
  });
  assert.deepEqual(
    [...keys].sort(),
    ['acceptedKinds', 'analyticsConsent', 'couponCode', 'expectedAmount', 'from', 'packageId', 'paymentMethod', 'plan', 'product', 'scope', 'slug'],
    '새 키를 읽으려면 금액·할인에 쓰이지 않는지 확인하고 이 목록을 고쳐라'
  );
  assert.equal(rest.match(/\bpayload\b/g)?.length, 2, 'payload 는 선언과 null 검사에만 — 구조분해·전개·전달 금지');
});

// 🔴 PR3 — 쿠폰이 붙은 뒤 폴백이 남아 있으면 "할인 실패 → 조용히 다른 금액 청구"가 된다(설계 §3-3).
test('PG 청구액은 prepare 응답(order.amount)뿐 — 체크아웃 컴포넌트에 prop 금액 폴백이 없다', () => {
  const src = FILES.find((f) => f.rel === 'src/components/membership/toss-membership-checkout.tsx')!.text;
  assert.ok(!/prepare\.amount[^;\n]*:\s*amount\b/.test(src), 'prepare.amount 가 없을 때 prop amount 로 폴백하면 안 된다');
  // PR7 — 서버 금액이 없거나 이상하면 결제창을 열지 않는 블록(이 블록을 통째로 지워도 초록이었다).
  assert.ok(
    /if \(\s*typeof prepare\.amount !== 'number' \|\|\s*!Number\.isInteger\(prepare\.amount\) \|\|\s*prepare\.amount <= 0\s*\) \{\s*setErrorMessage\([^)]*\);\s*return;\s*\}\s*const chargeAmount = prepare\.amount;/.test(src),
    'PG 금액은 검증을 통과한 prepare.amount 를 그대로 써야 한다'
  );
});

test('체크아웃 화면 금액에 카탈로그 정가 폴백(?? paymentPackage.price)이 없다', () => {
  const src = FILES.find((f) => f.rel === 'src/app/membership/checkout/page.tsx')!.text;
  assert.ok(!/\?\?\s*paymentPackage\.price/.test(src), '화면 금액은 resolveChargeForUser 결과만 쓴다');
  assert.ok(/resolveChargeForUser\(/.test(src), '체크아웃은 prepare 와 같은 함수로 금액을 내야 한다');
  // PR7 — 결제 버튼 금액(= expectedAmount · GA begin_checkout)과 checkout_viewed 값은 할인 후 금액(설계 §3-3·§10).
  //   정가를 넘기면 할인 결제가 전부 amount_changed 로 막힌다. 정가는 취소선 표시에만 쓴다.
  assert.ok(/amount=\{quote\.chargeAmount\}/.test(src) && /value=\{quote\.chargeAmount\}/.test(src));
  assert.ok(!/(amount|value)=\{quote\.listAmount\}/.test(src), '정가는 취소선 표시에만');
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
  // PR7(§13-8) — 본인 재사용(mode 'self')도 bindCouponClaim 을 지나야 쿠폰이 나온다. 조건에 mode 를 끼우면
  //   귀속된 고객의 두 번째 결제부터 전부 coupon_bind_failed 409 가 된다(뮤테이션 실측).
  assert.ok(/const coupon = quote\.claim\s*\?\s*await bindCouponClaim\(quote\.claim, userId,/.test(src));
});

// 전역 가격 표시 맵은 루트 레이아웃의 **전 방문자 공유 캐시**다(layout.tsx 에 인증 호출 0건).
// 사용자별 값을 넣으면 앱 전체가 동적 렌더가 되어 캐시가 폐기되고, generateMetadata·
// search-index 처럼 사용자 컨텍스트가 없는 소비처는 담을 그릇조차 없다(설계 §3-2 · §13-6).
// PR7 — 원래 가드는 price-display.ts 한 파일에서 `userId`·`coupon` 두 단어만 보고, 파일이 없으면 조용히 통과했다.
//   buildPriceDisplayMap 본체(price-display-shared.ts)에 쿠폰 인자를 더해도 초록이었다(뮤테이션 실측) → 체인 전체 + 레이아웃.
const PRICE_CHAIN = [
  'src/lib/payments/price-resolver.ts', // DB·카탈로그 → 리졸브 가격
  'src/lib/payments/price-display-shared.ts', // buildPriceDisplayMap(순수)
  'src/lib/payments/price-display.ts', // getPriceDisplayMap(요청 캐시)
  'src/components/payments/price-provider.tsx', // <PriceProvider>·<Price>
];
const USER_DEPENDENT =
  /next\/headers|\b(cookies|headers|draftMode|connection)\s*\(|\bcreateClient\s*\(|\bauth\.|getUser|getSession|coupon|discount|\buser|viewer|session/i;
const DYNAMIC_LAYOUT =
  /from\s*["']next\/(headers|server)["']|\b(cookies|headers|draftMode|connection)\s*\(|@\/lib\/supabase\/|getUser|getSession|export const (dynamic|revalidate|fetchCache)\b/;

test('가격 표시 체인(리졸버 → 맵 → Provider)은 사용자·쿠폰·세션을 모르고 인자도 받지 않는다', () => {
  // 패턴이 헛돌지 않는지 먼저 — 막아야 할 모양을 실제로 잡는가.
  for (const bad of ['await cookies()', 'createClient()', 'auth.getUser()', 'couponCode?: string', 'viewerId', 'applyCouponDiscount(']) {
    assert.ok(USER_DEPENDENT.test(bad), bad);
  }
  for (const rel of PRICE_CHAIN) {
    const file = FILES.find((f) => f.rel === rel);
    assert.ok(file, `${rel} 가 없다 — 가격 표시 체인이 바뀌었으면 이 가드를 다시 써라`);
    assert.ok(!USER_DEPENDENT.test(stripComments(file.text)), `${rel} 에 사용자·쿠폰·세션 의존이 들어왔다`);
  }
  // 인자가 생기면 cache 키가 사용자별로 갈라진다. 기본값 인자는 Function.length 가 못 세서 시그니처를 본다.
  const text = (rel: string) => FILES.find((f) => f.rel === rel)!.text;
  assert.ok(/export const getResolvedPrices = cache\(async \(\): Promise</.test(text(PRICE_CHAIN[0])));
  assert.ok(/export function buildPriceDisplayMap\(\s*resolved: Map<PackageId, ResolvedPrice>\s*\):/.test(text(PRICE_CHAIN[1])));
  assert.ok(
    /export const getPriceDisplayMap = cache\(\s*async \(\): Promise<Record<PackageId, PriceDisplay>> =>\s*buildPriceDisplayMap\(await getResolvedPrices\(\)\)\s*\);/.test(
      text(PRICE_CHAIN[2])
    )
  );
});

test('루트 레이아웃은 정적이다 — 쿠키·인증·동적 선언 없이 가공하지 않은 맵을 넘긴다', () => {
  for (const bad of ["import { cookies } from 'next/headers'", 'await headers()', "import { createClient } from '@/lib/supabase/server'", "export const dynamic = 'force-dynamic'"]) {
    assert.ok(DYNAMIC_LAYOUT.test(bad), bad);
  }
  const src = FILES.find((f) => f.rel === 'src/app/layout.tsx')!.text;
  assert.ok(!DYNAMIC_LAYOUT.test(stripComments(src)), 'layout.tsx 가 요청마다 달라지면 가격 맵이 방문자 공유 캐시가 아니게 된다');
  assert.ok(/const priceMap = await getPriceDisplayMap\(\);/.test(src) && /<PriceProvider map=\{priceMap\}>/.test(src));
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

// 2026-09-13 — 미리보기 쿠폰은 "다른 쿠폰 코드 쓰기"로 바꿀 수 있어야 한다(입력칸을 적용된 쿠폰 여부로만 숨기면 30분간 못 바꾼다).
test('체크아웃 입력칸은 checkoutCouponInputMode 로 정한다(미리보기=바꾸기, 등록된 쿠폰=없음)', () => {
  const src = CHECKOUT_PAGE();
  assert.ok(/checkoutCouponInputMode\(quote\)/.test(src));
  assert.ok(!/!quote\.couponCode && !funnelBlocked/.test(src), '적용된 쿠폰이 있다고 입력칸을 통째로 숨기면 미리보기를 못 바꾼다');
});

// ─────────────────────────────────────────────────────────────
// §13-9 환불 — 할인 결제의 환불액은 order.amount(실청구액)다. PR7(2026-09-13).
//   관리자 환불은 요청 스냅샷(refund_requests.amount · original_amount)으로 PG 를 부르고, 둘이 같으면 전액 취소(금액 미전송)다.
//   원결제액 자리에 정가가 들어가면 2,970 < 3,300 → 부분취소로 판정돼 금액이 실리고, 주문도 refunded 로 바뀌지 않는다.
//   환불 라우트·지급은 DB·PG 를 직접 불러 행동 테스트가 안 돼 소스로 고정한다(목록 금액은 user-detail.test.ts 가 값으로 본다).
// ─────────────────────────────────────────────────────────────
test('관리자 환불 요청 스냅샷은 주문·이용권의 실결제액이고, 환불액 = 원결제액', () => {
  const src = FILES.find((f) => f.rel === 'src/app/api/admin/refund/route.ts')!.text;
  assert.ok(/amount: order\.amount,\s*original_amount: order\.amount,/.test(src), '주문 단위(번들·고아 주문·멤버십)');
  assert.ok(/amount: e\.amount,\s*original_amount: e\.amount,/.test(src), '이용권 단위');
});

test('이용권·전 지급 금액은 승인된 주문의 실결제액(claimed.amount) — 환불 스냅샷의 원천', () => {
  const amounts = stripComments(FILES.find((f) => f.rel === 'src/lib/payments/fulfillment.ts')!.text).match(/\bamount:[^,\n]*/g) ?? [];
  assert.equal(amounts.length, 4, amounts.join(' | '));
  assert.ok(amounts.every((a) => a === 'amount: claimed.amount'), amounts.join(' | '));
});

// 환불·집계·결제내역·웹훅이 `amount` 대신 정가 스냅샷을 읽기 시작하면 여기서 걸린다.
test('정가·할인 스냅샷(list_amount·discount_won·coupon_percent)을 읽는 파일은 결제 준비·쿠폰 모듈뿐', () => {
  const hits = FILES.filter((f) => /\b(list_amount|listAmount|discount_won|discountWon|coupon_percent)\b/.test(f.text))
    .map((f) => f.rel)
    .sort();
  assert.deepEqual(
    hits,
    [
      'src/app/admin/coupons/coupon-admin-client.tsx',
      'src/app/api/payments/prepare/route.ts',
      'src/app/membership/checkout/page.tsx',
      'src/lib/coupons/coupon-admin.ts',
      'src/lib/coupons/coupon-charge.ts',
      'src/lib/coupons/discount-coupon.ts',
      'src/lib/payments/coupon-order-guard.ts',
      'src/lib/payments/order-ledger.ts',
    ],
    '새 파일이 정가 필드를 읽는다 — 환불·집계·결제내역이면 order.amount 를 써라'
  );
});

// 설계 §7 — 전(재화) 차감 언락은 결제 원장을 통째로 우회한다. 여기에 할인쿠폰이 붙으면 이미 산 재화를 한 번 더 깎아 준다.
test('전 차감·언락 경로는 할인쿠폰 모듈을 쓰지 않고, 체크아웃은 그 이유를 말한다', () => {
  const hits = FILES.filter(
    (f) =>
      (/deduct_credits|deductCredits\(/.test(f.text) || /\/unlock\//.test(f.rel)) &&
      /@\/lib\/coupons\/(discount-coupon|coupon-charge)/.test(f.text)
  ).map((f) => f.rel);
  assert.deepEqual(hits, []);
  assert.ok(CHECKOUT_PAGE().includes('쿠폰은 이 화면의 카드·간편결제에만 적용돼요. 전으로 여는 경우엔 적용되지 않아요.'));
});
