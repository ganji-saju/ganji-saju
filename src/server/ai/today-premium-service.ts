// 2026-06-05 Phase 2 (PR #393 로드맵) — 오늘운세 프리미엄 LLM 깊은 풀이.
//   흐름: 언락(결제) 시 buildTodayFortuneSnapshotContent → attachTodayPremiumNarrative →
//         generateTodayPremiumInterpretation → generateAiText(feature:'today_premium').
//   - 캐시 생략(로드맵 결정): 언락 후 snapshot 영속 + 일진 매일 변경 → 캐시 hit 거의 없음.
//     snapshot JSON 의 premium_result_json(aiNarrative 포함)이 재조회를 커버.
//   - 비용 연동: generateAiText 의 feature 태그 → recordLlmRun(중앙계측 #378) → ai_llm_runs →
//     /admin/llm-cost 자동 노출(aggregateByFeature 동적 그룹핑). 별도 연동 코드 불필요.
//   - 플래그(OPENAI_INTERPRET_TODAY_PREMIUM, 기본 OFF): 코드 머지만으로 비용 미발생.
//     운영자가 키 + 플래그를 켤 때 활성(total-review 의 isTotalReviewLLMEnabled 패턴).
//   - naming-policy(plain 티어): 한자/명리어/"기운" 0, Phase 1 톤(흐름→성향→포인트→조언→주의→마무리).
//   - 실패/플래그 OFF/빈응답 → null. UI 는 블록 미노출(graceful degrade), 결제 가치는 기존 카드 유지.
import type {
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
} from '@/lib/today-fortune/types';
import { generateAiText, getOpenAIInterpretationModel } from './openai-text';
import type { LlmTelemetryStore } from './llm-telemetry';

export interface TodayPremiumInterpretationInput {
  concernLabel: string;
  gradeLabel: string | null;
  gradeMessage: string | null;
  oneLineHeadline: string;
  oneLineBody: string;
  opportunity: string;
  risk: string;
  recommendedActions: string[];
  avoidActions: string[];
  scenarioTitles: string[];
  userName: string | null;
  userId?: string | null;
}

export interface GenerateTodayPremiumDeps {
  /** 테스트/DI — 미지정 시 실제 generateAiText. */
  generate?: typeof generateAiText;
  /** 플래그 판정용 — 미지정 시 process.env. */
  env?: NodeJS.ProcessEnv;
  /** 텔레메트리 스토어 — 미지정 시 Supabase. */
  telemetryStore?: LlmTelemetryStore;
}

export interface AttachTodayPremiumNarrativeDeps {
  /** 테스트/DI — 미지정 시 실제 generateTodayPremiumInterpretation. */
  generateInterpretation?: typeof generateTodayPremiumInterpretation;
  env?: NodeJS.ProcessEnv;
  telemetryStore?: LlmTelemetryStore;
  /** 텔레메트리 user_id_hash 용 원본 id. */
  userId?: string | null;
}

const TODAY_PREMIUM_MAX_OUTPUT_TOKENS = 600;
const TODAY_PREMIUM_TIMEOUT_MS = 20_000;

/**
 * 플래그(기본 OFF). 코드 머지만으로 비용이 발생하지 않게 운영자가 명시적으로 켠다.
 * (총평/오행 등 다른 LLM 기능과 동일한 env 게이트 컨벤션.)
 */
export function isTodayPremiumLLMEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENAI_INTERPRET_TODAY_PREMIUM === '1';
}

// plain 티어 하드 가드: 프롬프트가 막지 못한 한자/명리어 누출은 실패로 간주(null 반환).
//   목록은 vocab-quality.test 의 CJK·MYEONGRI_JARGON 과 동일 — 변경 시 함께 동기화.
const FORBIDDEN_CJK = /[㐀-鿿]/;
const FORBIDDEN_MYEONGRI = /기운|강약|격국|용신|대운|세운|월운|일진/;

// plain 티어 금지어: vocab-quality.test 의 MYEONGRI_JARGON 과 동일 목록 + 한자.
const NAMING_POLICY_GUARD = [
  '한자(漢字)를 절대 쓰지 마세요. 모든 표기는 한글로만 합니다.',
  '명리 전문 용어(기운, 강약, 격국, 용신, 대운, 세운, 월운, 일진)를 쓰지 마세요.',
  '대신 일상적인 한국어(에너지, 흐름, 성향, 컨디션, 리듬)로 풀어 쓰세요.',
].join(' ');

export function buildTodayPremiumPrompt(input: TodayPremiumInterpretationInput): {
  instructions: string;
  input: string;
} {
  const instructions = [
    '당신은 오늘 하루의 운세를 따뜻하고 차분하게 풀어주는 한국어 상담가입니다.',
    '결제한 사용자에게 보여줄 "오늘의 깊은 풀이" 한 단락을 작성하세요.',
    '구조 순서: 오늘 전체 흐름 → 사용자의 성향과 오늘의 만남 → 핵심 포인트 → 행동 조언 → 주의할 점 → 차분한 마무리.',
    '4~6문장으로 자연스럽게 이어지는 한 단락만 작성합니다. 목록·번호·소제목 없이 줄글로.',
    '아래 입력 정보를 근거로 삼되 그대로 복사하지 말고 하나의 흐름으로 풀어 씁니다.',
    '치료·진단 단정, "반드시/100%/완치" 같은 단정, 투자 종목 매수·매도 지시는 쓰지 마세요. 참고 조언 톤을 유지합니다.',
    NAMING_POLICY_GUARD,
  ].join('\n');

  const lines: Array<string | null> = [
    `오늘 고민 주제: ${input.concernLabel}`,
    input.gradeLabel
      ? `오늘 전반 컨디션: ${input.gradeLabel}${input.gradeMessage ? ` — ${input.gradeMessage}` : ''}`
      : null,
    input.oneLineHeadline ? `오늘 한 줄: ${input.oneLineHeadline}` : null,
    input.oneLineBody ? `요약: ${input.oneLineBody}` : null,
    input.opportunity ? `오늘의 기회: ${input.opportunity}` : null,
    input.risk ? `오늘의 위험: ${input.risk}` : null,
    input.recommendedActions.length ? `오늘 해볼 것: ${input.recommendedActions.join(' / ')}` : null,
    input.avoidActions.length ? `오늘 줄일 것: ${input.avoidActions.join(' / ')}` : null,
    input.scenarioTitles.length ? `고민될 수 있는 상황: ${input.scenarioTitles.join(' / ')}` : null,
    input.userName
      ? `사용자 이름: ${input.userName} (자연스러우면 한 번만 불러도 좋고, 어색하면 생략)`
      : null,
  ];

  return { instructions, input: lines.filter((line): line is string => Boolean(line)).join('\n') };
}

/**
 * 오늘운세 프리미엄 깊은 풀이 1단락 생성.
 * 플래그 OFF / 미설정 키 / 빈 응답 / 오류 → null (호출부는 graceful degrade).
 */
export async function generateTodayPremiumInterpretation(
  input: TodayPremiumInterpretationInput,
  deps: GenerateTodayPremiumDeps = {}
): Promise<string | null> {
  if (!isTodayPremiumLLMEnabled(deps.env)) return null;

  const generate = deps.generate ?? generateAiText;
  const { instructions, input: userInput } = buildTodayPremiumPrompt(input);

  const result = await generate({
    instructions,
    input: userInput,
    fallbackText: '',
    model: getOpenAIInterpretationModel(),
    maxOutputTokens: TODAY_PREMIUM_MAX_OUTPUT_TOKENS,
    timeoutMs: TODAY_PREMIUM_TIMEOUT_MS,
    responseFormat: { type: 'json_schema_body' },
    feature: 'today_premium',
    userId: input.userId ?? null,
    telemetryStore: deps.telemetryStore,
  });

  if (result.source !== 'openai') return null;
  const text = result.text.trim();
  if (text.length === 0) return null;
  // naming-policy 하드 가드 — 프롬프트가 막지 못한 한자/명리어 누출은 실패로 간주.
  if (FORBIDDEN_CJK.test(text) || FORBIDDEN_MYEONGRI.test(text)) return null;
  return text;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return '';
}

/** free/premium 결정론 결과 → LLM 입력 grounding DTO (순수). */
export function toTodayPremiumInterpretationInput(
  free: TodayFortuneFreeResult,
  premium: TodayFortunePremiumResult,
  userId?: string | null
): TodayPremiumInterpretationInput {
  return {
    concernLabel: free.concernLabel,
    gradeLabel: free.iljinScore?.grade ?? null,
    gradeMessage: free.iljinScore?.gradeMessage ?? null,
    oneLineHeadline: free.oneLine.headline,
    oneLineBody: free.oneLine.body,
    opportunity: firstNonEmpty(free.opportunity.body, free.opportunity.title),
    risk: firstNonEmpty(free.risk.body, free.risk.title),
    recommendedActions: premium.recommendedActions,
    avoidActions: premium.avoidActions,
    scenarioTitles: premium.scenarios.map((scenario) => scenario.title),
    userName: free.userName,
    userId: userId ?? null,
  };
}

/**
 * premium 결과에 aiNarrative 를 주입해 반환(불변 — 새 객체).
 * 생성 실패/플래그 OFF 시 aiNarrative=null. buildTodayFortuneSnapshotContent 가 사용.
 */
export async function attachTodayPremiumNarrative(
  free: TodayFortuneFreeResult,
  premium: TodayFortunePremiumResult,
  deps: AttachTodayPremiumNarrativeDeps = {}
): Promise<TodayFortunePremiumResult> {
  const generate = deps.generateInterpretation ?? generateTodayPremiumInterpretation;
  const narrative = await generate(
    toTodayPremiumInterpretationInput(free, premium, deps.userId),
    { env: deps.env, telemetryStore: deps.telemetryStore }
  );
  return { ...premium, aiNarrative: narrative };
}
