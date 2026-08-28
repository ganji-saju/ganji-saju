// 🔴 2026-08-29 — 결제 출처 판정. staging 과 프로덕션이 **같은 Supabase** 를 쓰기 때문에
//   이 판정이 틀리면 테스트 결제가 실매출로 둔갑하거나(반대로) 실결제가 지워진다.
import assert from 'node:assert/strict';
import {
  buildPaymentOrigin,
  isRealRevenueOrder,
  isRealRevenueOrigin,
  readPaymentOrigin,
  resolvePaymentOriginEnv,
} from './payment-origin';

declare const test: (name: string, fn: () => void) => void;

test('결제 출처: 호스트로 환경을 가른다', () => {
  assert.equal(resolvePaymentOriginEnv('ganjisaju.kr'), 'production');
  assert.equal(resolvePaymentOriginEnv('www.ganjisaju.kr'), 'production');
  assert.equal(resolvePaymentOriginEnv('staging.ganjisaju.kr'), 'staging');
  assert.equal(resolvePaymentOriginEnv('ganji-saju-abc123.vercel.app'), 'preview');
  assert.equal(resolvePaymentOriginEnv('localhost:3000'), 'local');
  assert.equal(resolvePaymentOriginEnv(null), 'unknown');
  // 대문자·스킴·경로가 섞여 들어와도 같은 판정이어야 한다(헤더는 신뢰 경계다).
  assert.equal(resolvePaymentOriginEnv('HTTPS://Staging.GanjiSaju.kr/checkout'), 'staging');
});

test('결제 출처: 스테이징 호스트를 프로덕션으로 오인하지 않는다', () => {
  // 접미사 매칭으로 짰다면 여기서 깨진다 — 'staging.ganjisaju.kr'.endsWith('ganjisaju.kr') 는 참이다.
  assert.notEqual(resolvePaymentOriginEnv('staging.ganjisaju.kr'), 'production');
  assert.equal(isRealRevenueOrigin('staging'), false);
  assert.equal(isRealRevenueOrigin('preview'), false);
  assert.equal(isRealRevenueOrigin('local'), false);
  assert.equal(isRealRevenueOrigin('production'), true);
});

test('결제 출처: 기록이 없는 과거 주문은 매출에서 빼지 않는다', () => {
  // 소급 판정이 불가능하다. 테스트로 몰면 과거 매출이 근거 없이 줄어든다 —
  // 화면에서 '출처 미기록'으로 따로 보이되 금액은 건드리지 않는다.
  assert.equal(readPaymentOrigin(null).env, 'unknown');
  assert.equal(readPaymentOrigin({ checkoutPath: '/x' }).env, 'unknown');
  assert.equal(isRealRevenueOrigin('unknown'), true);
});

test('결제 출처: 저장 → 복원이 같은 값이다', () => {
  const stored = buildPaymentOrigin('staging.ganjisaju.kr');
  assert.deepEqual(stored, { env: 'staging', host: 'staging.ganjisaju.kr' });
  assert.equal(readPaymentOrigin({ origin: stored }).env, 'staging');
});

test('결제 출처: env 가 깨져 있으면 host 로 다시 판정한다', () => {
  // 과거 값·수기 수정으로 env 만 이상해질 수 있다. host 가 남아 있으면 그게 진실이다.
  assert.equal(readPaymentOrigin({ origin: { env: 'nonsense', host: 'ganjisaju.kr' } }).env, 'production');
});

// 🔴 2026-08-29 — 매출 집계 필터. 이 판정이 틀리면 돈이 틀린다.
test('매출 집계: 테스트 결제는 빼고, 출처 미기록은 남긴다', () => {
  const staging = { metadata: { origin: { env: 'staging', host: 'staging.ganjisaju.kr' } } };
  const prod = { metadata: { origin: { env: 'production', host: 'ganjisaju.kr' } } };
  const legacy = { metadata: { checkoutPath: '/x' } }; // 출처 필드 생기기 전 주문

  assert.equal(isRealRevenueOrder(staging), false, '스테이징 결제가 매출에 남으면 안 된다');
  assert.equal(isRealRevenueOrder(prod), true);
  // 소급 판정이 불가능하다 — 테스트로 몰면 과거 매출이 근거 없이 줄어든다.
  assert.equal(isRealRevenueOrder(legacy), true, '출처 미기록을 빼면 과거 매출이 사라진다');
  assert.equal(isRealRevenueOrder(null), true);
  assert.equal(isRealRevenueOrder({}), true);
});
