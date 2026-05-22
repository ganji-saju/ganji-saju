import type { DecisionTraceItem } from "@/lib/saju/report-contract";

export const SAMPLE_REPORT_HERO = {
  eyebrow: "샘플 리포트",
  title: "간지사주 리포트 구조를 먼저 확인하세요",
  description:
    "아래 샘플은 가상 인물로 구성한 예시입니다. 실제 풀이는 입력하신 출생 정보에 따라 달라집니다.",
} as const;

export const SAMPLE_SUBJECT = {
  name: "윤서",
  label: "가상 인물",
  birth: "1991년 10월 18일 19:20",
  place: "서울",
  note: "실제 사용자 정보가 아닌 샘플 리포트용 예시입니다.",
} as const;

export const SAMPLE_SUMMARY = {
  oneLine: "우선순위를 또렷하게 잡을수록 강점이 길게 남는 사주입니다.",
  strongTopics: [
    "일의 우선순위를 다시 세울 때 성과가 커집니다.",
    "관계에서는 말투보다 내 입장을 차분히 정리하는 것이 먼저 힘을 냅니다.",
    "올해는 무리한 확장보다 구조를 다듬는 편이 유리합니다.",
  ],
  cautionPatterns: [
    "즉흥적인 결론이나 급한 결정은 흐름을 흔들 수 있습니다.",
    "다른 사람의 속도에 맞추느라 내 페이스를 놓치기 쉽습니다.",
    "잘할수록 과하게 책임을 끌어안는 패턴을 조심해야 합니다.",
  ],
  favorableChoice:
    "크게 벌이기보다 우선순위를 먼저 적고, 그에 맞는 선택지만 남기는 방식이 가장 잘 맞습니다.",
} as const;

export const SAMPLE_TOC = [
  "한 줄 총평",
  "타고난 성향",
  "기질과 장점",
  "반복되는 역할 흐름",
  "핵심 풀이",
  "보완 힌트",
  "재물 구조",
  "직업·사업 구조",
  "관계 구조",
  "건강·생활 리듬",
  "큰 흐름",
  "올해 흐름",
  "실행 전략",
  "세부 단서",
] as const;

export const SAMPLE_DECISION_TRACE: DecisionTraceItem[] = [
  {
    step: "01",
    title: "출생 정보 확인",
    input: "양력 1991-10-18 19:20 · 서울",
    rule: "양력/음력과 계절 흐름 확인",
    result:
      "태어난 시기의 분위기가 전체 흐름에 영향을 주기 때문에, 먼저 날짜와 계절 흐름을 확인합니다.",
    confidence: "orthodox",
  },
  {
    step: "02",
    title: "기운의 균형",
    rule: "오행 분포와 전체 균형 확인",
    result:
      "혼자 몰아가는 힘보다 주변 구조를 활용할 때 에너지를 더 안정적으로 씁니다. 그래서 생활에서 힘을 어디에 써야 하는지 먼저 정리합니다.",
    confidence: "orthodox",
  },
  {
    step: "03",
    title: "반복되는 역할 흐름",
    rule: "반복되는 반응과 역할 확인",
    result:
      "한 가지 이름으로 단정하기보다, 이 사람이 어떤 자리에서 힘을 얻고 어떤 장면에서 피로해지는지 먼저 봅니다.",
    confidence: "orthodox",
  },
  {
    step: "04",
    title: "최종 해석",
    rule: "생활에서 드러나는 핵심 흐름 정리",
    result:
      "여러 단서를 생활 장면으로 바꿔, 사용자가 바로 이해할 수 있는 핵심 풀이로 먼저 정리합니다.",
    confidence: "orthodox",
  },
  {
    step: "05",
    title: "보완 힌트 확인",
    rule: "생활에서 균형을 잡는 방법 확인",
    result:
      "부족한 부분을 어려운 말로 나열하기보다, 어떤 습관과 선택이 균형을 잡는 데 도움이 되는지 생활 언어로 이어갑니다.",
    confidence: "orthodox",
  },
  {
    step: "06",
    title: "보조 단서",
    rule: "논쟁적 해석은 참고 단계로 낮춰 분리 표시",
    result:
      "복잡한 보조 해석은 중심 풀이와 분리해 두고, 처음 읽는 사람은 건너뛰어도 되도록 낮은 층에 둡니다.",
    confidence: "reference",
  },
] as const;

export const SAMPLE_REPORT_TEASERS = [
  {
    label: "한 줄 총평",
    body: "우선순위를 또렷하게 정하는 능력이 강점이지만, 과도한 책임감은 스스로를 묶을 수 있습니다.",
  },
  {
    label: "큰 흐름",
    body: "한 번에 크게 넓히기보다, 이미 가진 기반을 정리할 때 오히려 다음 운이 부드럽게 이어집니다.",
  },
  {
    label: "실행 전략",
    body: "이번 달에는 결정을 늘리기보다, 이미 잡힌 약속과 돈의 흐름을 정리하는 편이 더 유리합니다.",
  },
] as const;

export const SAMPLE_PREVIEW_GUIDE = [
  "이 사주의 핵심 한 줄과 올해 강한 주제를 먼저 봅니다.",
  "조심할 패턴과 유리한 선택 방식을 생활 언어로 확인합니다.",
  "세부 단서는 결과 옆에서 필요할 때만 펼쳐볼 수 있습니다.",
  "PDF, MY 보관함, 대화 연결처럼 오래 남는 방식까지 함께 확인합니다.",
] as const;

export const SAMPLE_REPORT_SCOPE = [
  {
    title: "타고난 성향과 기질",
    body: "타고난 성향, 기질, 반복되는 역할 흐름을 먼저 정리해 쉽게 설명합니다.",
  },
  {
    title: "운의 흐름",
    body: "큰 흐름과 올해 흐름을 같이 보며 지금 어떤 배경 위에 서 있는지 이어서 보여드립니다.",
  },
  {
    title: "실행 전략",
    body: "돈, 일, 관계 중 우선순위를 어디에 둘지 생활 언어의 체크리스트로 정리합니다.",
  },
] as const;
