/**
 * Task 12: tryConsumeMemberCompatAccess — 등급별 월쿼터 단위 테스트
 *
 * premium 월3 / plus 월1 / 비회원 false / 커플별 멱등(재열람 무차감) 검증.
 * 의존 모듈을 mock 해 DB 없이 경로별 동작을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 모듈 mock (vi.mock 은 호이스팅됨) ───────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/subscription', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/subscription')>();
  return {
    ...actual,
    getMemberTier: vi.fn(),
  };
});

vi.mock('@/lib/credits/member-benefits', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/credits/member-benefits')>();
  return {
    ...actual,
    monthlyPeriodKey: vi.fn().mockReturnValue('2026-06'),
  };
});

import { createServiceClient } from '@/lib/supabase/server';
import { getMemberTier } from '@/lib/subscription';
import { tryConsumeMemberCompatAccess } from './compatibility-access';

// ── Supabase 클라이언트 팩토리 ───────────────────────────────────────────────
// tryConsumeMemberCompatAccess 의 세 가지 DB 호출:
//   (1) .from().select('id').eq().eq().contains().limit(1)  → { data: rows }  (멱등 체크)
//   (2) .from().select('id', { count: 'exact' }).eq().eq().contains()  → { count: N }
//   (3) .from().insert({...})  → { error: null | '...' }
function makeCompatClient({
  existingCouple = false,   // 같은 커플 이번 달 기존 열람 여부
  monthCount = 0,            // 이번 달 사용 distinct 커플 수
  insertError = null as string | null,
} = {}) {
  const existingRows = existingCouple ? [{ id: '1' }] : [];
  const insert = vi.fn().mockResolvedValue({ error: insertError });

  const from = vi.fn().mockImplementation(() => ({
    select: vi.fn().mockImplementation((_col: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact') {
        // (2) 카운트 쿼리: .eq().eq().contains() → { count: N }
        const countChain: Record<string, unknown> = {};
        const eqFn = vi.fn().mockReturnValue(countChain);
        const containsFn = vi.fn().mockResolvedValue({ count: monthCount, error: null });
        Object.assign(countChain, { eq: eqFn, contains: containsFn });
        return countChain;
      } else {
        // (1) 멱등 체크: .eq().eq().contains().limit(1) → { data: rows }
        const idempChain: Record<string, unknown> = {};
        const eqFn = vi.fn().mockReturnValue(idempChain);
        const limitFn = vi.fn().mockResolvedValue({ data: existingRows, error: null });
        const containsFn = vi.fn().mockReturnValue({ limit: limitFn });
        Object.assign(idempChain, { eq: eqFn, contains: containsFn, limit: limitFn });
        return idempChain;
      }
    }),
    insert,
  }));

  return { from, insert };
}

const USER = 'user-test';
const COUPLE_KEY = 'couple-abc';

describe('tryConsumeMemberCompatAccess — 등급별 월쿼터', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMemberTier).mockResolvedValue(null);
  });

  // ── 비회원(tier=null) ─────────────────────────────────────────────────────
  it('비회원: false 반환, DB 미호출', async () => {
    vi.mocked(getMemberTier).mockResolvedValue(null);
    const client = makeCompatClient();
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(false);
    // 비회원이므로 Supabase 호출 없음
    expect(client.from).not.toHaveBeenCalled();
    expect(client.insert).not.toHaveBeenCalled();
  });

  // ── premium 멤버 — 0회 사용(한도 3) ──────────────────────────────────────
  it('premium, 0회 사용: true 반환, insert 호출', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('premium');
    const client = makeCompatClient({ existingCouple: false, monthCount: 0 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(true);
    expect(client.insert).toHaveBeenCalledOnce();
  });

  // ── premium 멤버 — 2회 사용(한도 3) ──────────────────────────────────────
  it('premium, 2회 사용: true 반환(limit 3 미달)', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('premium');
    const client = makeCompatClient({ existingCouple: false, monthCount: 2 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(true);
    expect(client.insert).toHaveBeenCalledOnce();
  });

  // ── premium 멤버 — 3회 사용(한도 초과) ───────────────────────────────────
  it('premium, 3회 사용: false 반환(limit 3 도달)', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('premium');
    const client = makeCompatClient({ existingCouple: false, monthCount: 3 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(false);
    expect(client.insert).not.toHaveBeenCalled();
  });

  // ── plus 멤버 — 0회 사용(한도 1) ─────────────────────────────────────────
  it('plus, 0회 사용: true 반환', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('plus');
    const client = makeCompatClient({ existingCouple: false, monthCount: 0 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(true);
    expect(client.insert).toHaveBeenCalledOnce();
  });

  // ── plus 멤버 — 1회 사용(한도 1 도달) ────────────────────────────────────
  it('plus, 1회 사용(다른 커플): false 반환(limit 1 도달)', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('plus');
    const client = makeCompatClient({ existingCouple: false, monthCount: 1 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(false);
    expect(client.insert).not.toHaveBeenCalled();
  });

  // ── 멱등: 같은 커플 이번 달 재열람 ──────────────────────────────────────
  it('premium, 같은 커플 재열람: true 반환(카운트 미차감, insert 미호출)', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('premium');
    // existingCouple=true → 멱등 체크에서 기존 행 발견
    const client = makeCompatClient({ existingCouple: true, monthCount: 1 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(true);
    // 멱등 체크에서 이미 true 반환 → insert 미호출
    expect(client.insert).not.toHaveBeenCalled();
  });

  // ── plus, 같은 커플 재열람(한도 1인데도 멱등 통과) ──────────────────────
  it('plus, 같은 커플 재열람: true 반환(한도 관계없이 멱등)', async () => {
    vi.mocked(getMemberTier).mockResolvedValue('plus');
    // 이미 1회 사용했지만 same couple → 멱등 체크에서 통과
    const client = makeCompatClient({ existingCouple: true, monthCount: 1 });
    vi.mocked(createServiceClient).mockResolvedValue(client as never);

    const result = await tryConsumeMemberCompatAccess(USER, COUPLE_KEY);

    expect(result).toBe(true);
    expect(client.insert).not.toHaveBeenCalled();
  });
});
