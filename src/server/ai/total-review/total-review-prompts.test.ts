import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { buildTotalReviewInput } from './build-total-review-input';
import {
  TOTAL_REVIEW_SYSTEM_PROMPT,
  buildRetryCorrectionNote,
  buildSectionUserMessage,
} from './total-review-prompts';
import { validateTotalReviewSection } from '@/lib/saju/total-review-validator';

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

// 2026-08-10 — 프롬프트/검증기 정합 회귀 가드 (비용 누수 분석 §2c·§2d).

test('few-shot 모범답안이 스스로 섹션 검증을 통과한다', () => {
  // 이전 few-shot 은 단락당 4문장(총 17문장)이라 검증기(25~35)를 통과하지 못했다.
  // 모델은 지시문보다 예시를 따라가므로, 예시가 탈락 규격이면 재생성이 상시 발생한다.
  const message = buildSectionUserMessage('main_narrative', fixtureInput());
  const block = message.slice(message.indexOf('{'), message.indexOf('\n---'));
  const parsed = JSON.parse(block) as unknown;

  const result = validateTotalReviewSection('main_narrative', parsed);
  assert.deepEqual(result.reasons, [], '모범답안이 검증에 걸리면 안 된다');
  assert.equal(result.ok, true);
});

test('길이 지시(단락당 7~8문장)가 검증기 밴드(25~35)와 정합한다', () => {
  // 4단락 × 7~8문장 = 28~32 → 밴드 안. 5~8 로 되돌리면 하한 20 이 되어 탈락한다.
  assert.ok(TOTAL_REVIEW_SYSTEM_PROMPT.includes('단락 각 7~8문장'));
  const message = buildSectionUserMessage('main_narrative', fixtureInput());
  assert.equal((message.match(/\(7~8문장\)/g) ?? []).length, 4);
  assert.ok(!message.includes('(5~8문장)'), '옛 지시가 남아 있으면 안 된다');
});

test('system prompt 가 금지어를 인용 밖에서 사용하지 않는다', () => {
  // 프롬프트가 "반드시"·"절대" 를 지시문에 쓰면 모델이 그대로 흉내내 자기 규칙에 걸린다.
  // 큰따옴표 인용(= 정책 명시)은 허용, 그 밖의 사용은 금지.
  const withoutQuotes = TOTAL_REVIEW_SYSTEM_PROMPT.replace(/"[^"]*"/g, '');
  for (const word of ['대박', '비책', '암흑기', '텅장', '꿀팁', '반드시', '절대', '확실히']) {
    assert.ok(
      !withoutQuotes.includes(word),
      `system prompt 가 금지어 '${word}' 를 지시문에서 사용 중`
    );
  }
});

test('buildRetryCorrectionNote: 사유 없으면 빈 문자열, 있으면 항목화', () => {
  assert.equal(buildRetryCorrectionNote([]), '');
  const note = buildRetryCorrectionNote(['본문 금지 용어: 일주', '본문 문장 수 21 (목표 25~35)']);
  assert.ok(note.includes('재작성 지시'));
  assert.ok(note.includes('- 본문 금지 용어: 일주'));
  assert.ok(note.includes('- 본문 문장 수 21 (목표 25~35)'));
});
