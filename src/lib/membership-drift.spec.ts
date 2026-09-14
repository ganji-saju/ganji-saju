// 멤버십 기간 원장(086) 드리프트 판정 — 086 머리말 드리프트 쿼리 두 개와 같은 결과인지.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn(), createClient: vi.fn(), hasSupabaseServerEnv: false }));

import {
  buildMembershipDriftAlert,
  findMembershipDrift,
  runMembershipDriftAudit,
  type DriftPeriodRow,
  type DriftSubscriptionRow,
} from '@/lib/membership-drift';

const NOW = new Date('2026-09-14T01:00:00.000Z');
const D = (day: number) => new Date(Date.UTC(2026, 8, day, 1)).toISOString(); // 2026-09-<day>T01:00Z
const live = (user_id: string, end_at: string): DriftPeriodRow => ({ user_id, end_at, voided_at: null });
const sub = (user_id: string, renews_at: string | null, status = 'active'): DriftSubscriptionRow => ({ user_id, status, renews_at });

describe('findMembershipDrift', () => {
  it('어긋남 0 — 사슬 끝 = renews_at (연속 결제 두 행)', () => {
    const drift = findMembershipDrift([live('u1', D(20)), live('u1', D(30))], [sub('u1', D(30))], NOW);
    expect(drift).toEqual({ chainVsRenews: [], entitledWithoutEnd: [], users: [] });
  });

  it('ms 로 비교 — PostgREST 표기(+00:00)와 Z 표기가 달라도 같은 시각이면 일치', () => {
    const drift = findMembershipDrift([live('u1', '2026-09-30T01:00:00.123+00:00')], [sub('u1', '2026-09-30T01:00:00.123Z')], NOW);
    expect(drift.users).toEqual([]);
  });

  it('P1 — 구독이 사슬보다 뒤(옛 코드 지급): 두 판정 모두', () => {
    const drift = findMembershipDrift([live('u1', D(20))], [sub('u1', D(30))], NOW);
    expect(drift.chainVsRenews).toEqual(['u1']);
    expect(drift.entitledWithoutEnd).toEqual(['u1']);
    expect(drift.users).toEqual([
      { userId: 'u1', checks: ['chain_vs_renews', 'entitled_without_end'], renewsAt: D(30), chainEnd: D(20) },
    ]);
  });

  it('P2 — 구독이 사슬보다 앞(해제·환불 부활 모양): 구독 끝이 과거/만료여도 chain_vs_renews', () => {
    const drift = findMembershipDrift([live('u1', D(30))], [sub('u1', D(10), 'expired')], NOW);
    expect(drift.chainVsRenews).toEqual(['u1']);
    expect(drift.entitledWithoutEnd).toEqual([]);
  });

  it('P2 — 구독 끝이 미래지만 중간 행 끝과만 같음: chain_vs_renews 만(entitled 쪽은 end_at 행이 있어 통과)', () => {
    const drift = findMembershipDrift([live('u1', D(20)), live('u1', D(30))], [sub('u1', D(20))], NOW);
    expect(drift.chainVsRenews).toEqual(['u1']);
    expect(drift.entitledWithoutEnd).toEqual([]);
  });

  it('구독 행 없음 — 살아 있는 미래 사슬만 있으면 chain_vs_renews', () => {
    const drift = findMembershipDrift([live('u1', D(30))], [], NOW);
    expect(drift.users).toEqual([{ userId: 'u1', checks: ['chain_vs_renews'], renewsAt: null, chainEnd: D(30) }]);
  });

  it('권한 남은 구독(active·cancelled)인데 기간 행 없음 — entitled_without_end', () => {
    const drift = findMembershipDrift([], [sub('u1', D(30)), sub('u2', D(30), 'cancelled')], NOW);
    expect(drift.entitledWithoutEnd).toEqual(['u1', 'u2']);
    expect(drift.chainVsRenews).toEqual([]);
  });

  it('권한 없는 구독(expired·과거·null)은 행이 없어도 무시', () => {
    const drift = findMembershipDrift([], [sub('u1', D(30), 'expired'), sub('u2', D(10)), sub('u3', null)], NOW);
    expect(drift.users).toEqual([]);
  });

  it('무효 행은 무시 — 무효 행 끝이 renews_at 과 같아도 살아 있는 행이 없으면 어긋남', () => {
    const drift = findMembershipDrift([{ user_id: 'u1', end_at: D(30), voided_at: D(12) }], [sub('u1', D(30))], NOW);
    expect(drift.entitledWithoutEnd).toEqual(['u1']);
    expect(drift.chainVsRenews).toEqual([]);
  });

  it('무효 행은 사슬 끝 계산에서도 빠진다(해제된 미래 기간)', () => {
    const drift = findMembershipDrift(
      [live('u1', D(20)), { user_id: 'u1', end_at: D(30), voided_at: D(12) }],
      [sub('u1', D(20))],
      NOW
    );
    expect(drift.users).toEqual([]);
  });

  it('과거 기간은 무시 — 사슬 끝이 지금 이전이면 구독과 달라도 chain_vs_renews 아님', () => {
    const drift = findMembershipDrift([live('u1', D(10))], [sub('u1', D(5), 'expired')], NOW);
    expect(drift.users).toEqual([]);
  });

  it('여러 사용자 — 정상·P1·P2·행 없음이 섞여도 사용자별로 정확히, users 는 uuid 정렬', () => {
    const drift = findMembershipDrift(
      [live('ok', D(30)), live('p1', D(20)), live('p2', D(30)), live('nosub', D(25))],
      [sub('ok', D(30)), sub('p1', D(30)), sub('p2', D(15), 'expired'), sub('norow', D(28), 'cancelled')],
      NOW
    );
    expect(drift.chainVsRenews.sort()).toEqual(['nosub', 'p1', 'p2']);
    expect(drift.entitledWithoutEnd.sort()).toEqual(['norow', 'p1']);
    expect(drift.users.map((u) => u.userId)).toEqual(['norow', 'nosub', 'p1', 'p2']);
  });
});

describe('runMembershipDriftAudit — DB 읽기', () => {
  it('두 표를 끝까지 페이지로 읽고(유일 키 정렬) 미래 끝만 거른다', async () => {
    const calls: Array<{ table: string; filters: string[]; order: string[]; ranges: number[][] }> = [];
    const tables: Record<string, unknown[]> = {
      membership_periods: Array.from({ length: 1001 }, (_, i) => live(`u${i}`, D(30))),
      subscriptions: Array.from({ length: 1001 }, (_, i) => sub(`u${i}`, D(30))),
    };
    const client = {
      from(table: string) {
        const call = { table, filters: [] as string[], order: [] as string[], ranges: [] as number[][] };
        calls.push(call);
        const builder = {
          select: () => builder,
          is: (col: string, v: unknown) => (call.filters.push(`${col} is ${v}`), builder),
          gt: (col: string, v: unknown) => (call.filters.push(`${col} > ${v}`), builder),
          order: (col: string) => (call.order.push(col), builder),
          range: (from: number, to: number) => {
            call.ranges.push([from, to]);
            return Promise.resolve({ data: tables[table].slice(from, to + 1), error: null });
          },
        };
        return builder;
      },
    };
    const drift = await runMembershipDriftAudit({ client: client as never, now: NOW });
    expect(drift.users).toEqual([]);
    const periods = calls.filter((c) => c.table === 'membership_periods');
    const subs = calls.filter((c) => c.table === 'subscriptions');
    expect(periods).toHaveLength(2); // 1000 + 1
    expect(subs).toHaveLength(2);
    expect(periods[0].filters).toEqual(['voided_at is null', `end_at > ${NOW.toISOString()}`]);
    expect(periods[0].order).toEqual(['id']);
    expect(subs[0].filters).toEqual([`renews_at > ${NOW.toISOString()}`]);
    expect(subs[0].order).toEqual(['user_id']);
    expect(periods[1].ranges).toEqual([[1000, 1999]]);
  });
});

describe('buildMembershipDriftAlert', () => {
  it('uuid 최대 20명 + 외 N명, 관리자 링크, 두 건수, 086 정리 SQL 위치', () => {
    const users = Array.from({ length: 23 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
    const drift = findMembershipDrift([], users.map((u) => sub(u, D(30))), NOW);
    const alert = buildMembershipDriftAlert(drift);
    const text = alert.lines.join('\n');
    expect(text).toContain('chain_vs_renews 0건 · entitled_without_end 23건');
    expect(alert.lines.filter((l) => l.includes('/admin/users/'))).toHaveLength(20);
    expect(text).toContain(`https://ganjisaju.kr/admin/users/${users[0]}`);
    expect(text).not.toContain(users[20]);
    expect(text).toContain('외 3명');
    expect(text).toContain('086_membership_periods.sql');
    expect(text).not.toMatch(/@/); // 이메일 없음
  });
});
