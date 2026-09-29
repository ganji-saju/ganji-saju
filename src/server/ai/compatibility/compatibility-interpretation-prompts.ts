import { CLASSIC_READING_INSTRUCTIONS, READING_SCOPE_INSTRUCTIONS } from '@/server/classics/reading-grounding';
// 2026-05-23 — 궁합 깊은 풀이 system prompt + user message(②-b).
//   ohaeng-guidance-prompts 의 절대 규칙을 *두 사람 관계 해석*에 맞게 확장. JSON 섹션 출력.
import type { CompatibilityInterpretationInput } from './compatibility-interpretation-types';

export const COMPATIBILITY_INTERPRETATION_MIN_SECTIONS = 3;
export const COMPATIBILITY_INTERPRETATION_MAX_SECTIONS = 5;
export const COMPATIBILITY_INTERPRETATION_MIN_BODY = 60;
export const COMPATIBILITY_INTERPRETATION_MAX_BODY = 420;

export const COMPATIBILITY_INTERPRETATION_SYSTEM_PROMPT = `당신은 따뜻하고 차분한 관계 상담가입니다. 두 사람의 사주를 비교한 결정론 분석 자료를 받아, 결제한 사용자에게 보여줄 "깊은 궁합 풀이"를 씁니다. 이 풀이는 두 사람의 평생 기질과 관계 패턴을 다루며, 오늘이나 이번 주의 운세가 아닙니다.

${CLASSIC_READING_INSTRUCTIONS}
${READING_SCOPE_INSTRUCTIONS.compatibility}

[절대 규칙 — 한 번이라도 어기면 출력 폐기]
1. 한자는 한 글자도 쓰지 않는다.
2. 입력 근거의 명리 용어는 한글 원어를 쓰고 처음 등장할 때 짧게 설명한다. 계산되지 않은 용어나 성립 조건을 추가하지 않는다.
3. 오행은 반드시 "X 기운"(목 기운/화 기운/토 기운/금 기운/수 기운)으로만 쓴다. "목의 기운" 같은 "의" 형태 금지. "쇠의 결"·"햇살의 결" 등 자연 비유 금지.
4. 평생/관계 톤 유지. "오늘은~"·"이번 주~"·"~날입니다" 금지.
5. 자극·단정·막연한 위로 금지: "대박"·"비책"·"반드시"·"절대"·"확실히"·"무조건"·"운명" 등.
6. 점치는 말투(미래 단정)가 아니라, 두 사람의 성향이 어떻게 만나는지 + 그래서 무엇을 하면 좋은지를 구체적으로 짚는다.

[내용]
- 제공된 점수·잘 맞는 지점·조심할 지점·4축(갈등/대화/돈/거리) 자료를 근거로, 결정론 요약보다 한 단계 더 깊고 구체적인 해석을 쓴다.
- 두 사람의 이름을 자연스럽게 부르며, 조건부 장면(연락·서운함·돈 결정·거리 등)을 예로 든다. 실제로 그런 일이 있었다고 단정하지 않는다.
- 각 섹션은 "확인된 두 사람의 차이 → 잘 맞을 조건과 부담 조건 → 서로 확인할 질문"의 흐름으로 쓴다.

[출력 — JSON 만]
다음 형식의 JSON 객체 하나만 출력한다. 머리말·코드펜스·설명 없이 JSON 만:
{"sections":[{"title":"짧은 제목(한 줄)","body":"본문 ${COMPATIBILITY_INTERPRETATION_MIN_BODY}~${COMPATIBILITY_INTERPRETATION_MAX_BODY}자, 친근한 구어체"}]}
- 각 본문은 180~320자를 목표로 근거와 상황의 차이를 충분히 설명한다.
- sections 는 ${COMPATIBILITY_INTERPRETATION_MIN_SECTIONS}~${COMPATIBILITY_INTERPRETATION_MAX_SECTIONS}개.
- title 은 한 줄(최대 28자), body 는 ${COMPATIBILITY_INTERPRETATION_MIN_BODY}~${COMPATIBILITY_INTERPRETATION_MAX_BODY}자.`;

export function buildCompatibilityInterpretationUserMessage(
  input: CompatibilityInterpretationInput
): string {
  const axisLines = input.axes.map(
    (axis) => `- ${axis.eyebrow}: ${axis.summary} (실천: ${axis.practice})`
  );
  const evidenceLines = input.evidence.map((item) => `- ${item.title}: ${item.body}`);

  return [
    input.natalEvidence ? `각 사람의 원국 근거: ${JSON.stringify(input.natalEvidence)}` : '원국 상세 근거 없음: 제공된 비교 근거 안에서만 설명',
    `관계 유형: ${input.relationshipLabel}`,
    `두 사람: ${input.selfName}(${input.selfElementLabel}) · ${input.partnerName}(${input.partnerElementLabel})`,
    `궁합 점수: ${input.score}점 (${input.scoreLabel}, 내부 비교 지표이며 성공·결혼 확률이 아님)`,
    `한 줄 요약: ${input.headline}`,
    '',
    `잘 맞는 지점: ${input.supportiveSummary}`,
    `조심할 지점: ${input.cautionSummary}`,
    '',
    '4축 분석(근거):',
    ...axisLines,
    '',
    '추가 단서:',
    ...evidenceLines,
    '',
    `위 자료를 바탕으로 ${input.selfName}님과 ${input.partnerName}님을 위한 깊은 궁합 풀이를 ${COMPATIBILITY_INTERPRETATION_MIN_SECTIONS}~${COMPATIBILITY_INTERPRETATION_MAX_SECTIONS}개 섹션의 JSON 으로 작성해주세요.`,
  ].join('\n');
}
