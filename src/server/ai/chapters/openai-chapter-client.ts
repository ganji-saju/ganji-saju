import {
  generateAiText,
  getOpenAIInterpretationModel,
  isOpenAIConfigured,
} from '@/server/ai/openai-text';
import type { ChapterLLMClient } from './generate-chapter';

// 2026-05-19 (다) 3차 — OpenAIChapterClient 구현. ChapterLLMClient interface
//   를 기존 openai-text 모듈 (saju-lifetime-service 가 이미 사용 중) 위에 wrap.
//   환경변수: OPENAI_API_KEY (필수) + OPENAI_INTERPRET_MODEL (선택).

export interface OpenAIChapterClientOptions {
  /** 모델 override. 기본은 getOpenAIInterpretationModel() (env OPENAI_INTERPRET_MODEL or 'gpt-5.2-chat-latest') */
  model?: string;
  /** 최대 출력 토큰. 챕터당 300자 본문이면 ~600 토큰 충분 */
  maxOutputTokens?: number;
  /** 0~1 (기본 0.5) — 결정성 vs 자연스러움 균형 */
  temperature?: number;
  /** OpenAI 호출 타임아웃 (기본 15초) */
  timeoutMs?: number;
  /**
   * 2026-05-20 V2-5 PR N — JSON structured output 사용 여부.
   *   true (기본): { body: string } JSON schema 강제 → 응답 안정성 ↑.
   *   false: 자유 텍스트 (이전 호환).
   */
  useJsonMode?: boolean;
}

/**
 * LLM 호출 실패 시 throw — generateChapter 가 try/catch 로 retry/fallback 처리.
 */
export class OpenAIChapterClientError extends Error {
  constructor(
    message: string,
    public readonly fallbackReason: string | null = null
  ) {
    super(message);
    this.name = 'OpenAIChapterClientError';
  }
}

/**
 * 2026-05-20 V2-5 PR Q — 호출별 마지막 usage 보존.
 *   ChapterLLMClient.generate() 는 string 만 반환하므로 telemetry 가 별도 경로로
 *   usage 를 받아야 함. `lastUsage` 가 가장 최근 호출의 model/tokens 를 노출.
 */
export interface ChapterClientUsage {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class OpenAIChapterClient implements ChapterLLMClient {
  private readonly options: OpenAIChapterClientOptions;
  /** 가장 최근 generate() 호출의 model/tokens — generateChapter 후 telemetry 에 사용. */
  public lastUsage: ChapterClientUsage | null = null;

  constructor(options: OpenAIChapterClientOptions = {}) {
    this.options = options;
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    if (!isOpenAIConfigured()) {
      throw new OpenAIChapterClientError(
        'OPENAI_API_KEY 미설정 — generateChapter 의 fallbackBody 사용 권장',
        'ai_not_configured'
      );
    }

    const result = await generateAiText({
      instructions: systemPrompt,
      input: userMessage,
      // OpenAIChapterClient 는 본문 fallback 책임을 안 짐 — generateChapter 의
      // options.fallbackBody 가 그 역할. fallback 시 빈 문자열 반환하면
      // throw 로 알려서 retry/fallback 흐름으로.
      fallbackText: '',
      model: this.options.model ?? getOpenAIInterpretationModel(),
      maxOutputTokens: this.options.maxOutputTokens ?? 700,
      temperature: this.options.temperature ?? 0.5,
      timeoutMs: this.options.timeoutMs,
      feature: 'chapter',
      // 2026-05-20 V2-5 PR N — JSON structured output 활성 (default: true).
      //   { body: string } schema 강제로 응답 안정성 ↑. validator 후처리는 동일
      //   (자유 텍스트 시 동일 흐름, generateAiText 가 body 추출 후 반환).
      responseFormat:
        this.options.useJsonMode === false ? { type: 'text' } : { type: 'json_schema_body' },
    });

    if (result.source === 'fallback') {
      throw new OpenAIChapterClientError(
        result.errorMessage ?? `OpenAI 호출 실패 (${result.fallbackReason})`,
        result.fallbackReason
      );
    }

    // 2026-05-20 V2-5 PR Q — usage 보존 (telemetry 가 후속 추출).
    this.lastUsage = {
      model: result.model ?? this.options.model ?? getOpenAIInterpretationModel(),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };

    return result.text;
  }
}
