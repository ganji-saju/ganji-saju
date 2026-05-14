export type AiGenerationSource = 'openai' | 'fallback';

export type AiFallbackReason =
  | 'ai_not_configured'
  | 'empty_ai_response'
  | 'quota_exceeded'
  | 'openai_error';

export interface AiTextRequest {
  instructions: string;
  input: string;
  fallbackText: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiTextResult {
  source: AiGenerationSource;
  text: string;
  model: string | null;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
}

const DEFAULT_OPENAI_MODEL = 'gpt-5.2';
const DEFAULT_OPENAI_INTERPRETATION_MODEL = 'gpt-5.2-chat-latest';
const OPENAI_TIMEOUT_MS = 15_000;

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? '';
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function getOpenAIInterpretationModel() {
  return process.env.OPENAI_INTERPRET_MODEL?.trim() || DEFAULT_OPENAI_INTERPRETATION_MODEL;
}

export function isOpenAIConfigured() {
  return Boolean(getOpenAIKey());
}

function fallbackResult(
  request: AiTextRequest,
  fallbackReason: AiFallbackReason,
  errorMessage: string | null = null
): AiTextResult {
  // 2026-05-15 P1: prod 가 조용히 fallback 으로 떨어지는지 가시화. 5명 부정 피드백 진단에서
  // OPENAI_API_KEY 미설정 / 빈 응답 / 쿼터 초과시 generic fallback 카피가 노출돼 사용자가
  // "안 맞는다" 라고 평가했을 가능성. 운영 로그에서 즉시 확인 가능하도록 명시적 warn.
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    const env = process.env.NODE_ENV ?? 'unknown';
    console.warn(
      `[ai/openai-text] fallback fired · reason=${fallbackReason} · env=${env}${errorMessage ? ` · err=${errorMessage}` : ''}`
    );
  }
  return {
    source: 'fallback',
    text: request.fallbackText,
    model: isOpenAIConfigured() ? request.model?.trim() || getOpenAIModel() : null,
    fallbackReason,
    errorMessage,
  };
}

export async function generateAiText(
  request: AiTextRequest
): Promise<AiTextResult> {
  const apiKey = getOpenAIKey();

  if (!apiKey) {
    return fallbackResult(request, 'ai_not_configured');
  }

  try {
    const { default: OpenAI } = await import('openai');
    const model = request.model?.trim() || getOpenAIModel();
    const client = new OpenAI({
      apiKey,
      timeout: request.timeoutMs ?? OPENAI_TIMEOUT_MS,
      maxRetries: 0,
    });

    const response = await client.responses.create({
      model: model as never,
      instructions: request.instructions,
      input: request.input,
      max_output_tokens: request.maxOutputTokens ?? 700,
      temperature: request.temperature ?? undefined,
      store: false,
    });
    const text = response.output_text?.trim();

    if (!text) {
      return fallbackResult(request, 'empty_ai_response');
    }

    return {
      source: 'openai',
      text,
      model,
      fallbackReason: null,
      errorMessage: null,
    };
  } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : null;
    const errorMessage =
      error instanceof Error ? error.message : 'OpenAI 요청에 실패했습니다.';
    const fallbackReason =
      status === 429 && /quota|billing|plan|한도/i.test(errorMessage)
        ? 'quota_exceeded'
        : 'openai_error';

    return fallbackResult(
      request,
      fallbackReason,
      errorMessage
    );
  }
}
