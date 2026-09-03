// 2026-09-03 — 퍼널 단계 정합 가드 (migration 077).
//
// 이 파일이 막는 사고 3가지:
//   ① TS 유니온에 단계를 추가하고 **DB CHECK 제약을 안 고치면** insert 가 프로덕션에서만
//      실패한다. funnel-log 는 실패를 console.error 로만 남기므로 화면은 조용히 빈다.
//   ② 집계(payment-funnel-stats)나 화면(payment-funnel-dashboard)에 단계를 안 넣으면
//      수집은 되는데 아무 데도 안 보인다 — paywall_viewed 가 2026-08-12~09-03 그 상태였다.
//   ③ 클라이언트가 기록 가능한 단계가 늘어나면 결제 성공까지 위조할 수 있다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIENT_EMITTABLE_STAGES, isClientEmittableStage } from './funnel-log';

declare const test: (name: string, fn: () => void) => void;

/** funnel-log.ts 의 PaymentFunnelStage 유니온에서 문자열 리터럴을 뽑는다. */
function unionStages(): string[] {
  const src = readFileSync('src/lib/payments/funnel-log.ts', 'utf8');
  const start = src.indexOf('export type PaymentFunnelStage =');
  const end = src.indexOf(';', start);
  return [...src.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

test('퍼널 단계: DB CHECK 제약(077)과 TS 유니온이 정확히 일치', () => {
  const sql = readFileSync('supabase/migrations/077_payment_funnel_checkout_login.sql', 'utf8');
  const check = sql.slice(sql.indexOf('CHECK (stage IN ('));
  const sqlStages = [...check.slice(0, check.indexOf('))')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...unionStages()].sort(),
    [...sqlStages].sort(),
    '유니온과 CHECK 제약이 어긋나면 insert 가 프로덕션에서만 조용히 실패한다'
  );
});

test('퍼널 단계: 새 단계가 집계와 화면에 모두 실린다', () => {
  const stats = readFileSync('src/lib/admin/payment-funnel-stats.ts', 'utf8');
  const statsStages = stats.slice(stats.indexOf('const STAGES'), stats.indexOf('] as const'));
  const dash = readFileSync('src/app/admin/payment-funnel/payment-funnel-dashboard.tsx', 'utf8');
  const labels = dash.slice(dash.indexOf('const STAGE_LABEL'), dash.indexOf('const BLOCK_REASON_LABEL'));
  const order = dash.slice(dash.indexOf('const STAGE_ORDER'), dash.indexOf('const STAGE_ORDER') + 400);

  for (const stage of unionStages()) {
    assert.ok(statsStages.includes(`'${stage}'`), `${stage} 가 집계 STAGES 에 없다 — 수집돼도 합계에 안 잡힌다`);
    assert.ok(labels.includes(`${stage}:`), `${stage} 라벨이 대시보드에 없다`);
    assert.ok(order.includes(`'${stage}'`), `${stage} 가 STAGE_ORDER 에 없다 — 화면에 안 그려진다`);
  }
});

test('퍼널 단계: 클라이언트가 기록 가능한 것은 login_required 하나뿐', () => {
  assert.deepEqual([...CLIENT_EMITTABLE_STAGES], ['login_required']);
  assert.ok(isClientEmittableStage('login_required'));
  for (const forged of ['confirm_success', 'prepare_ready', 'paywall_viewed', 'checkout_viewed']) {
    assert.equal(
      isClientEmittableStage(forged),
      false,
      `${forged} 를 브라우저가 심을 수 있으면 지표가 위조된다`
    );
  }
  assert.equal(isClientEmittableStage(null), false);
  assert.equal(isClientEmittableStage(42), false);
});

test('퍼널 단계: 클라이언트 창구는 금액을 받지 않는다(돈은 서버 원장만 만든다)', () => {
  const route = readFileSync('src/app/api/payments/funnel/route.ts', 'utf8');
  assert.ok(!/\bamount\b\s*:/.test(route), 'route 가 amount 를 기록하면 위조된 매출이 섞인다');
});

test('퍼널 단계: 로그인 벽 기록이 결제 이동을 막지 않는다(await 금지)', () => {
  const client = readFileSync('src/components/membership/toss-membership-checkout.tsx', 'utf8');
  const block = client.slice(client.indexOf('if (!isLoggedIn)'), client.indexOf('if (!isLoggedIn)') + 900);
  assert.ok(block.includes("stage: 'login_required'"), '로그인 벽 기록이 사라졌다');
  assert.ok(
    !/await fetch\('\/api\/payments\/funnel'/.test(block),
    '계측을 await 하면 기록 지연이 로그인 이동을 막는다'
  );
  assert.ok(block.includes('returned=1'), '복귀 표식이 없으면 login_returned 를 셀 수 없다');
});

// 2026-09-03 — staging 이 **프로덕션과 같은 DB** 를 본다(사용자 확인). 그래서 staging 트래픽이
//   퍼널에 섞이면 "페이월 노출 → 결제화면 도달" 전환율이 실제보다 낮게 나온다
//   (staging 노출은 분모에 더해지는데 도달은 이미 걸러지고 있었다 — 비대칭이라 더 나쁘다).
//   방문 계측 3곳은 이미 같은 기준으로 거르고 있었고, 퍼널 기록만 빠져 있었다.
test('퍼널 기록: staging·프리뷰는 프로덕션 퍼널에 쓰지 않는다', async () => {
  const mod = readFileSync('src/lib/payments/funnel-log.ts', 'utf8');
  assert.ok(mod.includes('function isNonProductionDeployment'), '배포환경 가드가 사라졌다');
  // 세 통로 전부에 걸려야 한다 — 하나라도 빠지면 그 경로로 staging 이 새어 들어온다.
  const guarded = mod.split('isNonProductionDeployment()').length - 1;
  assert.ok(guarded >= 4, `가드 호출이 ${guarded}곳뿐이다(정의 1 + 통로 3 이상이어야 한다)`);
  assert.ok(
    /VERCEL_ENV[\s\S]{0,160}!==\s*'production'/.test(mod),
    "판정은 VERCEL_ENV 기준이어야 한다(visit-filters 와 같은 기준)"
  );
  // 로컬(VERCEL_ENV 없음)은 기록을 막지 않는다 — 개발 중 퍼널 확인을 죽이면 안 된다.
  assert.ok(
    /env !== ''/.test(mod),
    '빈 VERCEL_ENV(로컬)까지 막으면 개발 중 퍼널이 통째로 죽는다'
  );
});
