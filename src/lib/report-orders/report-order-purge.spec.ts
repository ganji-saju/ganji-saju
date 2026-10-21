import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }));

import { createServiceClient } from '@/lib/supabase/server';
import { purgeExpiredReportOrders } from './report-order-store';

const calls: { table: string; op: string; arg?: unknown; filters: [string, ...unknown[]][] }[] = [];
function builder(table: string, result: unknown) {
  const entry = { table, op: '', arg: undefined as unknown, filters: [] as [string, ...unknown[]][] };
  calls.push(entry);
  const b: Record<string, unknown> = {};
  for (const name of ['select', 'update', 'delete', 'is', 'or', 'in', 'eq', 'lt']) {
    b[name] = (...args: unknown[]) => {
      if (['select', 'update', 'delete'].includes(name) && !entry.op) { entry.op = name; entry.arg = args[0]; }
      else entry.filters.push([name, ...args]);
      return b;
    };
  }
  b.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return b;
}

beforeEach(() => {
  calls.length = 0;
  let n = 0;
  const results = [
    { data: [{ id: 'r1', external_report_id: 'ext-1' }, { id: 'r2', external_report_id: null }], error: null },
    { data: null, error: null },
    { data: null, error: null },
  ];
  vi.mocked(createServiceClient).mockResolvedValue({ from: (t: string) => builder(t, results[n++]) } as never);
});

describe('purgeExpiredReportOrders', () => {
  it('1년 지난 주문의 개인정보·토큰을 비우고 연결된 풀이 원본을 지운다', async () => {
    const now = new Date('2027-10-22T00:00:00Z');
    await expect(purgeExpiredReportOrders(now)).resolves.toEqual({ orders: 2, reports: 1 });
    const [find, del, update] = calls;
    expect(find.table).toBe('report_orders');
    expect(find.filters).toContainEqual(['is', 'purged_at', null]);
    expect(JSON.stringify(find.filters)).toContain('2026-10-22T00:00:00.000Z');
    // 방치된 입금 대기·미발송 주문도 접수 1년 뒤 정리
    expect(JSON.stringify(find.filters)).toContain('status.in.(awaiting_deposit,paid,generated),created_at.lt.');
    // 원본을 먼저 지우고(실패하면 표시 전이라 다음날 다시 시도) 그 뒤 개인정보를 비운다
    expect(update.op).toBe('update');
    expect(update.arg).toMatchObject({ name: null, phone: null, email: null, birth_input: null, memo: null, result_token: null, external_report_id: null });
    expect(update.filters).toContainEqual(['in', 'id', ['r1', 'r2']]);
    expect(del.table).toBe('admin_external_reports');
    expect(del.op).toBe('delete');
    expect(del.filters).toContainEqual(['in', 'id', ['ext-1']]);
  });
});
