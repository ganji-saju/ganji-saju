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

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('dialogue fallback copy explains that fallback answers do not charge coins', () => {
  const text = buildDialogueFallback('오늘 관계운을 짧게 알려줘');

  assert.match(text, /궁합과 관계|흐름/);
  assert.match(text, /횟수와 코인을 차감하지 않습니다/);
});

test('dialogue prompt uses the selected zodiac expert and infers focus topic from the question', () => {
  const prompt = createDialoguePrompt('올해 재물운을 단도직입적으로 봐줘', null, 'rooster');
  const alternatePrompt = createDialoguePrompt('그 사람 마음이 아직 남아 있을까요', null, 'sheep');

  assert.match(prompt.instructions, /숙련 상담가/);
  assert.match(prompt.instructions, /마크다운 기호를 쓰지 않습니다/);
  assert.match(prompt.instructions, /로봇처럼 설명하지 말고 실제 역술가/);
  assert.match(prompt.instructions, /AI 비서처럼 메타 설명/);
  assert.match(prompt.instructions, /닭띠 재물운/);
  assert.match(alternatePrompt.instructions, /양띠 궁합과 관계/);
  assert.equal(inferDialogueFocusTopic('올해 재물운을 단도직입적으로 봐줘'), 'wealth');
  assert.equal(inferDialogueFocusTopic('요즘 부모님이랑 관계가 왜 이렇게 꼬일까'), 'relationship');
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

test('ai chat turn plan gives first three turns for free before paid bundles start', () => {
  assert.deepEqual(getAiChatTurnPlan(0), {
    status: 'free_intro',
    cost: 0,
    turnNumber: 1,
    freeTurnsRemaining: AI_CHAT_FREE_TURNS - 1,
    bundleTurnsRemaining: 0,
  });

  assert.deepEqual(getAiChatTurnPlan(2), {
    status: 'free_intro',
    cost: 0,
    turnNumber: 3,
    freeTurnsRemaining: 0,
    bundleTurnsRemaining: 0,
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
