// 2026-09-14 — 무료 오늘운세 '다시 열어보기' 판정. 계정의 오늘 실행기록으로도 재열람을 인정한다
//   (쿠키는 기기 전용이라 새 탭·다른 브라우저에서 자기 결과가 429 로 막히던 버그).
import { describe, expect, it } from 'vitest';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import { sajuIdentityKey } from '@/lib/saju/reading-identity';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';
import { freeTodayReplaySignature, isTodayReplay } from './route';

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

const TODAY = '2026-09-14';
const me = inputOf(base);
const family = inputOf({ ...base, year: '1962', month: '3', day: '2', gender: 'male' });
const signed = (p: TodayFortuneBirthPayload) => `${TODAY}:${freeTodayReplaySignature(p)}`;

describe('isTodayReplay', () => {
  const common = {
    cookieValue: undefined,
    replaySignature: signed(base),
    identity: sajuIdentityKey(me),
    todayKey: TODAY,
  };

  it('① 로그인·쿠키 없음·오늘 같은 정체성 run → 재열람', () => {
    expect(isTodayReplay({ ...common, runs: [{ occurredOn: TODAY, input: me }] })).toBe(true);
  });

  it('② 오늘 run 이 다른 사람(가족)뿐이면 → 차단', () => {
    expect(isTodayReplay({ ...common, runs: [{ occurredOn: TODAY, input: family }] })).toBe(false);
  });

  it('③ 같은 정체성이라도 어제 run 만 있으면 → 차단', () => {
    expect(isTodayReplay({ ...common, runs: [{ occurredOn: '2026-09-13', input: me }] })).toBe(
      false
    );
  });

  it('익명 폴백: 쿠키 서명 일치면 run 없이 재열람', () => {
    expect(isTodayReplay({ ...common, cookieValue: signed(base), identity: null, runs: [] })).toBe(
      true
    );
  });
});

describe('freeTodayReplaySignature', () => {
  it("④ hour '' 이면 unknownBirthTime false/true 가 같은 서명", () => {
    const blank = { ...base, hour: '', minute: '' };
    expect(freeTodayReplaySignature({ ...blank, unknownBirthTime: false })).toBe(
      freeTodayReplaySignature({ ...blank, unknownBirthTime: true })
    );
  });
});
