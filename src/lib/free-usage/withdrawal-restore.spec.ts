/**
 * 2026-09-01 — restoreFreeDailyUsage 의 **돈 되는 분기** 검증.
 *   재가입 계정이 이미 쓴 양이 원장보다 많으면 원장 값으로 **되돌리면 안 된다**
 *   (되돌리는 순간 무료 1회가 공짜로 생긴다 — 막으려던 바로 그 구멍).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }));

import { createServiceClient } from '@/lib/supabase/server';
import { restoreFreeDailyUsage, currentPeriodKeys } from './withdrawal-ledger';

const HASH = 'a'.repeat(64);
const USER = 'user-1';
const TODAY = currentPeriodKeys()[0];

/**
 * ledger select → usage select → usage upsert 순서로 응답하는 최소 클라이언트.
 *
 * ⚠️ 실제 쿼리는 `.in()` 을 **두 번** 건다(benefit + period_key). 그래서 각 단계가 체인을
 *   그대로 돌려주고, 체인 자체를 thenable 로 만들어 어디서 await 하든 결과가 나오게 한다
 *   (첫 `.in()` 에서 Promise 를 돌려주면 두 번째 `.in()` 이 undefined 가 된다).
 */
function makeClient(opts: {
  ledger: Array<{ benefit: string; period_key: string; used_count: number }>;
  existing: Array<{ benefit: string; period_key: string; used_count: number }>;
}) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const makeChain = (data: unknown) => {
    const chain: Record<string, unknown> = {
      upsert,
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
    };
    return chain;
  };
  const from = vi.fn((table: string) =>
    makeChain(table === 'free_daily_ledger' ? opts.ledger : opts.existing)
  );
  return { client: { from }, upsert };
}

beforeEach(() => vi.clearAllMocks());

describe('restoreFreeDailyUsage', () => {
  it('원장에 기록이 있으면 새 계정에 되돌린다(= 재가입해도 오늘 무료가 되살아나지 않는다)', async () => {
    const { client, upsert } = makeClient({
      ledger: [{ benefit: 'free_today_daily', period_key: TODAY, used_count: 1 }],
      existing: [],
    });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    expect(await restoreFreeDailyUsage(USER, HASH)).toBe(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0]).toEqual([
      { user_id: USER, benefit: 'free_today_daily', period_key: TODAY, used_count: 1 },
    ]);
  });

  it('🔴 새 계정이 더 많이 썼으면 그 값을 유지한다 — 원장 값으로 내리면 무료가 하나 생긴다', async () => {
    const { client, upsert } = makeClient({
      ledger: [{ benefit: 'free_today_daily', period_key: TODAY, used_count: 1 }],
      existing: [{ benefit: 'free_today_daily', period_key: TODAY, used_count: 3 }],
    });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    await restoreFreeDailyUsage(USER, HASH);
    expect(upsert.mock.calls[0][0][0].used_count).toBe(3);
  });

  it('원장이 비면 아무것도 쓰지 않는다(정상 로그인 = 셀렉트 한 번)', async () => {
    const { client, upsert } = makeClient({ ledger: [], existing: [] });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    expect(await restoreFreeDailyUsage(USER, HASH)).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('대조 키가 없으면(카카오 아님) DB 를 아예 건드리지 않는다', async () => {
    expect(await restoreFreeDailyUsage(USER, null)).toBe(0);
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
