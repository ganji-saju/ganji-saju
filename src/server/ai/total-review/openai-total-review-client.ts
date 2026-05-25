// 2026-05-21 — 총평 전용 OpenAI 클라이언트. ChapterLLMClient 인터페이스 구현.
//   OpenAIChapterClient 와 달리 (1) temperature 미전달 — gpt-5.2-chat-latest 가
//   temperature 파라미터를 지원하지 않음(400). (2) 자유 텍스트 모드(섹션별 스키마 상이).
//   yearly-service 가 generateAiText 를 temperature 없이 호출하는 패턴과 동일.
import {
  generateAiText,
  getOpenAIInterpretationModel,
  isOpenAIConfigured,
} from '@/server/ai/openai-text';
import type { ChapterLLMClient } from '../chapters/generate-chapter';
import type { LlmFeature } from '@/server/ai/llm-telemetry';

export interface OpenAITotalReviewClientOptions {
  model?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** 2026-05-25 Phase 0b — 텔레메트리 영역. 총평 기본 'total_review', 궁합은 'compatibility'. */
  feature?: LlmFeature;
  userId?: string | null;
}

/** generate() 가 LLM 실패 시 throw → generateTotalReviewSection 의 retry/fallback 흐름으로. */
export function createOpenAITotalReviewClient(
  options: OpenAITotalReviewClientOptions = {}
): ChapterLLMClient {
  return {
    async generate(systemPrompt: string, userMessage: string): Promise<string> {
      if (!isOpenAIConfigured()) {
        throw new Error('OPENAI_API_KEY 미설정 — 총평 fallback 사용');
      }
      const result = await generateAiText({
        instructions: systemPrompt,
        input: userMessage,
        fallbackText: '',
        model: options.model ?? getOpenAIInterpretationModel(),
        maxOutputTokens: options.maxOutputTokens ?? 1500,
        timeoutMs: options.timeoutMs,
        feature: options.feature ?? 'total_review',
        userId: options.userId ?? null,
        // temperature 미전달 (gpt-5.2-chat-latest 미지원). 자유 텍스트 응답.
        responseFormat: { type: 'text' },
      });
      if (result.source === 'fallback') {
        throw new Error(
          result.errorMessage ?? `OpenAI 호출 실패 (${result.fallbackReason})`
        );
      }
      return result.text;
    },
  };
}
