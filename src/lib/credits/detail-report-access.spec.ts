/**
 * unlockTodayFortunePremium — 멤버십 게이트 단위 테스트
 *
 * 게이트 순서: (1)기존 access → (2)멤버십(premium 무제한/plus 월쿼터) → (3)레거시 코인 → (4)페이월
 *
 * 의존 모듈을 mock 해 DB 없이 경로별 동작을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 모듈 mock (vi.mock 은 호이스팅됨) ───────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('./deduct', async (importActual) => {
  const actual = await importActual<typeof import('./deduct')>();
  return {
    ...actual,
    getCredits: vi.fn(),
    unlockCreditsOnce: vi.fn(),
    deductCredits: vi.fn(),
  };
});

vi.mock('@/lib/subscription', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/subscription')>();
  return {
    ...actual,
    getMemberTier: vi.fn(),
  };
});

vi.mock('./member-benefits', async (importActual) => {
  const actual = await importActual<typeof import('./member-benefits')>();
  return {
    ...actual,
    consumeMemberBenefit: vi.fn(),
    monthlyPeriodKey: vi.fn().mockReturnValue('2026-06'),
  };
});

import { createServiceClient } from '@/lib/supabase/server';
import { getCredits, unlockCreditsOnce, deductCredits } from './deduct';
import { getMemberTier } from '@/lib/subscription';
import { consumeMemberBenefit } from './member-benefits';
import { unlockTodayFortunePremium } from './detail-report-access';

// ── Supabase 클라이언트 팩토리 ───────────────────────────────────────────────
// hasTodayFortunePremiumAccess: .from().select().eq().eq().eq().contains().limit(1)
// recordTodayFortunePremiumAccess: .from().insert({...})
function makeSupabaseClient(hasAccess = false) {
  const rows = hasAccess ? [{ id: '1' }] : [];
  // 모든 chaining 메서드가 동일한 chainObj 를 반환 → gte/lt/contains 순서 무관하게 동작
  const chainObj: Record<string, unknown> = {};
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eq = vi.fn().mockReturnValue(chainObj);
  const gte = vi.fn().mockReturnValue(chainObj);
  const lt = vi.fn().mockReturnValue(chainObj);
  const contains = vi.fn().mockReturnValue(chainObj);
  Object.assign(chainObj, { eq, gte, lt, contains, limit });
  const select = vi.fn().mockReturnValue(chainObj);
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, insert });
  return { from };
}

const USER = 'user-test';
const READING_KEY = 'test-reading-key';
const SESSION_ID = 'test-session-id';
const DAY_KEY = '2026-06-30';

describe('unlockTodayFortunePremium — 멤버십 게이트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본: 미접근, 멤버십 없음, 코인 부족(페이월 기본)
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabaseClient(false) as never);
    vi.mocked(getCredits).mockResolvedValue({ balance: 5, subscription_balance: 0 });
    vi.mocked(unlockCreditsOnce).mockResolvedValue(null); // RPC 미지원 → deductCredits 폴스루
    vi.mocked(deductCredits).mockResolvedValue({ success: false, remaining: 0, error: '코인이 부족합니다.' });
    vi.mocked(getMemberTier).mockResolvedValue(null);
    vi.mocked(consumeMemberBenefit).mockResolvedValue(false);
  });

  // ── (1) 기존 접근(reused) ─────────────────────────────────────────────────
  it('이미 접근한 경우(hasTodayFortunePremiumAccess=true): reused:true, 멤버십/코인 미호출', async () => {
    vi.mocked(createServiceClient).mockResolvedValue(makeSupabaseClient(true) as never);

    const result = await unlockTodayFortunePremium(USER, READING_KEY, SESSION_ID, DAY_KEY);

    expect(result.success).toBe(true);
    expect(result.reused).toBe(true);
    expect(getMemberTier).not.toHaveBeenCalled();
    expect(consumeMemberBenefit).not.toHaveBeenCalled();
    expect(unlockCreditsOnce).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  // ── (2) 프리미엄 멤버 — 무제한 ──────────────────────────────────────────
  it('premium 멤버: viaMembership:true, consumeMemberBenefit/코인 미호출', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('premium');

    const result = await unlockTodayFortunePremium(USER, READING_KEY, SESSION_ID, DAY_KEY);

    expect(result.success).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.viaMembership).toBe(true);
    // 무제한(detailMonthly=null) 이므로 consumeMemberBenefit 호출 없음
    expect(consumeMemberBenefit).not.toHaveBeenCalled();
    // 코인 경로 미호출
    expect(unlockCreditsOnce).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  // ── (3) 플러스 멤버 — 한도 내 ───────────────────────────────────────────
  it('plus 멤버(한도 내): viaMembership:true, 코인 미호출', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('plus');
    vi.mocked(consumeMemberBenefit).mockResolvedValue(true);

    const result = await unlockTodayFortunePremium(USER, READING_KEY, SESSION_ID, DAY_KEY);

    expect(result.success).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.viaMembership).toBe(true);
    expect(consumeMemberBenefit).toHaveBeenCalledOnce();
    // 코인 경로 미호출
    expect(unlockCreditsOnce).not.toHaveBeenCalled();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  // ── (4) 플러스 멤버 — 한도 초과 → 코인 폴스루 ──────────────────────────
  it('plus 멤버(한도 초과): 코인 경로로 폴스루(unlockCreditsOnce/deductCredits 호출)', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('plus');
    vi.mocked(consumeMemberBenefit).mockResolvedValue(false);
    vi.mocked(unlockCreditsOnce).mockResolvedValue(null);
    vi.mocked(deductCredits).mockResolvedValue({ success: true, remaining: 0 });

    const result = await unlockTodayFortunePremium(USER, READING_KEY, SESSION_ID, DAY_KEY);

    expect(result.viaMembership).toBeUndefined();
    expect(consumeMemberBenefit).toHaveBeenCalledOnce();
    // 코인 경로 호출됨
    expect(unlockCreditsOnce).toHaveBeenCalledOnce();
    expect(deductCredits).toHaveBeenCalledOnce();
  });

  // ── (5) 비회원(tier=null) — 코인 경로 ───────────────────────────────────
  it('비회원: 멤버십 판별만, consumeMemberBenefit 미호출, 코인 경로 진입', async () => {
    vi.mocked(getMemberTier).mockResolvedValue(null);
    vi.mocked(unlockCreditsOnce).mockResolvedValue(null);
    vi.mocked(deductCredits).mockResolvedValue({ success: true, remaining: 5 });

    const result = await unlockTodayFortunePremium(USER, READING_KEY, SESSION_ID, DAY_KEY);

    expect(result.viaMembership).toBeUndefined();
    expect(consumeMemberBenefit).not.toHaveBeenCalled();
    // 코인 경로 호출됨
    expect(unlockCreditsOnce).toHaveBeenCalledOnce();
    expect(deductCredits).toHaveBeenCalledOnce();
  });
});
