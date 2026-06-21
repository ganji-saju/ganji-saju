import assert from 'node:assert/strict';
import { parseTodayFortuneNarrative } from './service';

declare const test: (name: string, fn: () => void) => void;

test('금지어 포함 LLM 출력은 폴백으로 대체', () => {
  // '반드시' 는 validateChapterBody 의 absolute 룰에서 차단됨.
  const r = parseTodayFortuneNarrative('{"headline":"오늘은 반드시 성공","body":"x"}', {
    headline: 'FB',
    body: 'FBB',
  });
  assert.equal(r.source, 'fallback');
  assert.equal(r.headline, 'FB');
});

test('정상 출력은 그대로 채택', () => {
  const r = parseTodayFortuneNarrative(
    '{"headline":"잔잔한 하루","body":"오늘은 천천히 가요."}',
    { headline: 'FB', body: 'FBB' }
  );
  assert.equal(r.source, 'openai');
  assert.equal(r.headline, '잔잔한 하루');
});

test('JSON 파싱 실패 시 폴백 반환', () => {
  const r = parseTodayFortuneNarrative('not json', { headline: 'H', body: 'B' });
  assert.equal(r.source, 'fallback');
  assert.equal(r.headline, 'H');
  assert.equal(r.body, 'B');
});

test('headline 또는 body 가 문자열 아닐 때 폴백 반환', () => {
  const r = parseTodayFortuneNarrative('{"headline":123,"body":"ok"}', {
    headline: 'H',
    body: 'B',
  });
  assert.equal(r.source, 'fallback');
});

test('100% 포함 LLM 출력은 폴백으로 대체 (Finding A)', () => {
  const fb = { headline: 'FB', body: 'FBB' };
  const r = parseTodayFortuneNarrative('{"headline":"오늘은 100% 좋아요","body":"x"}', fb);
  assert.equal(r.source, 'fallback');
  assert.equal(r.headline, 'FB');
});

test('무조건 포함 LLM 출력은 폴백으로 대체 (Finding A)', () => {
  const fb = { headline: 'FB', body: 'FBB' };
  const r = parseTodayFortuneNarrative('{"headline":"무조건 잘 풀려요","body":"x"}', fb);
  assert.equal(r.source, 'fallback');
  assert.equal(r.headline, 'FB');
});

test('플래그 OFF 일 때 generateTodayFortuneNarrative 는 null 반환', async () => {
  // OPENAI_TODAY_FORTUNE 을 미설정(또는 '0')으로 두면 isTodayFortuneLlmEnabled() === false.
  delete process.env.OPENAI_TODAY_FORTUNE;
  const { generateTodayFortuneNarrative } = await import('./service');
  const result = await generateTodayFortuneNarrative({
    result: {
      sourceSessionId: 's1',
      dateKey: '2026-06-22',
      userName: null,
      concernId: 'love' as import('@/lib/today-fortune/types').ConcernId,
      concernLabel: '연애',
      concernHanja: '戀愛',
      focusTopic: 'love' as import('@/domain/saju/report').FocusTopic,
      birthMeta: { calendarType: 'solar', timeRule: 'standard', unknownBirthTime: false, usesLocation: false },
      oneLine: { eyebrow: '오늘', headline: 'H', body: 'B' },
      scores: [],
      userSituation: null,
      opportunity: { title: '', body: '' },
      risk: { title: '', body: '' },
      reasonSnippet: { title: '', body: '' },
      groundingSummary: {
        primaryConcept: '',
        factLines: [],
        evidenceLines: [],
        kasi: { available: false, ok: false, summary: '' },
      },
      nextAction: { copy: '', product: 'TODAY_DEEP_READING', coinCost: 1 },
      followUpQuestions: [],
    },
    sajuData: {
      fiveElements: { dominant: '목', weakest: '금' },
    } as unknown as import('@/domain/saju/engine').SajuDataV1,
    caseSummaries: [],
    situation: null,
    userId: 'u1',
  });
  assert.equal(result, null);
  delete process.env.OPENAI_TODAY_FORTUNE;
});
