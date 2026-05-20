import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { buildTotalReviewInput } from './build-total-review-input';
import {
  TOTAL_REVIEW_SYSTEM_PROMPT,
  buildSectionUserMessage,
} from './total-review-prompts';

// 2026-05-21 — 총평 프롬프트 자산 검증. spec §3·§4·§5.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function fixtureInput() {
  const data = calculateSajuDataV1({
    year: 1999,
    month: 4,
    day: 1,
    hour: 14,
    gender: 'female',
  });
  const ctx = buildSajuPersonalizationContext(data, {
    relationshipStatus: 'married',
    occupation: 'employee',
    currentConcern: 'wealth',
    concernNote: null,
  });
  return buildTotalReviewInput(data, ctx, {
    userName: '테스트',
    gender: 'F',
    now: new Date('2026-05-21T00:00:00Z'),
  });
}

test('system prompt: 평생 톤 강조 + 일일 톤 금지 예시 포함', () => {
  assert.ok(TOTAL_REVIEW_SYSTEM_PROMPT.includes('평생'));
  assert.ok(TOTAL_REVIEW_SYSTEM_PROMPT.includes('날입니다'));
});

test('system prompt: 한자/명리어 금지 규칙 포함', () => {
  assert.ok(TOTAL_REVIEW_SYSTEM_PROMPT.includes('한자'));
  assert.ok(TOTAL_REVIEW_SYSTEM_PROMPT.includes('식신격'));
  assert.ok(TOTAL_REVIEW_SYSTEM_PROMPT.includes('용신'));
});

test('one_line_summary 메시지: 20~35자 요건 + 입력 JSON 주입', () => {
  const input = fixtureInput();
  const msg = buildSectionUserMessage('one_line_summary', input);
  assert.ok(msg.includes('20~35'));
  assert.ok(msg.includes('## 입력 JSON'));
  assert.ok(msg.includes(input.wonkuk.ilju_easy.label || '조용'));
});

test('main_narrative 메시지: 4단락 의미 역할 + few-shot 예시 포함', () => {
  const input = fixtureInput();
  const msg = buildSectionUserMessage('main_narrative', input);
  assert.ok(msg.includes('단락 1'));
  assert.ok(msg.includes('단락 4'));
  assert.ok(msg.includes('출력 예시'), 'few-shot 미포함');
});

test('lifetime_keys 메시지: 3카드 요건 명시', () => {
  const input = fixtureInput();
  const msg = buildSectionUserMessage('lifetime_keys', input);
  assert.ok(msg.includes('카드 1'));
  assert.ok(msg.includes('카드 3'));
});

test('main_narrative few-shot 예시 자체에 한자/일일톤 누출 없음', () => {
  const input = fixtureInput();
  const msg = buildSectionUserMessage('main_narrative', input);
  // few-shot 블록만 추출 (출력 예시 ~ ---)
  const fewShot = msg.split('## 입력 JSON')[0];
  assert.ok(!/[一-鿿]/.test(fewShot.replace(TOTAL_REVIEW_SYSTEM_PROMPT, '')), 'few-shot 한자');
  assert.ok(!/오늘은|이번 주/.test(fewShot), 'few-shot 일일 톤');
});
