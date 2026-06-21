// Task 3 — 오늘운세 LLM 프롬프트 빌더 (순수 함수 — LLM 호출 없음, DB 없음).
//
// `createTodayFortunePrompt` 은 Task-2 grounding DTO 를 받아 LLM 호출용
// { instructions, input } 문자열 쌍을 반환한다.
// Task-6 에서 generateAiText({ ..., responseFormat: { type: 'json_schema_body' } }) 에 전달된다.
//
// 출력 JSON 형식: { headline: string (1문장), body: string (2~3문장) }
// naming-policy: 본문 한자 0, doom/공포 조장 금지, 단정 표현 금지.
import type { TodayFortuneGrounding } from './grounding';

export const TODAY_FORTUNE_PROMPT_VERSION = 'tf-v1';

/**
 * TodayFortuneGrounding → { instructions, input }
 *
 * instructions: 달빛 선생 톤 + 제약 규칙 (단정 금지, 한자 0, doom 금지, JSON 출력 형식).
 * input: grounding 사실을 읽기 쉬운 텍스트로 직렬화.
 */
export function createTodayFortunePrompt(g: TodayFortuneGrounding): {
  instructions: string;
  input: string;
} {
  const instructions = [
    '당신은 달빛 선생입니다. 오늘 하루 운세를 따뜻하고 차분하게 전달하는 한국어 상담가입니다.',
    '아래 사실 정보를 자연스럽게 연결하여 오늘 운세 한 편을 작성하세요.',
    '규칙:',
    '1. 사실만 자연스럽게 연결할 것. 근거 없이 단정하거나 과장하지 마세요.',
    '2. 점수 단정 금지 — "반드시", "절대", "100%", "무조건" 같은 단정 표현은 쓰지 마세요.',
    '3. 본문 한자 0 — 모든 표기는 한글로만 작성합니다. 한자를 쓰지 마세요.',
    '4. doom·공포·불안 조장 금지 — 무서운 예언, 경고성 선고, 불안 유발 표현을 쓰지 마세요.',
    '5. 치료·진단 단정 금지. 참고 조언 톤을 유지합니다.',
    '출력 형식: JSON { "headline": "오늘을 한 문장으로 요약 (1문장)", "body": "오늘의 흐름 안내 (2~3문장)" }',
    '목록·번호·소제목 없이 JSON 만 출력하세요.',
  ].join('\n');

  const lines: Array<string | null> = [
    `오늘 일진: ${g.todayGanzi}`,
    `관심 주제: ${g.concernLabel}`,
    g.iljinScore !== null && g.iljinGrade
      ? `오늘 전반 컨디션: ${g.iljinGrade} (점수 ${g.iljinScore}점)`
      : g.iljinScore !== null
      ? `오늘 일진 점수: ${g.iljinScore}점`
      : null,
    `약한 흐름: ${g.weakElement}`,
    `강한 흐름: ${g.strongElement}`,
    g.topAreas.length > 0
      ? `높은 영역: ${g.topAreas.map((a) => `${a.label}(${a.score}점)`).join(', ')}`
      : null,
    g.triggeredCaseSummaries.length > 0
      ? `오늘 발동 케이스: ${g.triggeredCaseSummaries.join(' / ')}`
      : null,
    g.situation ? `현재 상황: ${g.situation}` : null,
    g.name ? `사용자 이름: ${g.name} (자연스러우면 한 번만 불러도 좋고, 어색하면 생략)` : null,
  ];

  const input = lines.filter((line): line is string => Boolean(line)).join('\n');

  return { instructions, input };
}

/**
 * LLM 응답 실패/플래그 OFF 시 폴백 텍스트를 반환한다.
 * UI 는 이 JSON 문자열을 파싱하여 headline + body 를 표시한다.
 */
export function buildTodayFortuneFallbackText(headline: string, body: string): string {
  return JSON.stringify({ headline, body });
}
