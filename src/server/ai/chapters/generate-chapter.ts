import {
  validateChapterBody,
  type ChapterValidationFailure,
} from '@/lib/saju/chapter-validator';
import type { ChapterId, ChapterLLMInput } from './chapter-input-types';
import {
  CHAPTER_META,
  CHAPTER_OUTPUT_SPECS,
  FEW_SHOT_EXAMPLES,
  buildChapterSystemPrompt,
} from './chapter-prompts';

// 2026-05-19 (다) 2차 — generateChapter() 인프라.
//   실제 OpenAI 호출은 별도 PR. 본 모듈은 ChapterLLMClient interface 로 DI
//   설계 — 어떤 LLM provider 든 plug 가능 + 테스트에서 mock 가능.

/**
 * LLM provider 추상화. 실제 구현체 (OpenAI / Anthropic / fixture) 는 별도.
 */
export interface ChapterLLMClient {
  generate(systemPrompt: string, userMessage: string): Promise<string>;
}

/**
 * 한 챕터 호출 결과.
 */
export interface ChapterOutput {
  chapterId: ChapterId;
  title: string;
  body: string;
  /** llm = LLM 응답이 validator 통과. fallback = max retries 초과 후 fallbackBody 사용. */
  source: 'llm' | 'fallback';
  /** 0 = 첫 시도 성공 */
  retries: number;
  /** 통과한 시도 또는 마지막 fail 시도의 failure 정보 (informational) */
  validationFailures: ChapterValidationFailure[];
}

export interface GenerateChapterOptions {
  /** 최대 재시도 횟수 (기본 2회) */
  maxRetries?: number;
  /** validator fail max retries 초과 시 사용할 fallback 본문 (deterministic builder 결과 등) */
  fallbackBody?: string;
  /** cross-chapter / punch-copy 룰 활성용 — 같은 리포트 안의 다른 챕터 본문 */
  crossChapterContext?: {
    allChapters: string[];
    punchLines?: string[];
  };
}

/**
 * 사주 데이터 + 사용자 컨텍스트를 user message 로 직렬화.
 * 챕터별 structureGuide 도 함께 포함해 본문 길이·구조 가이드.
 */
export function buildChapterUserMessage(input: ChapterLLMInput): string {
  const spec = CHAPTER_OUTPUT_SPECS[input.chapterId];
  const lines: string[] = [];

  // 2026-05-20 V2-5 PR M — Few-shot 예시 주입 (chapter 1·4·5·9 만).
  //   spec §5 의 예시를 user message *앞에* 두어 LLM 이 형식 (한 줄 결론 +
  //   일상 비유 + 행동 1개) + 톤 (단정 X / 결 표현 / 60자 안팎) 을 학습.
  //   같은 정인격 데이터를 챕터별로 *다른 렌즈* 로 풀어내는 사례.
  const fewShot = FEW_SHOT_EXAMPLES[input.chapterId];
  if (fewShot) {
    lines.push(
      '## 출력 예시 (형식과 톤 참고용)',
      '',
      '[입력]',
      fewShot.input,
      '',
      '[출력]',
      fewShot.output,
      '',
      '---',
      '',
      '## 실제 입력 — 사주 데이터'
    );
  } else {
    lines.push('## 사주 데이터');
  }

  lines.push(
    JSON.stringify(input.saju, null, 2),
    '',
    '## 사용자 컨텍스트',
    JSON.stringify(input.userContext, null, 2)
  );

  if (input.priorChapterDigests && input.priorChapterDigests.length > 0) {
    lines.push('', '## 1~7장 핵심 결론 (synthesis 입력)');
    for (const prior of input.priorChapterDigests) {
      lines.push(`${prior.chapterId}. ${prior.title} — ${prior.digest}`);
    }
  }

  lines.push('', '## 출력 가이드', spec.structureGuide);

  if (spec.bodyLengthRange.max > 0) {
    lines.push(
      '',
      `본문 길이: ${spec.bodyLengthRange.min}~${spec.bodyLengthRange.max}자 범위.`
    );
  }

  return lines.join('\n');
}

/**
 * 한 챕터 LLM 호출 + chapter-validator 후처리 + 재생성.
 *
 * 흐름:
 *  1. system prompt + user message build
 *  2. client.generate() 호출
 *  3. validateChapterBody 후처리
 *  4. fail 시 재시도 (maxRetries 까지)
 *  5. 모두 fail 시 fallbackBody 사용 (source='fallback')
 */
export async function generateChapter(
  input: ChapterLLMInput,
  client: ChapterLLMClient,
  options: GenerateChapterOptions = {}
): Promise<ChapterOutput> {
  const maxRetries = options.maxRetries ?? 2;
  const systemPrompt = buildChapterSystemPrompt(input.chapterId);
  const userMessage = buildChapterUserMessage(input);
  const meta = CHAPTER_META[input.chapterId];

  let lastFailures: ChapterValidationFailure[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let body = '';
    try {
      body = await client.generate(systemPrompt, userMessage);
    } catch (error) {
      // 2026-05-19 (다) 3차: LLM 호출 자체 실패 (API down / 인증 / 타임아웃) 시
      //   throw 를 retry/fallback 흐름으로 흡수. validation failure 로 기록.
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      lastFailures = [
        {
          rule: 'hanja', // placeholder rule — 실제는 client-level error.
          detail: `LLM 호출 실패: ${errorMessage}`,
        },
      ];
      continue;
    }

    const validation = validateChapterBody(body, {
      chapterId: input.chapterId,
      allChapters: options.crossChapterContext?.allChapters,
      punchLines: options.crossChapterContext?.punchLines,
    });

    if (validation.passed) {
      return {
        chapterId: input.chapterId,
        title: meta.title,
        body,
        source: 'llm',
        retries: attempt,
        validationFailures: [],
      };
    }
    lastFailures = validation.failures;
  }

  return {
    chapterId: input.chapterId,
    title: meta.title,
    body: options.fallbackBody ?? '',
    source: 'fallback',
    retries: maxRetries + 1,
    validationFailures: lastFailures,
  };
}
