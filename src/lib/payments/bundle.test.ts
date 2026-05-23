import assert from 'node:assert/strict';
import { getPackage } from './catalog';
import {
  areAllBundleComponentsOwned,
  grantBundleComponents,
  resolveBundleGrantInputs,
  revokeBundleComponents,
} from './bundle';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 오늘 풀세트(990원) = today-detail + score-factor F1~F5 를 6개 구성품 grant 입력으로
// 분해한다. confirm 이 이 목록을 순회하며 각 구성품을 resolvePaymentProductScope +
// grantTasteProductEntitlement 한다(1결제 = N권한). 분해가 어긋나면 결제했는데 일부
// 권한이 안 열리거나 환불 회수가 누락된다.
test('resolveBundleGrantInputs expands 오늘 풀세트 into today-detail + 5 score factors', () => {
  const bundle = getPackage('bundle_today_set');
  assert.ok(bundle, 'bundle_today_set 패키지가 catalog 에 있어야 함');

  const inputs = resolveBundleGrantInputs(bundle);
  assert.equal(inputs.length, 6);
  assert.deepEqual(
    inputs.map((i) => `${i.tasteProductId}:${i.scope ?? ''}`),
    [
      'today-detail:',
      'score-factor:F1',
      'score-factor:F2',
      'score-factor:F3',
      'score-factor:F4',
      'score-factor:F5',
    ]
  );
  // 각 구성품은 resolvePaymentProductScope 에 넘길 단품 패키지를 동반한다.
  assert.equal(inputs[0].pkg.id, 'taste_today_detail');
  assert.equal(inputs[1].pkg.id, 'taste_score_factor');
});

test('resolveBundleGrantInputs returns empty for a non-bundle package', () => {
  const single = getPackage('taste_today_detail');
  assert.ok(single);
  assert.deepEqual(resolveBundleGrantInputs(single), []);
});

// confirm 의 묶음 grant 흐름. resolveScope/grant 를 주입받아(라우트 DB 의존 분리)
// 각 구성품을 파생 scope 로 grant 하는지, 모든 grant 가 같은 paymentKey 를 갖는지
// (환불 일괄 회수 전제) 검증.
test('grantBundleComponents grants every component with derived scope and shared paymentKey', async () => {
  const bundle = getPackage('bundle_today_set');
  assert.ok(bundle);

  const grantCalls: Array<{
    productId: string;
    scopeKey: string | null;
    paymentKey: string | null;
    packageId: string;
  }> = [];

  const result = await grantBundleComponents(
    bundle,
    { userId: 'u1', slug: 's1', orderId: 'o1', paymentKey: 'pk1', packageId: 'bundle_today_set' },
    {
      resolveScope: async ({ pkg, scope }) => ({
        scopeKey: `${pkg.tasteProductId}:${scope ?? 'today'}`,
      }),
      grant: async (userId, productId, options) => {
        grantCalls.push({
          productId,
          scopeKey: options.scopeKey,
          paymentKey: options.paymentKey,
          packageId: options.packageId,
        });
      },
    }
  );

  assert.equal(grantCalls.length, 6);
  assert.equal(grantCalls[0].productId, 'today-detail');
  assert.equal(grantCalls[0].scopeKey, 'today-detail:today');
  assert.equal(grantCalls[1].productId, 'score-factor');
  assert.equal(grantCalls[1].scopeKey, 'score-factor:F1');
  assert.equal(grantCalls[5].scopeKey, 'score-factor:F5');
  // 환불 일괄 회수를 위해 모든 grant 가 같은 결제 키 + 묶음 packageId 를 가져야 함.
  assert.ok(grantCalls.every((c) => c.paymentKey === 'pk1'));
  assert.ok(grantCalls.every((c) => c.packageId === 'bundle_today_set'));
  assert.equal(result.length, 6);
});

// scope 파생 실패(null) 구성품은 grant 를 건너뛴다(부분 실패가 전체 결제를 막지 않음).
test('grantBundleComponents skips components whose scope cannot be resolved', async () => {
  const bundle = getPackage('bundle_today_set');
  assert.ok(bundle);

  let grantCount = 0;
  const result = await grantBundleComponents(
    bundle,
    { userId: 'u1', slug: null, orderId: null, paymentKey: 'pk1', packageId: 'bundle_today_set' },
    {
      resolveScope: async () => null,
      grant: async () => {
        grantCount += 1;
      },
    }
  );

  assert.equal(grantCount, 0);
  assert.equal(result.length, 0);
});

// prepare 의 묶음 중복 결제 차단(b1 정합) — 구성품을 전부 보유한 경우에만
// alreadyPurchased 로 차단. 하나라도 미보유면 결제 허용(보유분은 grant 가 멱등 skip).
test('areAllBundleComponentsOwned is true only when every component is owned', async () => {
  const bundle = getPackage('bundle_today_set');
  assert.ok(bundle);

  const allOwned = await areAllBundleComponentsOwned(bundle, 's1', {
    resolveScope: async ({ pkg, scope }) => ({ scopeKey: `${pkg.tasteProductId}:${scope ?? 'today'}` }),
    hasEntitlement: async () => true,
  });
  assert.equal(allOwned, true);
});

test('areAllBundleComponentsOwned is false when any single component is missing', async () => {
  const bundle = getPackage('bundle_today_set');
  assert.ok(bundle);

  const partiallyOwned = await areAllBundleComponentsOwned(bundle, 's1', {
    resolveScope: async ({ pkg, scope }) => ({ scopeKey: `${pkg.tasteProductId}:${scope ?? 'today'}` }),
    // score-factor F3 한 항목만 미보유 → 묶음 차단되면 안 됨(재결제 허용).
    hasEntitlement: async (_productId, scopeKey) => scopeKey !== 'score-factor:F3',
  });
  assert.equal(partiallyOwned, false);
});

test('areAllBundleComponentsOwned is false for a non-bundle package', async () => {
  const single = getPackage('taste_today_detail');
  assert.ok(single);

  const result = await areAllBundleComponentsOwned(single, 's1', {
    resolveScope: async () => ({ scopeKey: 'x' }),
    hasEntitlement: async () => true,
  });
  assert.equal(result, false);
});

// 묶음 환불 회수 — grantBundleComponents 의 역연산. 같은 분해로 각 구성품 scope 를
// revokeProductEntitlement(b3) 한다. 환불 사유/처리자가 모든 회수에 전달돼야 audit 가 남는다.
test('revokeBundleComponents revokes every component scope with the refund reason', async () => {
  const bundle = getPackage('bundle_today_set');
  assert.ok(bundle);

  const revokeCalls: Array<{ productId: string; scopeKey: string | null; reason: string }> = [];

  const result = await revokeBundleComponents(
    bundle,
    { userId: 'u1', slug: 's1', reason: '결제 회귀 환불', actor: 'admin', paymentKey: 'pk1' },
    {
      resolveScope: async ({ pkg, scope }) => ({ scopeKey: `${pkg.tasteProductId}:${scope ?? 'today'}` }),
      revoke: async (_userId, productId, scopeKey, options) => {
        revokeCalls.push({ productId, scopeKey, reason: options.reason });
        return { revoked: true };
      },
    }
  );

  assert.equal(revokeCalls.length, 6);
  assert.equal(revokeCalls[0].scopeKey, 'today-detail:today');
  assert.equal(revokeCalls[1].scopeKey, 'score-factor:F1');
  assert.equal(revokeCalls[5].scopeKey, 'score-factor:F5');
  assert.ok(revokeCalls.every((c) => c.reason === '결제 회귀 환불'));
  assert.equal(result.length, 6);
  assert.ok(result.every((r) => r.revoked));
});

test('revokeBundleComponents returns empty for a non-bundle package', async () => {
  const single = getPackage('taste_today_detail');
  assert.ok(single);

  const result = await revokeBundleComponents(
    single,
    { userId: 'u1', slug: 's1', reason: 'x' },
    {
      resolveScope: async () => ({ scopeKey: 'x' }),
      revoke: async () => ({ revoked: true }),
    }
  );
  assert.deepEqual(result, []);
});
