import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';
import { buildLlmRunRecord } from './llm-telemetry';
import type { AiTextRequest, AiTextResult } from './openai-text';
import {
  attachTodayPremiumNarrative,
  buildTodayPremiumPrompt,
  generateTodayPremiumInterpretation,
  toTodayPremiumInterpretationInput,
  type TodayPremiumInterpretationInput,
} from './today-premium-service';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const ENV_ON = { OPENAI_INTERPRET_TODAY_PREMIUM: '1' } as unknown as NodeJS.ProcessEnv;
const ENV_OFF = {} as NodeJS.ProcessEnv;

const SAMPLE_INPUT: TodayPremiumInterpretationInput = {
  concernLabel: '재물·지출',
  gradeLabel: '좋음',
  gradeMessage: '무리하지 않으면 흐름이 받쳐주는 날',
  oneLineHeadline: '차분히 정리하기 좋은 하루',
  oneLineBody: '서두르기보다 한 박자 두고 보면 좋습니다.',
  opportunity: '미뤄둔 정산을 마무리하기 좋아요.',
  risk: '충동적인 큰 지출은 새기 쉬워요.',
  recommendedActions: ['오전에 가계부를 정리하기', '필요한 지출만 추려 결제하기'],
  avoidActions: ['즉흥적인 고액 결제'],
  scenarioTitles: ['살까 말까 고민될 때'],
  userName: '김영민',
  userId: 'user-1',
};

function aiResult(partial: Partial<AiTextResult> & Pick<AiTextResult, 'source'>): AiTextResult {
  return {
    text: '',
    model: 'gpt-5.2-chat-latest',
    fallbackReason: null,
    errorMessage: null,
    ...partial,
  };
}

function fixtureFreeAndPremium() {
  const parsed = parseBirthInputDraft(
    {
      year: '1990',
      month: '5',
      day: '5',
      hour: '10',
      minute: '0',
      gender: 'male',
      birthLocationCode: 'seoul',
      birthLocationLabel: '서울특별시',
      birthLatitude: '37.5665',
      birthLongitude: '126.9780',
      unknownTime: false,
      jasiMethod: 'unified',
      solarTimeMode: 'standard',
    },
    { requireGender: false }
  );
  if (!parsed.ok) throw new Error('fixture birth input should be valid');
  const input = parsed.input;
  const sajuData = calculateSajuDataV1(input);
  const now = new Date('2026-06-05T03:00:00Z');
  const free = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'fixture-session',
    calendarType: 'solar',
    timeRule: 'standard',
    now,
  });
  const premium = buildTodayFortunePremiumResult(input, sajuData, 'general', null, null, { now });
  return { free, premium };
}

// step 3 — 프롬프트: naming-policy 가드(한자/명리어/"기운" 0) + 입력 grounding 포함.
test('buildTodayPremiumPrompt: naming-policy 가드 + grounding 입력 포함', () => {
  const { instructions, input } = buildTodayPremiumPrompt(SAMPLE_INPUT);
  // 한자·명리어 금지 지시가 명시돼야 한다.
  assert.match(instructions, /한자/);
  assert.match(instructions, /기운/);
  assert.match(instructions, /일진|용신|격국/);
  // grounding(고민·점수·행동)이 사용자 입력에 흘러야 한다.
  assert.ok(input.includes('재물·지출'), '고민 주제 누락');
  assert.ok(input.includes('오전에 가계부를 정리하기'), '추천 행동 누락');
  assert.ok(input.includes('좋음'), '컨디션 등급 누락');
});

// step 3 — 플래그 OFF(기본): 호출 자체를 하지 않고 null.
test('generateTodayPremiumInterpretation: 플래그 OFF → null + LLM 미호출', async () => {
  let called = 0;
  const generate = async (_req: AiTextRequest): Promise<AiTextResult> => {
    called += 1;
    return aiResult({ source: 'openai', text: '호출되면 안 됨' });
  };
  const out = await generateTodayPremiumInterpretation(SAMPLE_INPUT, { env: ENV_OFF, generate });
  assert.equal(out, null);
  assert.equal(called, 0, '플래그 OFF 면 generateAiText 를 호출하지 않아야 한다');
});

// step 3 — 플래그 ON + openai 성공 → 트림된 풀이 + feature 태그 + json_schema_body.
test('generateTodayPremiumInterpretation: 플래그 ON + openai → 트림된 풀이 + today_premium 태그', async () => {
  const cap: { req?: AiTextRequest } = {};
  const generate = async (req: AiTextRequest): Promise<AiTextResult> => {
    cap.req = req;
    return aiResult({ source: 'openai', text: '  오늘은 차분히 정리하기 좋은 하루입니다.  ' });
  };
  const out = await generateTodayPremiumInterpretation(SAMPLE_INPUT, { env: ENV_ON, generate });
  assert.equal(out, '오늘은 차분히 정리하기 좋은 하루입니다.');
  assert.ok(cap.req, 'generateAiText 가 호출되어야 한다');
  assert.equal(cap.req.feature, 'today_premium');
  assert.deepEqual(cap.req.responseFormat, { type: 'json_schema_body' });
  assert.equal(cap.req.userId, 'user-1');
});

// step 3 — 플래그 ON 이어도 fallback 이면 null (실패 시 null).
test('generateTodayPremiumInterpretation: fallback → null', async () => {
  const generate = async (_req: AiTextRequest): Promise<AiTextResult> =>
    aiResult({ source: 'fallback', text: '제너릭 폴백', fallbackReason: 'ai_not_configured' });
  const out = await generateTodayPremiumInterpretation(SAMPLE_INPUT, { env: ENV_ON, generate });
  assert.equal(out, null);
});

// step 3 — openai 이지만 빈 응답 → null.
test('generateTodayPremiumInterpretation: openai 빈 텍스트 → null', async () => {
  const generate = async (_req: AiTextRequest): Promise<AiTextResult> =>
    aiResult({ source: 'openai', text: '   ' });
  const out = await generateTodayPremiumInterpretation(SAMPLE_INPUT, { env: ENV_ON, generate });
  assert.equal(out, null);
});

// step 3 — naming-policy 하드 가드: 출력에 한자 누출 시 실패로 간주(null).
test('generateTodayPremiumInterpretation: 출력 한자 누출 → null (하드 가드)', async () => {
  const generate = async (_req: AiTextRequest): Promise<AiTextResult> =>
    aiResult({ source: 'openai', text: '오늘은 癸未 흐름이 좋은 하루입니다.' });
  const out = await generateTodayPremiumInterpretation(SAMPLE_INPUT, { env: ENV_ON, generate });
  assert.equal(out, null);
});

// step 3 — naming-policy 하드 가드: 명리어("기운"/"격국") 누출 시 null.
test('generateTodayPremiumInterpretation: 출력 명리어 누출 → null (하드 가드)', async () => {
  const generate = async (_req: AiTextRequest): Promise<AiTextResult> =>
    aiResult({ source: 'openai', text: '오늘은 기운이 강해 격국이 살아나는 하루입니다.' });
  const out = await generateTodayPremiumInterpretation(SAMPLE_INPUT, { env: ENV_ON, generate });
  assert.equal(out, null);
});

// step 4 핵심 로직 — attach: 성공 시 premium.aiNarrative 주입 + 매핑 + 기존 필드 보존.
test('attachTodayPremiumNarrative: 성공 시 aiNarrative 주입 + grounding 매핑', async () => {
  const { free, premium } = fixtureFreeAndPremium();
  const cap: { dto?: TodayPremiumInterpretationInput } = {};
  const generateInterpretation = async (
    inp: TodayPremiumInterpretationInput
  ): Promise<string | null> => {
    cap.dto = inp;
    return 'AI 깊은 풀이 본문';
  };
  const out = await attachTodayPremiumNarrative(free, premium, {
    generateInterpretation,
    userId: 'user-9',
  });
  assert.equal(out.aiNarrative, 'AI 깊은 풀이 본문');
  // 기존 premium 필드는 보존된다.
  assert.deepEqual(out.recommendedActions, premium.recommendedActions);
  assert.deepEqual(out.scenarios, premium.scenarios);
  // free/premium → DTO 매핑 확인.
  assert.ok(cap.dto, '인터프리테이션이 호출되어야 한다');
  assert.equal(cap.dto.concernLabel, free.concernLabel);
  assert.deepEqual(cap.dto.recommendedActions, premium.recommendedActions);
  assert.equal(cap.dto.userId, 'user-9');
});

// step 4 핵심 로직 — attach: 생성 실패(null)면 aiNarrative null.
test('attachTodayPremiumNarrative: null 생성 → aiNarrative null', async () => {
  const { free, premium } = fixtureFreeAndPremium();
  const out = await attachTodayPremiumNarrative(free, premium, {
    generateInterpretation: async () => null,
  });
  assert.equal(out.aiNarrative, null);
});

// step 4 매핑 — toTodayPremiumInterpretationInput 이 free/premium 에서 핵심 grounding 추출.
test('toTodayPremiumInterpretationInput: free/premium 에서 grounding 추출', () => {
  const { free, premium } = fixtureFreeAndPremium();
  const dto = toTodayPremiumInterpretationInput(free, premium, 'user-3');
  assert.equal(dto.concernLabel, free.concernLabel);
  assert.equal(dto.oneLineHeadline, free.oneLine.headline);
  assert.deepEqual(dto.avoidActions, premium.avoidActions);
  assert.deepEqual(dto.scenarioTitles, premium.scenarios.map((s) => s.title));
  assert.equal(dto.userId, 'user-3');
});

// step 2 — today_premium 은 유효한 LlmFeature (중앙 계측 단가 경로 통과).
test('today_premium 은 유효한 LlmFeature 로 계측된다', () => {
  const record = buildLlmRunRecord({
    feature: 'today_premium',
    source: 'openai',
    model: 'gpt-5.2-chat-latest',
    inputTokens: 100,
    outputTokens: 200,
  });
  assert.equal(record.feature, 'today_premium');
  assert.ok(record.costUsd > 0, '단가 계산이 적용되어야 한다');
});
