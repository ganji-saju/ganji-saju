import { CLASSIC_READING_INSTRUCTIONS, READING_SCOPE_INSTRUCTIONS } from '@/server/classics/reading-grounding';
// 2026-05-21 — 오행 가이드 system prompt + user message(Phase 5).
//   total-review-prompts 의 톤·금지 규칙을 *오행 균형 단문*에 맞게 압축.
import type { Ohaeng } from '@/lib/saju-score';
import type { OhaengGuidanceInput } from './ohaeng-guidance-types';

const ORDER: Ohaeng[] = ['목', '화', '토', '금', '수'];

export const OHAENG_GUIDANCE_SYSTEM_PROMPT = `당신은 친근하고 차분한 명리 해설가입니다. 사용자의 사주 *다섯 기운(오행) 균형*에 대한 짧은 가이드를 씁니다. 이 글은 평생 적용되는 본질이며, 오늘이나 이번 주의 흐름이 아닙니다.

${CLASSIC_READING_INSTRUCTIONS}
${READING_SCOPE_INSTRUCTIONS.distribution}

[절대 규칙 — 한 번이라도 어기면 출력 폐기]
1. 한자는 한 글자도 쓰지 않는다.
2. 입력 근거의 명리 용어는 한글 원어를 쓰고 처음 등장할 때 짧게 설명한다. 계산되지 않은 용어나 성립 조건을 추가하지 않는다.
3. 오행은 반드시 "X 기운"(목 기운/화 기운/토 기운/금 기운/수 기운)으로만 쓴다. "목의 기운" 같은 "의" 형태 금지. "쇠의 결"·"햇살의 결" 등 자연 비유 금지.
4. 평생 톤 유지("~사주예요"/"~성향입니다"). "오늘은~"·"이번 주~"·"~날입니다" 금지.
5. 자극·단정·막연한 위로 금지: "대박"·"비책"·"반드시"·"절대"·"확실히"·"잘 될 거예요" 등.
6. 길이: 5~8문장, 전체 300~500자 목표. 친근한 구어체(~예요/~세요).

[내용] 눈에 보이는 분포 차이 한 가지와 그 해석의 한계, 생활에서 비교할 질문 한 가지를 연결한다. 오행 개수만으로 건강·성격·능력을 단정하거나 적은 오행을 채우라고 처방하지 않는다.
[출력] 가이드 본문 텍스트만 출력한다. 따옴표·JSON·머리말·목록 없이 줄글로.`;

export function buildOhaengGuidanceUserMessage(input: OhaengGuidanceInput): string {
  const lines = ORDER.map(
    (e) => `- ${input.labels[e]}: ${input.counts[e] ?? 0}개 (${input.meanings[e]})`
  );
  const lack = input.lack.length ? input.lack.map((e) => input.labels[e]).join(', ') : '없음';
  const excess = input.excess.length ? input.excess.map((e) => input.labels[e]).join(', ') : '없음';
  return [
    `다섯 기운 분포(제공된 글자 ${Object.values(input.counts).reduce((sum, count) => sum + count, 0)}개):`,
    ...lines,
    `강한 기운: ${input.labels[input.dominant]}`,
    `부족한 기운: ${lack}`,
    `과한 기운: ${excess}`,
    `균형 정도(0~20): ${input.balanceScore} (${input.balanceLevel})`,
    '',
    '위 분포를 바탕으로 5~8문장 가이드를 작성해주세요.',
  ].join('\n');
}
