// @vitest-environment jsdom
// 2026-09-14 — 하루 1회 결제 경로에서 남긴 폼 이름을 상세가 unlock 에 넘긴다(run 기록이 없는 경로의 호명 다리).
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/counselor/use-preferred-counselor', () => ({
  usePreferredCounselor: () => ({ counselorId: null }),
}));
vi.mock('@/features/coupons/kakao-friend-coupon-cta', () => ({ KakaoFriendCouponCta: () => null }));
vi.mock('@/components/gangi/gangi-ui', () => ({
  GangiLoadingOverlay: () => null,
  GangiPageHeader: () => null,
}));

import { TodayFortuneDetailClient } from './today-fortune-detail-client';
import { markPendingUnlock, rememberTodayDetailName } from '@/lib/today-fortune/unlock-marker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function open() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'x' }), { status: 500 }));
  vi.stubGlobal('fetch', fetchMock);
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => root.render(<TodayFortuneDetailClient sourceSessionId="reading-dad" concern="general" />));
  await act(async () => new Promise((r) => setTimeout(r, 700))); // MIN_LOADING_MS
  act(() => root.unmount());
  vi.unstubAllGlobals();
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
}

describe('상세 → unlock 폼 이름 전달', () => {
  it('GET 쿼리에 name', async () => {
    rememberTodayDetailName('reading-dad', '아버지');
    const [url] = await open();
    expect(new URL(url, 'http://x').searchParams.get('name')).toBe('아버지');
  });

  it('POST(열기 표식) 바디에 name', async () => {
    rememberTodayDetailName('reading-dad', '아버지');
    markPendingUnlock('reading-dad');
    const [, init] = await open();
    expect(JSON.parse(String(init?.body)).name).toBe('아버지');
  });
});
