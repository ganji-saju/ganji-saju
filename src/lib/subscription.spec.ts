/**
 * Task 9: isPlusMember / getMemberTier 헬퍼 단위 테스트
 *
 * getManagedSubscription 이 사용하는 createServiceClient 를 mock 하여
 * DB 없이 plan/status 조합별 반환값을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// @/lib/supabase/server 를 mock — createServiceClient 가 가짜 Supabase 클라이언트 반환
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from '@/lib/supabase/server';
import { isPlusMember, getMemberTier, isPremiumMember } from '@/lib/subscription';

// ─── 테스트용 타입 ──────────────────────────────────────────────────
type FakeStatus = 'active' | 'cancelled' | 'expired';
interface FakeRow {
  status: FakeStatus;
  plan: string;
  renews_at: string | null;
  created_at: string;
  updated_at: string;
  toss_billing_key: null;
  toss_customer_key: null;
}

// ─── Supabase 클라이언트 팩토리 ─────────────────────────────────────
// readSubscription 의 호출 체인:  .from().select().eq().maybeSingle()
// expireIfNeeded 는 renews_at 이 미래이거나 status==='expired' 이면 DB 재호출 안 함.
function makeClient(row: FakeRow | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from };
}

const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString(); // 30일 후
const NOW = new Date().toISOString();

const premiumActiveRow: FakeRow = {
  status: 'active',
  plan: 'premium_monthly',
  renews_at: FUTURE,
  created_at: NOW,
  updated_at: NOW,
  toss_billing_key: null,
  toss_customer_key: null,
};

const plusActiveRow: FakeRow = {
  status: 'active',
  plan: 'plus_monthly',
  renews_at: FUTURE,
  created_at: NOW,
  updated_at: NOW,
  toss_billing_key: null,
  toss_customer_key: null,
};

// cancelled premium: renews_at 미래 → expireIfNeeded DB 호출 없음 (grace 기간 내)
const cancelledRow: FakeRow = {
  status: 'cancelled',
  plan: 'premium_monthly',
  renews_at: FUTURE,
  created_at: NOW,
  updated_at: NOW,
  toss_billing_key: null,
  toss_customer_key: null,
};

// cancelled plus: renews_at 미래 → grace 기간 내
const cancelledPlusRow: FakeRow = {
  status: 'cancelled',
  plan: 'plus_monthly',
  renews_at: FUTURE,
  created_at: NOW,
  updated_at: NOW,
  toss_billing_key: null,
  toss_customer_key: null,
};

// expired: status==='expired' → expireIfNeeded 가 short-circuit (DB 재호출 없음)
const expiredRow: FakeRow = {
  status: 'expired',
  plan: 'plus_monthly',
  renews_at: new Date(Date.now() - 86_400_000).toISOString(), // 과거
  created_at: NOW,
  updated_at: NOW,
  toss_billing_key: null,
  toss_customer_key: null,
};

// expired premium: status==='expired' with premium_monthly plan
const expiredPremiumRow: FakeRow = {
  status: 'expired',
  plan: 'premium_monthly',
  renews_at: new Date(Date.now() - 86_400_000).toISOString(), // 과거
  created_at: NOW,
  updated_at: NOW,
  toss_billing_key: null,
  toss_customer_key: null,
};

// ─── getMemberTier ───────────────────────────────────────────────────
describe('getMemberTier', () => {
  beforeEach(() => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(null) as never);
  });

  it('premium_monthly + active → "premium"', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(premiumActiveRow) as never);
    expect(await getMemberTier('user-premium')).toBe('premium');
  });

  it('plus_monthly + active → "plus"', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(plusActiveRow) as never);
    expect(await getMemberTier('user-plus')).toBe('plus');
  });

  it('cancelled premium (해지 예약, grace 기간 내) → "premium"', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(cancelledRow) as never);
    expect(await getMemberTier('user-cancelled')).toBe('premium');
  });

  it('cancelled plus (해지 예약, grace 기간 내) → "plus"', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(cancelledPlusRow) as never);
    expect(await getMemberTier('user-cancelled-plus')).toBe('plus');
  });

  it('expired → null (status !== "active")', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(expiredRow) as never);
    expect(await getMemberTier('user-expired')).toBeNull();
  });

  it('expired premium_monthly → null (회귀테스트: 만료된 프리미엄은 null)', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(expiredPremiumRow) as never);
    expect(await getMemberTier('user-expired-premium')).toBeNull();
  });

  it('구독 없음(null) → null', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(null) as never);
    expect(await getMemberTier('user-no-sub')).toBeNull();
  });

  it('빈 userId → null (DB 호출 없이 즉시)', async () => {
    expect(await getMemberTier('')).toBeNull();
  });
});

// ─── isPlusMember ────────────────────────────────────────────────────
describe('isPlusMember', () => {
  beforeEach(() => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(null) as never);
  });

  it('plus_monthly + active → true', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(plusActiveRow) as never);
    expect(await isPlusMember('user-plus')).toBe(true);
  });

  it('premium_monthly + active → false (plan 불일치)', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(premiumActiveRow) as never);
    expect(await isPlusMember('user-premium')).toBe(false);
  });

  it('cancelled premium (plan 불일치 — plus 아님) → false', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(cancelledRow) as never);
    expect(await isPlusMember('user-cancelled')).toBe(false);
  });

  it('cancelled plus (해지 예약, grace 기간 내) → true', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(cancelledPlusRow) as never);
    expect(await isPlusMember('user-cancelled-plus')).toBe(true);
  });

  it('구독 없음(null) → false', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(null) as never);
    expect(await isPlusMember('user-no-sub')).toBe(false);
  });

  it('빈 userId → false (DB 호출 없이 즉시)', async () => {
    expect(await isPlusMember('')).toBe(false);
  });
});

// ─── isPremiumMember ─────────────────────────────────────────────────
describe('isPremiumMember', () => {
  beforeEach(() => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(null) as never);
  });

  it('premium_monthly + active → true', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(premiumActiveRow) as never);
    expect(await isPremiumMember('user-premium')).toBe(true);
  });

  it('plus_monthly + active → false (plan 불일치)', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(plusActiveRow) as never);
    expect(await isPremiumMember('user-plus')).toBe(false);
  });

  it('cancelled premium (해지 예약, grace 기간 내) → true', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(cancelledRow) as never);
    expect(await isPremiumMember('user-cancelled')).toBe(true);
  });

  it('expired premium → false (만료된 구독은 혜택 없음 — 회귀)', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(expiredPremiumRow) as never);
    expect(await isPremiumMember('user-expired-premium')).toBe(false);
  });

  it('구독 없음(null) → false', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeClient(null) as never);
    expect(await isPremiumMember('user-no-sub')).toBe(false);
  });

  it('빈 userId → false (DB 호출 없이 즉시)', async () => {
    expect(await isPremiumMember('')).toBe(false);
  });
});
