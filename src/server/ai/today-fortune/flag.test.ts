import assert from 'node:assert/strict';
import { isTodayFortuneLlmEnabled } from './flag';

declare const test: (name: string, fn: () => void) => void;

test('OPENAI_TODAY_FORTUNE 미설정 시 false', () => {
  delete process.env.OPENAI_TODAY_FORTUNE;
  assert.equal(isTodayFortuneLlmEnabled(), false);
});
test("'1' 이면 true, '0' 이면 false", () => {
  process.env.OPENAI_TODAY_FORTUNE = '1';
  assert.equal(isTodayFortuneLlmEnabled(), true);
  process.env.OPENAI_TODAY_FORTUNE = '0';
  assert.equal(isTodayFortuneLlmEnabled(), false);
  delete process.env.OPENAI_TODAY_FORTUNE;
});
