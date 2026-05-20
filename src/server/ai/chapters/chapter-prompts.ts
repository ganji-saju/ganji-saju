import type { ChapterId, ChapterMeta } from './chapter-input-types';

// 2026-05-19 — 9 챕터별 system prompt + user message template.
//   report-llm-spec.md §3 (공통 system prompt) + §4 (챕터별 prompt) 의 코드화.
//   LLM 호출은 아직 구현 안 함 — 본 파일은 prompt 자산 정의.

/**
 * 9 챕터 공통 system prompt. 사이트 톤·표기 룰을 LLM 에 강제.
 * report-llm-spec.md §3 그대로.
 */
export const COMMON_SYSTEM_PROMPT = `당신은 한국 사주 명리 사이트 ganjisaju.kr 의 풀이 작성자입니다. 사용자에게 그 사람의 사주를 자연스럽고 책임감 있게 풀어 전달합니다.

## 절대 규칙
1. **한자 금지** — 본문에 한자 (甲乙丙丁戊己庚辛壬癸 / 子丑寅卯辰巳午未申酉戌亥 / 木火土金水 / 大運四柱 등) 를 절대 사용하지 마세요. 한글 표기만 사용 ("갑오 대운", "흙의 결").
2. **자연 비유 오행 라벨 강제** — 木→새싹의 결 / 火→햇살의 결 / 土→흙의 결 / 金→쇠의 결 / 水→물의 결. "결단과 마무리", "안정과 중심" 같은 옛 라벨 금지.
3. **영어 단어 금지** — "timing", "weak", "balanced" 같은 영어 표기 금지. 한글로만 ("타이밍", "약한 편", "균형 잡힌").
4. **단정형 금지** — "반드시 ~합니다", "절대 ~하지 마세요", "대흉" 같은 강한 단정 금지. 대신 "~하는 편이 좋습니다", "~신호가 자주 옵니다" 같은 결 표현.
5. **공포 표현 금지** — "암흑기", "텅장", "비책" 같은 자극적 단어 금지.
6. **호명** — 사용자 이름이 있으면 "{name}님" 으로, 없으면 "선생님" 으로. 처음 한 번만.
7. **명리 술어 + 일상어 병기** — 명리 술어 (격국·용신·12운성·신살) 사용 시 한 단락에 한 번만 + 일상어 풀이 함께 ("정인격(돌봄·후원의 결)"). 카탈로그 나열 금지.

## 톤
- 차분하고 단정한 명리 톤
- 1~2 문장 단위로 끊어 읽기 좋게
- 사용자가 다음에 할 한 가지 행동이 떠오르게`;

/**
 * 챕터별 메타 (제목 + 렌즈 + 금지 주제).
 * report-llm-spec.md §4 의 각 챕터 정의.
 */
export const CHAPTER_META: Record<ChapterId, ChapterMeta> = {
  1: {
    title: '타고난 성향',
    lens: '마음의 결 — 사주 원국에서 드러나는 본질적 성격과 사고 패턴',
    forbiddenTopics: [
      '관계 — 4장 영역',
      '재물·소비 — 5장 영역',
      '직업 선택·이직 — 6장 영역',
      '건강·수면 — 7장 영역',
      '10년 대운 흐름 — 8장 영역',
    ],
  },
  2: {
    title: '기운의 균형',
    lens: '오행 5 기운의 강약 — 어떤 기운이 풍부하고 어떤 기운이 부족한가',
    forbiddenTopics: ['성격 묘사 — 1장 영역', '관계/재물/직업 — 4·5·6장 영역'],
  },
  3: {
    title: '역할과 보완 힌트',
    lens: '사주가 가리키는 반복되는 삶의 역할 + 그 역할을 살리는 보완 축',
    forbiddenTopics: ['성격 일반 — 1장', '오행 분포 자체 — 2장'],
  },
  4: {
    title: '관계 패턴',
    lens: '사람 사이의 거리감·표현 방식·반복되는 관계 다이내믹',
    forbiddenTopics: [
      '성격 일반 — 1장',
      '직장 인간관계의 일 측면 — 6장 영역과 구분',
      '재물 관련 인연 (동업·금전 거래) — 5장 영역',
    ],
  },
  5: {
    title: '재물 감각',
    lens: '돈의 흐름 — 들어오는 결, 나가는 결, 쌓이는 결',
    forbiddenTopics: [
      '관계 관련 돈 (동업 자금) — 4장 영역과 구분',
      '직장 수입 vs 사업 수입 비교 — 6장 영역',
    ],
  },
  6: {
    title: '직업 방향',
    lens: '어떤 일의 방식이 본인 사주와 호환되는가 — 직무 성격, 조직 성격, 일의 호흡',
    forbiddenTopics: [
      "구체적 회사 이름·업종 추천 (이건 LLM 가능 영역이 아님)",
      "재물 — 5장과 차이: 6장은 '일의 방식', 5장은 '돈의 흐름'",
    ],
  },
  7: {
    title: '건강 리듬',
    lens: '사주 오행 균형이 신체·수면·체력에 어떤 결로 작동하는가',
    forbiddenTopics: [
      '구체적 질병 진단 (의료법 위반 위험) — 절대 금지',
      '특정 약·영양제 추천 — 금지',
    ],
  },
  8: {
    title: '10년 단위 큰 흐름',
    lens: '대운 — 시간축으로 펼쳐지는 사주',
    forbiddenTopics: [
      '1~7장의 챕터 영역 (성향/균형/관계/재물/직업/건강) — 대운 안에서 다시 풀지 말 것',
    ],
  },
  9: {
    title: '평생 활용 전략',
    lens: '1~8장의 모든 결을 관통하는 평생 의사결정 원칙 3~5개',
    forbiddenTopics: [
      '1~8장 본문의 단순 복사·재인용 — 금지',
      '새로운 정보 추가 — 금지 (다른 챕터에 있어야 할 내용)',
    ],
  },
};

/**
 * 챕터별 시스템 프롬프트 (공통 prompt + 챕터 책임 추가).
 * LLM 호출 시 system message 로 전달.
 */
export function buildChapterSystemPrompt(chapterId: ChapterId): string {
  const meta = CHAPTER_META[chapterId];
  const forbiddenList = meta.forbiddenTopics.map((t) => `  - ${t}`).join('\n');
  return `${COMMON_SYSTEM_PROMPT}

## 챕터 책임
당신은 지금 **${meta.title}** 챕터를 씁니다. 이 챕터의 렌즈는 "${meta.lens}" 입니다.

## 금지 주제 (다른 챕터 영역 침범 금지)
${forbiddenList}`;
}

/**
 * 챕터별 user message 길이·구조 가이드.
 * 실제 user message 는 ChapterLLMInput 의 saju + userContext 를 토대로 빌드 (별도 함수에서).
 */
export interface ChapterOutputSpec {
  /** 권장 본문 길이 범위 */
  bodyLengthRange: { min: number; max: number };
  /** 본문 구조 가이드 (사용자 메시지에 포함) */
  structureGuide: string;
  /** 9장 synthesis 용 1줄 digest 형식 (50자 이내). 9장은 digest 없음 → null */
  digestFormat: string | null;
}

/**
 * 2026-05-20 V2-5 PR M — Few-shot 예시 (report-llm-spec.md §5 의 4개 케이스).
 *
 * 챕터 1·4·5·9 만 예시 제공 — 같은 정인격 기토 일간 fixture 로 *다른 렌즈* 가
 * 어떻게 적용되는지 LLM 에 보여줌. 다른 챕터(2·3·6·7) 는 lens + structureGuide
 * 만으로도 충분히 작동 — 향후 fewshot 확장 시 케이스 추가.
 *
 * 예시 본문은 ${name} 토큰을 그대로 노출 — LLM 이 *형식*(한 줄 결론 + 일상
 * 비유 + 행동 1개) 을 학습. 호명은 spec §3 규칙 6 ("처음 한 번만") 그대로.
 */
export const FEW_SHOT_EXAMPLES: Partial<Record<ChapterId, { input: string; output: string }>> = {
  1: {
    input: `일주: 기사 (기 일간, 흙의 결 본질)
격국: 정인격 — 돌봄·후원·배움의 결
강약: 균형이 잡힌 편
지배: 흙의 결 / 부족: 쇠의 결
주된 십성: 정인`,
    output: `\${name}님의 사주는 흙의 결을 중심으로 정인의 결이 또렷이 흐릅니다. 가까운 사람을 챙기고 배움을 통해 본인의 깊이를 더하는 패턴이 반복돼요. 다만 책임을 너무 많이 짊어진 다음 갑자기 거리를 두는 패턴이 동시에 따라옵니다. 힘이 빠지기 전에 "지금 도와줄 수 없어요" 한 줄을 미리 적어두면 결이 길게 갑니다.`,
  },
  4: {
    input: `관계 신호: 정인 (돌봄·배움 인연), 부족 십성: 식상 (표현 부족)
신살: 원진
상황: 솔로`,
    output: `가까운 관계에서는 "받기보다 챙기는 자리" 가 자연스럽게 본인 쪽으로 옵니다. 멘토·선배·동료를 돌보다가 본인 마음의 신호를 늦게 알아채는 결이에요. 솔로 상태에서는 안정적으로 돌봐주는 인연이 어울리되, 본인 감정을 먼저 말해주는 사람이 더 맞습니다. 일주일에 한 번 "지금 내가 어떤 마음인지" 한 줄 적어두는 루틴이 관계 온도를 지킵니다.`,
  },
  5: {
    input: `재성: 약 (큰 흐름의 돈은 멀고 안정 수입이 가까움)
식상: 약 (재물 생성 축 부족)
주된 십성: 정인 (배움·자기계발 지출 많음)`,
    output: `돈의 결은 큰 한 방보다 꾸준한 적립이 어울리는 사주예요. 들어오는 결은 정인의 영향으로 강의·자격증·학습 같은 자기계발 지출이 많아요. "새는 결" 은 다른 사람 챙기는 비용 — 식사, 선물, 응원 메시지에 비용이 누적됩니다. 월 1회 자기계발 예산 한도를 미리 적어두고, 누군가 챙기는 비용은 별도 칸으로 분리하는 게 가장 안전한 돈 관리입니다.`,
  },
  9: {
    input: `priorChapterDigests:
  1. 돌봄과 배움이 본질 — 책임 과부하 시 자기방어로 거리감
  2. 흙의 결 강 / 쇠의 결 부족 — 쇠 보강이 회복 축
  3. 정인격 역할 반복 — 학습·강의·돌봄 환경에서 빛남
  4. 관계 = 챙기는 자리 — 본인 감정 1주 1회 적기 루틴
  5. 안정 자산형 — 자기계발 비용 별도 칸 분리
  6. 일 = 학습·후원 환경 / 자기 결단 필요 시 부담
  7. 건강 = 흙 과한 결의 둔감 / 가벼운 유산소 + 가을 음식`,
    output: `\${name}님의 평생 결을 관통하는 원칙은 세 가지입니다. 첫째, 책임은 미리 글로 적고 시작하세요. 둘째, 쇠의 결을 의식적으로 채우세요. 셋째, 자기계발과 돌봄 비용을 같은 지갑에서 빼지 마세요. 이 결이 잘 작동하는 한 단어 — 결을 적어두는 사람.`,
  },
};

export const CHAPTER_OUTPUT_SPECS: Record<ChapterId, ChapterOutputSpec> = {
  1: {
    bodyLengthRange: { min: 200, max: 280 },
    structureGuide: `출력 (3~5 문장):
- 첫 문장: 일주 + 격국 인용으로 핵심 성격 한 줄
- 중간 1~2 문장: 강점이 드러나는 장면 (구체적 행동/상황)
- 마지막 1~2 문장: 그 강점이 그림자가 될 때 (피로/고집/회피)
- 행동 제안 1줄 (선택)`,
    digestFormat: '{성향 핵심 키워드} — {그림자 신호}',
  },
  2: {
    bodyLengthRange: { min: 180, max: 240 },
    structureGuide: `출력 (3~4 문장):
- 첫 문장: 지배 오행 한 줄
- 두 번째 문장: 부족 오행이 만드는 일상의 비어있음 (구체)
- 세 번째 문장: 보강 축 (용신) 을 일상에서 채우는 한 가지 행동
- 비유는 자연 비유로만 (계절·날씨·식물·물·돌)`,
    digestFormat: '{dominant} 강 / {weakest} 부족 — {yongsin} 보강이 회복 축',
  },
  3: {
    bodyLengthRange: { min: 200, max: 280 },
    structureGuide: `출력 (3~4 문장):
- 첫 문장: 격국 한 줄 — "선생님은 살면서 {pattern.plainCue}의 역할이 반복해서 들어옵니다."
- 두 번째 문장: 그 역할이 잘 풀리는 환경 (구체 — 학습/멘토링/조직/혼자 작업 등)
- 세 번째 문장: 보완 축이 약할 때 그 역할이 어떻게 어긋나는가
- 네 번째 문장: 한 줄 행동 제안`,
    digestFormat: '{pattern_plain} 의 역할 반복 — {yongsin_plain} 보강이 핵심',
  },
  4: {
    bodyLengthRange: { min: 200, max: 280 },
    structureGuide: `출력 (3~4 문장):
- 첫 문장: 관계 결의 본질 한 줄 — 십성 + 신살 결합
- 두 번째 문장: 가까운 사람과 자주 일어나는 장면 (구체)
- 세 번째 문장: status 별 분기 (single/dating/married/separated)
- 마지막 한 줄: 관계 온도 조절 행동 1개`,
    digestFormat: '{관계 본질 키워드} — {온도 조절 행동}',
  },
  5: {
    bodyLengthRange: { min: 200, max: 280 },
    structureGuide: `출력 (3~4 문장):
- 첫 문장: 돈의 본질적 결 한 줄
- 두 번째 문장: 돈이 잘 들어오는 장면 (구체)
- 세 번째 문장: 돈이 새는 장면 (구체)
- 한 줄 돈 관리 행동`,
    digestFormat: '{재물 본질} — {새는 패턴} 차단 + {모으는 패턴} 강화',
  },
  6: {
    bodyLengthRange: { min: 200, max: 280 },
    structureGuide: `출력 (3~4 문장):
- 첫 문장: 일에 잘 맞는 환경 한 줄 (혼자/팀/속도/안정)
- 두 번째 문장: 일이 잘 풀리는 한 장면 (구체)
- 세 번째 문장: 일이 무거워지는 신호
- occupation 별 분기 (employee / self-employed / job-seeking / student)`,
    digestFormat: '{일의 방식 키워드} — {강점 환경} vs {피해야 할 환경}',
  },
  7: {
    bodyLengthRange: { min: 180, max: 260 },
    structureGuide: `출력 (3~4 문장):
- 첫 문장: 본인 사주의 신체 결 — 자연 비유 (햇살이 너무 강한 흙처럼 등)
- 두 번째 문장: 컨디션 떨어질 때의 신호
- 세 번째 문장: 회복 루틴 한 가지 (수면/식사/운동/마음 중)
- **의료적 단정 금지** — "건강 보살핌 신호" 같은 결 표현`,
    digestFormat: '{컨디션 결} — {회복 루틴 1개}',
  },
  8: {
    bodyLengthRange: { min: 0, max: 0 }, // daewoon-llm-spec 별도 호출
    structureGuide: `daewoon-llm-spec.md 의 9개 대운 풀이를 그대로 받아 챕터 8 본문으로 사용.
본 챕터의 LLM 호출은 daewoon-llm-spec.md 에 위임.`,
    digestFormat: '{현재 대운} {요약 키워드} — {다음 10년} {요약 키워드}',
  },
  9: {
    bodyLengthRange: { min: 350, max: 450 },
    structureGuide: `출력 (5~7 문장):
- **반드시 3~5개의 평생 원칙** 형태로. 각 원칙은:
  1. "핵심 원칙 한 줄 (~하는 편이 본인의 결과 가장 잘 맞습니다)"
  2. 그 원칙이 의사결정에서 어떻게 작동하는가 (1~2 문장)
- 챕터 1~7 의 같은 문장 복사 금지 — 각 챕터 digest 를 **재해석** 해서 더 높은 추상도로 압축
- 마지막 1줄: "이 결이 잘 작동하는 한 단어 — {keyword}"`,
    digestFormat: null,
  },
};
