// 2026-09-14 — 무료 오늘운세 '다시 열어보기' 판정. 계정의 오늘 실행기록으로도 재열람을 인정한다
//   (쿠키는 기기 전용이라 새 탭·다른 브라우저에서 자기 결과가 429 로 막히던 버그).
//   면제 범위는 쿠키 서명 필드(생년월일시·시간모름·성별·양음력·timeRule)보다 넓히지 않는다.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── 라우트 배선용 목 — 게이트가 계정 기록을 실제로 조회하는지(POST 레벨) 지킨다 ──
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  }),
  hasSupabaseServiceEnv: false,
}));
vi.mock('@/lib/free-usage/daily-limit', () => ({
  isFreeDailyExempt: vi.fn().mockResolvedValue(false),
  isFreeDailyUsed: vi.fn().mockResolvedValue(true),
  consumeFreeDaily: vi.fn(),
  freeDailyLimitMessage: vi.fn().mockReturnValue('limit'),
}));
vi.mock('@/lib/today-fortune/run-log', () => ({
  listTodayFortuneRunsForUser: vi.fn(),
  recordTodayFortuneRun: vi.fn(),
}));
vi.mock('@/server/ai/today-fortune/service', () => ({
  generateTodayFortuneNarrative: vi.fn().mockResolvedValue(null),
}));

import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { consumeFreeDaily } from '@/lib/free-usage/daily-limit';
import { listTodayFortuneRunsForUser } from '@/lib/today-fortune/run-log';
import type { TodayFortuneRunRecord } from '@/lib/today-fortune/run-log';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';
import { POST, freeTodayReplaySignature, isTodayReplay } from './route';

const base: TodayFortuneBirthPayload = {
  concernId: 'general',
  calendarType: 'solar',
  timeRule: 'standard',
  year: '1990',
  month: '5',
  day: '15',
  hour: '10',
  minute: '30',
  unknownBirthTime: false,
  gender: 'female',
  birthLocationCode: '',
  birthLocationLabel: '',
  birthLatitude: '',
  birthLongitude: '',
};

function inputOf(payload: TodayFortuneBirthPayload) {
  const parsed = resolveUnifiedBirthInput(payload, { requireGender: false });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.input;
}

function runOf(payload: TodayFortuneBirthPayload, occurredOn = TODAY) {
  return {
    occurredOn,
    input: inputOf(payload),
    calendarType: payload.calendarType,
    timeRule: payload.timeRule,
  };
}

const TODAY = '2026-09-14';
const family: TodayFortuneBirthPayload = { ...base, year: '1962', month: '3', day: '2', gender: 'male' };
const signed = (p: TodayFortuneBirthPayload) => `${TODAY}:${freeTodayReplaySignature(p)}`;
const check = (p: TodayFortuneBirthPayload, runs: ReturnType<typeof runOf>[], cookieValue?: string) =>
  isTodayReplay({
    cookieValue,
    replaySignature: signed(p),
    input: inputOf(p),
    calendarType: p.calendarType,
    timeRule: p.timeRule,
    todayKey: TODAY,
    runs,
  });

describe('isTodayReplay', () => {
  it('① 로그인·쿠키 없음·오늘 같은 입력 run → 재열람', () => {
    expect(check(base, [runOf(base)])).toBe(true);
  });

  it('② 오늘 run 이 다른 사람(가족)뿐이면 → 차단', () => {
    expect(check(base, [runOf(family)])).toBe(false);
  });

  it('③ 같은 입력이라도 어제 run 만 있으면 → 차단', () => {
    expect(check(base, [runOf(base, '2026-09-13')])).toBe(false);
  });

  // 정체성(4기둥+성별)은 같지만 문구 시드가 달라 다른 결과가 나오는 변형 — 쿠키로도 막히던 입력.
  it.each([
    ['분만 다름(쌍둥이 포함)', { ...base, minute: '05' }],
    ['같은 시진 안의 다른 시각', { ...base, hour: '9', minute: '45' }],
    ['timeRule 만 다름', { ...base, timeRule: 'nightZi' as const }],
    ['같은 날짜를 음력으로', { ...base, calendarType: 'lunar' as const, month: '4', day: '21' }],
  ])('④ %s → 차단', (_label, variant) => {
    expect(check(variant, [runOf(base)])).toBe(false);
  });

  it('⑤ 출생지 경로만 다름(프리셋 vs 직접 좌표, #699) → 재열람', () => {
    const preset = { ...base, timeRule: 'trueSolarTime' as const, birthLocationCode: 'seoul', birthLocationLabel: '서울' };
    const custom = { ...preset, birthLocationCode: 'custom', birthLatitude: '37.566500', birthLongitude: '126.978000' };
    expect(check(custom, [runOf(preset)])).toBe(true);
  });

  it('익명 폴백: 쿠키 서명 일치면 run 없이 재열람', () => {
    expect(check(base, [], signed(base))).toBe(true);
  });
});

describe('freeTodayReplaySignature', () => {
  it("⑥ hour '' 이면 unknownBirthTime false/true 가 같은 서명", () => {
    const blank = { ...base, hour: '', minute: '' };
    expect(freeTodayReplaySignature({ ...blank, unknownBirthTime: false })).toBe(
      freeTodayReplaySignature({ ...blank, unknownBirthTime: true })
    );
  });
});

describe('POST /api/today-fortune — 무료 1회 소진 뒤 다른 기기(쿠키 없음)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-14T03:00:00Z')); // KST 12:00 → TODAY
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => vi.mocked(consumeFreeDaily).mockClear());

  const post = (p: TodayFortuneBirthPayload) =>
    POST(
      new NextRequest('http://localhost/api/today-fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
    );
  const withRuns = (...runs: ReturnType<typeof runOf>[]) =>
    vi.mocked(listTodayFortuneRunsForUser).mockResolvedValue(runs as TodayFortuneRunRecord[]);

  it('계정에 오늘 같은 입력 run 이 있으면 200 · 추가 소비 없음', async () => {
    withRuns(runOf(base));
    const res = await post(base);
    expect(res.status).toBe(200);
    expect(listTodayFortuneRunsForUser).toHaveBeenCalledWith('user-1');
    expect(consumeFreeDaily).not.toHaveBeenCalled();
  });

  it('오늘 run 이 다른 사람뿐이면 429', async () => {
    withRuns(runOf(family));
    const res = await post(base);
    expect(res.status).toBe(429);
    expect(consumeFreeDaily).not.toHaveBeenCalled();
  });
});
