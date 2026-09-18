import { CLASSIC_READING_INSTRUCTIONS } from '@/server/classics/reading-grounding';
// Task 3 — 오늘운세 LLM 프롬프트 빌더 (순수 함수 — LLM 호출 없음, DB 없음).
//
// `createTodayFortunePrompt` 은 Task-2 grounding DTO 를 받아 LLM 호출용
// { instructions, input } 문자열 쌍을 반환한다.
// Task-6 에서 generateAiText({ ..., responseFormat: { type: 'json_schema_body' } }) 에 전달된다.
//
// 출력 JSON 형식: { headline: string (1문장), body: string (4문장, 260자 이내) }
// naming-policy: 본문 한자 0, doom/공포 조장 금지, 단정 표현 금지.
import type { TodayFortuneGrounding } from './grounding';

export const TODAY_FORTUNE_PROMPT_VERSION = 'tf-v2';

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
    '사용자의 오늘 질문에 먼저 답하고, 원국과 해당 날짜를 대조한 근거 → 생활에서 있을 법한 조건부 장면 → 오늘 실행할 선택 기준 순서로 연결하세요.',
    '직업·연애 상태 등 입력에 없는 사실은 지어내지 말고 "그런 상황이라면"으로 설명하세요. 과거 사건이나 상대의 마음을 맞혔다고 단정하지 마세요.',
    '점수는 성공·질병·수입의 확률이 아닙니다. 높은 점수로 성과를 보장하거나 낮은 점수로 나쁜 사건을 예고하지 마세요.',
    '근거에 없는 시간대·다음 날·미래 시점은 만들지 마세요. 계산된 관계와 생활 조언을 구분하고, 서로 다른 분야의 점수를 바꿔 해석하지 마세요.',
    CLASSIC_READING_INSTRUCTIONS,
    '규칙:',
    '1. 사실만 자연스럽게 연결할 것. 근거 없이 단정하거나 과장하지 마세요.',
    '2. 단정 표현 금지 — "반드시", "절대", "100%", "무조건" 같은 단정 표현은 쓰지 마세요.',
    '3. 본문 한자 0 — 모든 표기는 한글로만 작성합니다. 한자를 쓰지 마세요.',
    '명리 용어는 한글 원어를 유지하고 처음 등장할 때 짧게 설명하세요. 예: 정관(책임과 규범의 별). 추상적인 역할명으로 바꾸지 마세요.',
    '4. doom·공포·불안 조장 금지 — 무서운 예언, 경고성 선고, 불안 유발 표현을 쓰지 마세요.',
    '5. 치료·진단 단정 금지. 참고 조언 톤을 유지합니다.',
    '출력 형식: JSON { "headline": "오늘 질문의 답을 한 문장으로", "body": "답 → 근거 → 조건부 생활 장면 → 선택 기준을 담은 4문장, 260자 이내" }',
    '목록·번호·소제목 없이 JSON 만 출력하세요.',
  ].join('\n');

  const lines: Array<string | null> = [
    g.classicGrounding ? `고전 해석 근거: ${JSON.stringify(g.classicGrounding)}` : null,
    g.readingDate ? `풀이 날짜: ${g.readingDate} (한국 날짜, 이 하루만 해석)` : null,
    `오늘 일진: ${g.todayGanzi}`,
    `관심 주제: ${g.concernLabel}`,
    g.reasoning ? `원국과 오늘의 관계 근거: ${g.reasoning}` : null,
    g.answer ? `질문에 대한 해석: ${g.answer}` : null,
    g.example ? `실제 사건이 아닌 조건부 생활 예시: ${g.example}` : null,
    g.choice ? `현재 계산에 따른 선택 기준: ${g.choice}` : null,
    g.lifeStage === 'child' ? '대상은 어린이: 보호자가 놀이와 돌봄에 적용할 수 있게 설명. 결혼·연애·계약·투자·직장 상황 금지.'
      : g.lifeStage === 'teen' ? '대상은 미성년자: 친구·학습·용돈 범위로 설명. 성인 관계·사업·투자·계약 조언 금지.' : null,
    g.unknownBirthTime ? '태어난 시간 미상: 시주·구체적 시간대를 근거로 사용하지 마세요.' : null,
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
