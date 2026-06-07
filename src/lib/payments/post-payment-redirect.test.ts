import assert from 'node:assert/strict';
import {
  buildPremiumResultHref,
  buildTasteProductHref,
} from './post-payment-redirect';

declare const test: (name: string, fn: () => void) => void;

// love-question: 궁합 결과에서 결제 시 결과 화면으로 복귀(깊은 풀이 언락)
test('buildTasteProductHref: love-question 궁합결과 결제 → 결과화면 복귀', () => {
  assert.equal(
    buildTasteProductHref('love-question', null, null, 'compatibility-result'),
    '/compatibility/result?source=manual&paid=love-question'
  );
});

// 2026-06-07 회귀: compat-reading(per-couple 1회권) 분기 누락으로 productHref=null →
//   폴백이 /saju/{coupleKey}/premium 으로 오라우팅되어 404 나던 실손 버그 차단.
test('buildTasteProductHref: compat-reading 궁합결과 결제 → 결과화면 복귀(사주 프리미엄으로 새지 않음)', () => {
  const href = buildTasteProductHref(
    'compat-reading',
    'yzp24fdm55ha', // 커플 키 — 사주 reading slug 가 아님
    null,
    'compatibility-result'
  );
  assert.equal(href, '/compatibility/result?source=manual&paid=compat-reading');
  assert.ok(href !== null && !href.includes('/saju/'), '사주 경로로 새면 안 됨');
});

test('buildTasteProductHref: compat-reading 비-궁합 진입 → 궁합 입력 화면', () => {
  assert.equal(
    buildTasteProductHref('compat-reading', 'yzp24fdm55ha', null, 'membership'),
    '/compatibility/input?relationship=lover&paid=compat-reading'
  );
});

// 결제 직후 success page 분기 재현: productHref 가 non-null 이면 premiumResultHref 폴백은
// 실행되지 않는다. 폴백이 탔다면(=productHref null) 커플키가 사주 slug 자리에 들어가
// /saju/{coupleKey}/premium 404 가 발생한다.
test('compat-reading 은 productHref 가 채워져 premium 폴백(404 경로)을 타지 않는다', () => {
  const coupleKey = 'yzp24fdm55ha';
  const productHref = buildTasteProductHref(
    'compat-reading',
    coupleKey,
    null,
    'compatibility-result'
  );
  assert.ok(productHref, 'productHref 가 null 이면 폴백이 작동해 404 발생');
  // 폴백 자체는 (커플키를 사주 slug 로 취급해) 깨진 경로를 만든다 — 회귀 가드로 명시.
  assert.equal(
    buildPremiumResultHref('premium', coupleKey),
    '/saju/yzp24fdm55ha/premium?payment=confirmed&plan=premium'
  );
});
