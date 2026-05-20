// 2026-05-21 — 총평 섹션 생성 오케스트레이터. generate-chapter 패턴 복제.
//   섹션별 출력 스키마가 달라 openai-text 의 {body} JSON 모드 대신 *자유 텍스트 + 견고한
//   JSON 파서* 사용. 검증(validateTotalReviewSection) 실패 시 재시도, max 초과 시 fallback.
import type { ChapterLLMClient } from '../chapters/generate-chapter';
import { validateTotalReviewSection } from '@/lib/saju/total-review-validator';
import {
  TOTAL_REVIEW_SYSTEM_PROMPT,
  buildSectionUserMessage,
} from './total-review-prompts';
import type {
  TotalReviewInput,
  TotalReviewOutput,
  TotalReviewSectionId,
} from './total-review-types';

// 섹션 ID → 그 섹션이 책임지는 출력 조각 타입.
export interface TotalReviewSectionValueMap {
  one_line_summary: Pick<TotalReviewOutput, 'one_line_summary'>;
  main_narrative: Pick<TotalReviewOutput, 'main_narrative'>;
  lifetime_keys: Pick<TotalReviewOutput, 'lifetime_keys'>;
}

export interface GenerateSectionOptions<S extends TotalReviewSectionId> {
  /** 최대 재시도 (기본 2) */
  maxRetries?: number;
  /** validator fail max 초과 시 사용할 deterministic 조각 */
  fallback: TotalReviewSectionValueMap[S];
}

export interface TotalReviewSectionResult<S extends TotalReviewSectionId> {
  sectionId: S;
  source: 'llm' | 'fallback';
  value: TotalReviewSectionValueMap[S];
  /** 0 = 첫 시도 성공 */
  retries: number;
  /** 통과 시 [], fallback 시 마지막 실패 사유 */
  reasons: string[];
}

/** 코드펜스/잡텍스트가 섞여도 첫 번째 JSON 객체를 파싱. 실패 시 null. */
function parseLooseJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // 객체 경계만 추출 재시도
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 한 섹션 LLM 호출 + validateTotalReviewSection 후처리 + 재생성.
 */
export async function generateTotalReviewSection<S extends TotalReviewSectionId>(
  sectionId: S,
  input: TotalReviewInput,
  client: ChapterLLMClient,
  options: GenerateSectionOptions<S>
): Promise<TotalReviewSectionResult<S>> {
  const maxRetries = options.maxRetries ?? 2;
  const userMessage = buildSectionUserMessage(sectionId, input);
  let lastReasons: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let raw = '';
    try {
      raw = await client.generate(TOTAL_REVIEW_SYSTEM_PROMPT, userMessage);
    } catch (error) {
      lastReasons = [
        `LLM 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      ];
      continue;
    }

    const parsed = parseLooseJson(raw);
    if (!parsed) {
      lastReasons = ['JSON 파싱 실패'];
      continue;
    }

    const validation = validateTotalReviewSection(sectionId, parsed);
    if (validation.ok) {
      return {
        sectionId,
        source: 'llm',
        value: parsed as TotalReviewSectionValueMap[S],
        retries: attempt,
        reasons: [],
      };
    }
    lastReasons = validation.reasons;
  }

  return {
    sectionId,
    source: 'fallback',
    value: options.fallback,
    retries: maxRetries + 1,
    reasons: lastReasons,
  };
}
