// 2026-09-14 — 하루 1회에 막힌 다른 사람 사주의 '오늘 자세히' 결제 경로.
//   체크아웃 slug 용 reading 만 만들거나 재사용한다 — 무료 결과 생성·무료 1회 소비는 없어야 한다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ user: { id: 'user-1' } as { id: string } | null }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mocks.user } })) },
  })),
  hasSupabaseServiceEnv: true,
}));
vi.mock('@/lib/saju/readings', () => ({
  createReading: vi.fn(async () => 'new-reading'),
  findReadingByInput: vi.fn(async () => null),
  isReadingId: vi.fn(() => true),
  resolveReading: vi.fn(),
}));
vi.mock('@/lib/free-usage/daily-limit', () => ({
  isFreeDailyExempt: vi.fn(),
  isFreeDailyUsed: vi.fn(),
  consumeFreeDaily: vi.fn(),
  freeDailyLimitMessage: vi.fn(),
}));
vi.mock('@/server/today-fortune/build-today-fortune', () => ({
  buildTodayFortuneFreeResult: vi.fn(),
}));
vi.mock('@/server/ai/today-fortune/service', () => ({
  generateTodayFortuneNarrative: vi.fn(),
}));

import { createReading, findReadingByInput } from '@/lib/saju/readings';
import { consumeFreeDaily, isFreeDailyUsed } from '@/lib/free-usage/daily-limit';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import { POST } from './route';

const family = {
  concernId: 'love_contact',
  calendarType: 'solar',
  timeRule: 'standard',
  year: '1962',
  month: '3',
  day: '2',
  hour: '',
  minute: '',
  unknownBirthTime: true,
  gender: 'male',
};

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/today-fortune/checkout-reading', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );

describe('POST /api/today-fortune/checkout-reading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: 'user-1' };
  });

  it('로그인 계정은 같은 사주 reading 을 재사용한다(새로 만들지 않음)', async () => {
    vi.mocked(findReadingByInput).mockResolvedValueOnce({ id: 'existing-reading' } as never);
    const res = await post(family);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, readingId: 'existing-reading' });
    expect(vi.mocked(findReadingByInput).mock.calls[0][0]).toBe('user-1');
    expect(createReading).not.toHaveBeenCalled();
  });

  it('비로그인은 소유자 없는 reading 을 만든다(로그인은 결제 버튼이 요구)', async () => {
    mocks.user = null;
    const res = await post(family);
    expect(await res.json()).toEqual({ ok: true, readingId: 'new-reading' });
    expect(findReadingByInput).not.toHaveBeenCalled();
    expect(vi.mocked(createReading).mock.calls[0][1]).toBeNull();
    expect(vi.mocked(createReading).mock.calls[0][0]).toMatchObject({ year: 1962, month: 3, day: 2 });
  });

  it('무료 결과를 만들지 않고 무료 1회도 판정·소비하지 않는다', async () => {
    await post(family);
    expect(buildTodayFortuneFreeResult).not.toHaveBeenCalled();
    expect(isFreeDailyUsed).not.toHaveBeenCalled();
    expect(consumeFreeDaily).not.toHaveBeenCalled();
  });

  it('생년월일이 비면 400 — reading 을 만들지 않는다', async () => {
    const res = await post({ ...family, year: '' });
    expect(res.status).toBe(400);
    expect(createReading).not.toHaveBeenCalled();
  });
});
