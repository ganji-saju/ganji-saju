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
      nextAction: { copy: '', product: 'TODAY_DEEP_READING', coinCost: 3 },
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

// 2026-09-27 — temperature: 0.8 이 남아 gpt-5.x 가 400 을 내고 오늘운세 AI 가 07-07 이후 전량 폴백이었다
//   (ai_llm_runs: today_fortune openai 0건 · openai_error 전부). 운영 모델은 temperature 를 받지 않는다(#608).
test('오늘운세 LLM 호출은 temperature 를 보내지 않는다', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require('node:path').join(__dirname, 'service.ts'), 'utf8');
  assert.equal(/temperature\s*:/.test(source), false);
});

test('오늘운세 LLM 출력 상한은 추론형 모델이 빈 답을 내지 않을 만큼 둔다(1000 이상)', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require('node:path').join(__dirname, 'service.ts'), 'utf8');
  const m = source.match(/maxOutputTokens:\s*(\d[\d_]*)/);
  assert.ok(m && Number(m[1].replace(/_/g, '')) >= 1000);
});

test('AI 제목·본문에서 첫 오늘만 남긴다', () => {
  const r = parseTodayFortuneNarrative(
    '{"headline":"오늘은 차분한 하루","body":"오늘은 천천히 가요. 오늘 하나만 정해요."}',
    { headline: 'FB', body: 'FBB' }
  );
  assert.equal(r.source, 'openai');
  assert.equal(r.body, '천천히 가요. 하나만 정해요.');
});
