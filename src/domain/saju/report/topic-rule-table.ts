import type {
  FocusTopic,
  ReportEvidenceKey,
  ReportEvidenceSource,
} from './types';

export type ReportRuleFactor =
  | 'dayMaster'
  | 'monthPillar'
  | 'fiveElements'
  | 'tenGods'
  | 'strength'
  | 'pattern'
  | 'yongsin'
  | 'currentLuck'
  | 'relations'
  | 'gongmang'
  | 'specialSals';

export interface ReportTopicRule {
  evidenceKey: ReportEvidenceKey;
  label: string;
  factors: ReportRuleFactor[];
  source: ReportEvidenceSource[];
  topicMapping: FocusTopic[];
  rationale: string;
  topicInfluence: Partial<Record<FocusTopic, string>>;
}

export const REPORT_TOPIC_RULE_TABLE: Record<ReportEvidenceKey, ReportTopicRule> = {
  strength: {
    evidenceKey: 'strength',
    label: '강약',
    factors: ['dayMaster', 'monthPillar', 'fiveElements', 'strength'],
    source: ['계산값', '적천수', '궁통보감'],
    topicMapping: ['today', 'love', 'wealth', 'career', 'relationship'],
    rationale:
      '일간을 돕는 힘과 누르는 힘의 균형은 모든 주제의 기본 체력, 속도, 감정 반응을 읽는 1차 근거입니다.',
    topicInfluence: {
      today: '오늘의 추진 속도와 쉬어야 할 지점을 정합니다.',
      love: '감정 표현을 먼저 해도 되는지, 상대 흐름을 더 기다려야 하는지 가릅니다.',
      wealth: '확장보다 보존이 필요한지, 움직여도 되는 체력인지 판단합니다.',
      career: '책임을 넓혀도 되는지, 역할을 줄이고 완성도를 높여야 하는지 봅니다.',
      relationship: '주도권과 조율 사이의 균형을 잡는 기준입니다.',
    },
  },
  pattern: {
    evidenceKey: 'pattern',
    label: '격국',
    factors: ['monthPillar', 'tenGods', 'pattern'],
    source: ['계산값', '자평진전'],
    topicMapping: ['today', 'wealth', 'career', 'relationship'],
    rationale:
      '월령과 격국은 삶에서 반복적으로 전면화되는 역할감과 관계 방식을 잡는 구조 근거입니다.',
    topicInfluence: {
      today: '오늘의 판단을 어떤 역할감에서 시작할지 잡습니다.',
      wealth: '재물을 넓히는 방식이 관리형인지 기회형인지 구분합니다.',
      career: '성과, 책임, 조직 안 역할의 해석 방향을 정합니다.',
      relationship: '상대와의 관계에서 반복되는 태도와 기대치를 읽습니다.',
    },
  },
  yongsin: {
    evidenceKey: 'yongsin',
    label: '용신',
    factors: ['fiveElements', 'strength', 'yongsin'],
    source: ['계산값', '궁통보감', '운세 룰'],
    topicMapping: ['today', 'love', 'wealth', 'career', 'relationship'],
    rationale:
      '용신은 부족하거나 과한 축을 생활에서 어떻게 보완할지 정하는 행동 제안의 핵심 근거입니다.',
    topicInfluence: {
      today: '오늘 바로 보완해야 할 기운을 행동 포인트로 바꿉니다.',
      love: '관계 온도를 올릴지 낮출지, 표현 방식을 어떻게 보완할지 정합니다.',
      wealth: '돈의 흐름에서 새는 축과 살릴 축을 나눕니다.',
      career: '성과를 내기 위해 보태야 할 업무 리듬과 환경을 잡습니다.',
      relationship: '말투, 거리감, 확인 방식의 보완 방향을 제시합니다.',
    },
  },
  relations: {
    evidenceKey: 'relations',
    label: '합충',
    factors: ['relations'],
    source: ['orrery-reference', '삼명통회'],
    topicMapping: ['today', 'love', 'career', 'relationship'],
    rationale:
      '합충은 기운이 묶이거나 부딪히는 지점을 보여주므로 사건의 속도와 관계 마찰을 보조적으로 판단합니다.',
    topicInfluence: {
      today: '오늘 유난히 빠르게 묶이거나 부딪히는 흐름을 확인합니다.',
      love: '끌림과 충돌이 동시에 생기는 감정 패턴을 분리합니다.',
      career: '협업, 피드백, 일정 충돌의 마찰 가능성을 봅니다.',
      relationship: '가까운 사람과의 오해, 화해, 거리 조절 포인트를 읽습니다.',
    },
  },
  gongmang: {
    evidenceKey: 'gongmang',
    label: '공망',
    factors: ['gongmang'],
    source: ['orrery-reference', '연해자평'],
    topicMapping: ['today', 'wealth', 'relationship'],
    rationale:
      '공망은 비어 보이거나 지연되기 쉬운 축을 표시하므로 확정, 약속, 마무리 방식의 주의 근거로 씁니다.',
    topicInfluence: {
      today: '성급히 확정하지 말고 한 번 더 확인해야 할 영역을 보여줍니다.',
      wealth: '계약, 정산, 지출 확정 전에 빈틈을 점검하게 합니다.',
      relationship: '말하지 않은 기대나 비어 있는 약속을 확인하는 근거가 됩니다.',
    },
  },
  specialSals: {
    evidenceKey: 'specialSals',
    label: '신살',
    factors: ['specialSals'],
    source: ['orrery-reference', '연해자평', '운세 룰'],
    topicMapping: ['today', 'love', 'wealth', 'career', 'relationship'],
    rationale:
      '신살은 단독 결론이 아니라 도움받는 통로와 주의할 속도를 더 세밀하게 나누는 참고 근거입니다.',
    topicInfluence: {
      today: '도움받을 통로와 과열되기 쉬운 속도를 보조적으로 봅니다.',
      love: '매력, 표현력, 감정 과열 여부를 참고합니다.',
      wealth: '도움을 받는 기회와 충동적 선택의 차이를 나눕니다.',
      career: '평판, 귀인, 돌파력, 무리수의 가능성을 보조 판단합니다.',
      relationship: '끌림과 예민함이 같이 올라오는 상황을 조심스럽게 봅니다.',
    },
  },
};

export function getReportTopicRule(key: ReportEvidenceKey) {
  return REPORT_TOPIC_RULE_TABLE[key];
}

export function getEvidenceSource(key: ReportEvidenceKey) {
  return getReportTopicRule(key).source;
}

export function getEvidenceTopicMapping(key: ReportEvidenceKey) {
  return getReportTopicRule(key).topicMapping;
}

export function getReportTopicRulesForTopic(topic: FocusTopic) {
  return Object.values(REPORT_TOPIC_RULE_TABLE).filter((rule) =>
    rule.topicMapping.includes(topic)
  );
}
