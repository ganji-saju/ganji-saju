import assert from 'node:assert/strict';
import {
  buildDialogueFallback,
  createDialoguePrompt,
  createSafetyResponse,
  inferDialogueFocusTopic,
  inferYearlyTargetYear,
  isYearlyDialogueIntent,
  normalizeDialogueAnswer,
  parseAiRequest,
} from './route-helpers';
import {
  AI_CHAT_BUNDLE_COST,
  AI_CHAT_BUNDLE_SIZE,
  AI_CHAT_FREE_TURNS,
  createAiChatBillingSummary,
  getAiChatTurnPlan,
  getAvailableCreditsTotal,
  shouldChargeAiChat,
} from '@/lib/credits/ai-chat-access';
import { ensureDialogueExpertVisibleOpening } from '@/lib/dialogue-experts';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('dialogue fallback copy stays conversational without internal memo leakage', () => {
  const text = buildDialogueFallback('오늘 관계운을 짧게 알려줘');

  assert.match(text, /상대|질문/);
  assert.doesNotMatch(text, /기본 흐름은|핵심 단서는|답변 순서|전을 차감/);
});

test('dialogue prompt uses the selected zodiac expert and infers focus topic from the question', () => {
  const prompt = createDialoguePrompt('올해 재물운을 단도직입적으로 봐줘', null, 'rooster');
  const alternatePrompt = createDialoguePrompt('그 사람 마음이 아직 남아 있을까요', null, 'sheep');

  assert.match(prompt.instructions, /숙련 상담가/);
  assert.match(prompt.instructions, /마크다운 기호를 쓰지 않습니다/);
  assert.match(prompt.instructions, /로봇처럼 설명하지 말고 실제 역술가/);
  assert.match(prompt.instructions, /AI 비서처럼 메타 설명/);
  assert.match(prompt.instructions, /별자리선생 · 별자리/);
  assert.match(prompt.instructions, /전문 오버레이 RAG/);
  assert.match(prompt.instructions, /첫 문단은 반드시 이 관점으로 시작합니다/);
  assert.match(prompt.instructions, /오늘 별자리 분위기/);
  assert.match(prompt.instructions, /별자리를 운명처럼 단정하지 않습니다/);
  assert.match(alternatePrompt.instructions, /궁합선생 · 궁합과 관계/);
  assert.match(alternatePrompt.instructions, /상대와 나의 속도 차이/);
  assert.match(alternatePrompt.instructions, /상대 마음을 확정하지 않습니다/);
  assert.equal(inferDialogueFocusTopic('올해 재물운을 단도직입적으로 봐줘'), 'wealth');
  assert.equal(inferDialogueFocusTopic('요즘 부모님이랑 관계가 왜 이렇게 꼬일까'), 'relationship');
});

test('dialogue output visibly differs by selected zodiac expert', () => {
  const genericText = '지금은 무리하게 넓히기보다 먼저 정리하는 흐름이 좋습니다.';

  assert.match(
    ensureDialogueExpertVisibleOpening(genericText, 'rooster'),
    /별자리선생은 오늘 별자리 흐름에서 가볍게 챙길 한 가지를 봅니다/
  );
  assert.match(
    ensureDialogueExpertVisibleOpening(genericText, 'sheep'),
    /궁합선생은 상대와 나의 속도 차이부터 봅니다/
  );
  assert.match(
    ensureDialogueExpertVisibleOpening('별닭선생입니다. 먼저 별자리를 봅니다.', 'rooster'),
    /^별자리선생은 오늘 별자리 흐름에서 가볍게 챙길 한 가지를 봅니다/
  );
});

test('annual dialogue intent detects yearly-report style questions without catching every short topical ask', () => {
  assert.equal(isYearlyDialogueIntent('2026년 신년운세 자세히 봐줘'), true);
  assert.equal(isYearlyDialogueIntent('올해 전체 흐름을 월별로 정리해줘'), true);
  assert.equal(isYearlyDialogueIntent('올해 재물운만 짧게 알려줘'), false);
  assert.equal(inferYearlyTargetYear('2027년 연간 운세 리포트로 보고 싶어'), 2027);
});

test('dialogue answer normalization removes markdown-like markers', () => {
  const normalized = normalizeDialogueAnswer('**올해는 재물운이 살아납니다.**\n- 다만 서두르지는 마세요.\n1. 정산부터 하세요.');

  assert.equal(
    normalized,
    '올해는 재물운이 살아납니다.\n\n다만 서두르지는 마세요.\n\n정산부터 하세요.'
  );
});

test('dialogue answer normalization drops internal saju memo leakage', () => {
  const normalized = normalizeDialogueAnswer(
    '오늘은 정리와 균형이 더 큰 성과로 이어지는 날입니다.\n\n기본 흐름은 壬 수, 중화 · 66점, 역할 흐름 쪽으로 읽습니다.\n\n핵심 단서는 균형 기운이 어떻게 쓰이는지 봅니다 · 역할 흐름 반복해서 맡게 되는 역할을 봅니다입니다.\n\n지금은 말을 줄이고 확인을 먼저 하는 편이 좋습니다.'
  );

  assert.equal(
    normalized,
    '오늘은 정리와 균형이 더 큰 성과로 이어지는 날입니다.\n\n지금은 말을 줄이고 확인을 먼저 하는 편이 좋습니다.'
  );
});

test('AI route blocks unsafe dialogue before fallback generation', async () => {
  const response = createSafetyResponse('죽고싶다는 생각이 들어');

  assert.ok(response);
  if (!response) return;

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.source, 'safe_redirect');
  assert.equal(body.redirectPath, '/dialogue/safe-redirect?category=crisis');
  assert.equal(body.billing.status, 'not_charged_safe_redirect');
});

test('AI route rejects malformed requests', () => {
  assert.equal(
    parseAiRequest({
      mode: 'dialogue',
      message: '',
    }),
    null
  );
  assert.equal(
    parseAiRequest({
      mode: 'unknown',
      message: '안녕',
    }),
    null
  );
});

test('ai chat billing policy charges only successful OpenAI replies', () => {
  assert.equal(shouldChargeAiChat('openai'), true);
  assert.equal(shouldChargeAiChat('fallback'), false);
  assert.equal(getAvailableCreditsTotal({ balance: 2, subscription_balance: 3 }), 5);

  assert.deepEqual(createAiChatBillingSummary('charged_bundle', 4), {
    feature: 'ai_chat',
    cost: AI_CHAT_BUNDLE_COST,
    status: 'charged_bundle',
    remaining: 4,
    turnNumber: null,
    freeTurnsRemaining: null,
    bundleTurnsRemaining: null,
    bundleSize: AI_CHAT_BUNDLE_SIZE,
  });
});

// 2026-07-18 — "평생 3턴 무료"를 폐지하고 하루 1턴 무료로 옮겼다(free_dialogue_daily).
//   따라서 turn plan 은 도입 무료 없이 곧바로 3턴 묶음 과금 사이클을 돈다.
test('ai chat turn plan starts paid bundles immediately (도입 무료 턴 없음)', () => {
  assert.equal(AI_CHAT_FREE_TURNS, 0);

  assert.deepEqual(getAiChatTurnPlan(0), {
    status: 'charged_bundle',
    cost: AI_CHAT_BUNDLE_COST,
    turnNumber: 1,
    freeTurnsRemaining: 0,
    bundleTurnsRemaining: 2,
  });

  assert.deepEqual(getAiChatTurnPlan(1), {
    status: 'bundle_included',
    cost: 0,
    turnNumber: 2,
    freeTurnsRemaining: 0,
    bundleTurnsRemaining: 1,
  });

  assert.deepEqual(getAiChatTurnPlan(3), {
    status: 'charged_bundle',
    cost: AI_CHAT_BUNDLE_COST,
    turnNumber: 4,
    freeTurnsRemaining: 0,
    bundleTurnsRemaining: 2,
  });

  assert.deepEqual(getAiChatTurnPlan(4), {
    status: 'bundle_included',
    cost: 0,
    turnNumber: 5,
    freeTurnsRemaining: 0,
    bundleTurnsRemaining: 1,
  });
});
