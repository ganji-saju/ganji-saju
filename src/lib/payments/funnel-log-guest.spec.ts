import { describe, expect, it, vi } from 'vitest';

const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/server', () => ({
  hasSupabaseServiceEnv: true,
  createServiceClient: vi.fn(async () => ({ from: () => ({ insert }) })),
}));

import { logPaymentFunnelEvent } from './funnel-log';

describe('비회원 주문 퍼널 기록', () => {
  it('원장에서 읽은 빈 userId("")는 null 로 저장한다(uuid 오류로 이벤트가 사라지지 않게)', async () => {
    await logPaymentFunnelEvent({} as never, { stage: 'confirm_attempt', userId: '', orderId: 'ord_x' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
  });
});
