export type AiGenerationSource = 'openai' | 'fallback';

export type AiFallbackReason =
  | 'ai_not_configured'
  | 'empty_ai_response'
  | 'quota_exceeded'
  | 'openai_error';

/**
 * 2026-05-20 V2-5 PR N — OpenAI Responses API structured output 옵션.
 *
 * 자유 텍스트 응답은 마크다운 깨짐·incomplete 출력 위험이 있고, LLM 이
 * structureGuide 를 *형식이 아닌 권장* 으로 해석할 수 있음. JSON schema 강제 시
 * 응답이 *반드시 `{ body: string }` 객체* 형태로 직렬화 → 안정성 ↑.
 *
 * 사용법:
 *   const result = await generateAiText({
 *     ...,
 *     responseFormat: { type: 'json_schema_body' }
 *   });
 *   // result.text 는 여전히 body 본문 (JSON 파싱은 generateAiText 내부에서 수행).
 */
export type AiResponseFormat = { type: 'text' } | { type: 'json_schema_body' };

export interface AiTextRequest {
  instructions: string;
  input: string;
  fallbackText: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** 2026-05-20 V2-5 PR N — 응답 형식. 미지정 시 자유 텍스트 (기본 호환). */
  responseFormat?: AiResponseFormat;
}

export interface AiTextResult {
  source: AiGenerationSource;
  text: string;
  model: string | null;
  fallbackReason: AiFallbackReason | null;
  errorMessage: string | null;
  /**
   * 2026-05-20 V2-5 PR Q — 비용 추적용 usage 정보.
   * OpenAI Responses API 응답의 response.usage 에서 추출. cache hit / fallback /
   * 미지원 응답은 미설정 (undefined).
   */
  inputTokens?: number;
  outputTokens?: number;
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

    // 2026-05-20 V2-5 PR N — responseFormat 분기.
    //   - 미지정 / 'text': 기존 자유 텍스트 (이전 호환).
    //   - 'json_schema_body': { body: string } JSON schema 강제 → 응답 안정성 ↑.
    const wantsJsonBody = request.responseFormat?.type === 'json_schema_body';
    const baseRequest = {
      model: model as never,
      instructions: request.instructions,
      input: request.input,
      max_output_tokens: request.maxOutputTokens ?? 700,
      temperature: request.temperature ?? undefined,
      store: false,
    };
    const apiRequest = wantsJsonBody
      ? {
          ...baseRequest,
          text: {
            format: {
              type: 'json_schema' as const,
              name: 'chapter_body',
              schema: {
                type: 'object',
                properties: {
                  body: {
                    type: 'string',
                    description: '챕터 본문 — 자연스러운 한국어 단락 (3~7 문장).',
                  },
                },
                required: ['body'],
                additionalProperties: false,
              },
              strict: true,
            },
          },
        }
      : baseRequest;

    const response = await client.responses.create(apiRequest as never);
    const raw = response.output_text?.trim();

    if (!raw) {
      return fallbackResult(request, 'empty_ai_response');
    }

    // JSON mode 인 경우 { body } 파싱. 파싱 실패 시 raw 그대로 (defensive — schema strict
    // 이라 정상 응답은 항상 JSON 이지만 future API 변경에 대비).
    let text = raw;
    if (wantsJsonBody) {
      try {
        const parsed = JSON.parse(raw) as { body?: unknown };
        if (typeof parsed.body === 'string' && parsed.body.trim()) {
          text = parsed.body.trim();
        }
      } catch {
        // raw 가 JSON 이 아니면 그대로 사용 (validator 가 후속 처리)
      }
    }

    // 2026-05-20 V2-5 PR Q — usage 정보 추출 (비용 추적).
    //   Responses API 의 `response.usage` 가 있을 때만 기록. 타입 안전을 위해
    //   defensive 추출.
    const usage = (response as unknown as {
      usage?: { input_tokens?: number; output_tokens?: number };
    }).usage;
    const inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined;
    const outputTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined;

    return {
      source: 'openai',
      text,
      model,
      fallbackReason: null,
      errorMessage: null,
      inputTokens,
      outputTokens,
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
