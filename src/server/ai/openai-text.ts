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
