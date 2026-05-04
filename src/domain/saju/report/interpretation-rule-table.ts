import type { FocusTopic, ReportEvidenceCard, ReportEvidenceKey, ReportScore } from './types';
import { simplifySajuCopy } from '@/lib/saju/public-copy';

export type InterpretationScoreBand = 'high' | 'mid' | 'low';

interface TopicInterpretationRule {
  evidencePriority: ReportEvidenceKey[];
  cautionPriority: ReportEvidenceKey[];
  summaryLeads: Record<InterpretationScoreBand, string>;
  actionTitles: Record<InterpretationScoreBand, string>;
  actionLeads: Record<InterpretationScoreBand, string>;
  cautionTitles: Record<InterpretationScoreBand, string>;
  cautionLeads: Record<InterpretationScoreBand, string>;
}

const TOPIC_INTERPRETATION_RULES: Record<FocusTopic, TopicInterpretationRule> = {
  today: {
    evidencePriority: ['yongsin', 'strength', 'pattern'],
    cautionPriority: ['strength', 'gongmang', 'relations'],
    summaryLeads: {
      high: '오늘은 원국의 강점을 곧바로 써먹기 좋은 흐름입니다.',
      mid: '오늘은 속도보다 균형을 먼저 세워야 결과가 매끈해집니다.',
      low: '오늘은 욕심보다 정리와 보완이 더 큰 차이를 만듭니다.',
    },
    actionTitles: {
      high: '지금 바로 살릴 흐름',
      mid: '오늘 먼저 정리할 기준',
      low: '무리하지 않고 버티는 기준',
    },
    actionLeads: {
      high: '잘 되는 축을 바로 행동으로 바꾸는 편이 운을 살립니다.',
      mid: '강한 축보다 부족한 축을 먼저 채우는 편이 하루 전체를 안정시킵니다.',
      low: '오늘은 체면보다 리듬 회복을 먼저 두는 편이 좋습니다.',
    },
    cautionTitles: {
      high: '과속만 조심하기',
      mid: '균형이 무너지는 선택 피하기',
      low: '빈틈이 커지는 흐름 조심',
    },
    cautionLeads: {
      high: '잘 풀릴수록 선을 넘기 쉬운 포인트를 같이 봐야 합니다.',
      mid: '애매한 상태에서 결론을 서두르면 오히려 흐름이 거칠어질 수 있습니다.',
      low: '오늘은 버티는 방식이 틀리면 작은 피로가 크게 남기 쉽습니다.',
    },
  },
  love: {
    evidencePriority: ['yongsin', 'relations', 'strength'],
    cautionPriority: ['relations', 'gongmang', 'strength'],
    summaryLeads: {
      high: '연애에서는 마음을 열어도 반응이 따라오기 쉬운 흐름입니다.',
      mid: '연애는 결론보다 분위기와 속도를 맞추는 편이 더 중요합니다.',
      low: '연애에서는 감정보다 거리감 조절을 먼저 해야 덜 흔들립니다.',
    },
    actionTitles: {
      high: '먼저 표현해도 되는 흐름',
      mid: '온도를 맞춰야 하는 흐름',
      low: '확인보다 여백이 필요한 흐름',
    },
    actionLeads: {
      high: '좋은 마음을 크게 증명하기보다 짧고 분명하게 전하는 쪽이 잘 맞습니다.',
      mid: '상대가 받아들이기 쉬운 속도로 표현하는 것이 오늘 연애운의 핵심입니다.',
      low: '지금은 마음을 밀어붙이기보다 불편한 부분을 키우지 않는 방식이 낫습니다.',
    },
    cautionTitles: {
      high: '반응을 재촉하지 않기',
      mid: '애매한 감정을 단정하지 않기',
      low: '서운함을 결론처럼 말하지 않기',
    },
    cautionLeads: {
      high: '흐름이 좋을수록 확인 압박이 들어가면 온도가 급히 식을 수 있습니다.',
      mid: '좋고 나쁨을 빨리 정리하려는 마음이 오히려 대화를 막을 수 있습니다.',
      low: '지금은 감정의 크기보다 표현 방식이 관계를 더 크게 흔듭니다.',
    },
  },
  wealth: {
    evidencePriority: ['yongsin', 'pattern', 'strength'],
    cautionPriority: ['gongmang', 'strength', 'relations'],
    summaryLeads: {
      high: '재물에서는 기회를 빠르게 골라 담을 감각이 살아나는 흐름입니다.',
      mid: '재물은 확장보다 구조 정리에서 차이가 더 크게 납니다.',
      low: '재물은 새 돈보다 새는 돈을 막는 쪽이 먼저입니다.',
    },
    actionTitles: {
      high: '기회를 선별할 기준',
      mid: '정산을 먼저 볼 기준',
      low: '지출부터 잠글 기준',
    },
    actionLeads: {
      high: '들어오는 흐름을 키우기보다 남길 수 있는 선택만 추리는 편이 좋습니다.',
      mid: '오늘은 수입 확대보다 고정비와 약속된 금액을 먼저 확인하는 쪽이 정확합니다.',
      low: '큰 돈 이야기를 움직이기 전에 지금 줄일 수 있는 손실부터 정리해야 합니다.',
    },
    cautionTitles: {
      high: '과신 지출 피하기',
      mid: '비교 부족과 누락 점검하기',
      low: '충동 결제 막기',
    },
    cautionLeads: {
      high: '조금 잘 풀린다고 판단이 빨라지면 손에 남는 것이 줄어들 수 있습니다.',
      mid: '작은 빈틈이 쌓이는 날이라 숫자 확인을 한 번 더 거치는 편이 좋습니다.',
      low: '오늘은 체감 만족보다 나중 피로가 더 크게 남는 소비를 조심해야 합니다.',
    },
  },
  career: {
    evidencePriority: ['pattern', 'yongsin', 'strength'],
    cautionPriority: ['strength', 'relations', 'gongmang'],
    summaryLeads: {
      high: '직장에서는 앞에 나서도 성과가 붙기 쉬운 흐름입니다.',
      mid: '직장에서는 역할 정리와 전달 순서가 성과를 좌우합니다.',
      low: '직장에서는 확장보다 완성도를 높이는 쪽이 더 안전합니다.',
    },
    actionTitles: {
      high: '성과를 보여줄 기준',
      mid: '보고 순서를 세울 기준',
      low: '역할을 줄여야 할 기준',
    },
    actionLeads: {
      high: '지금은 해야 할 일을 좁혀서 결과를 눈에 보이게 만드는 편이 유리합니다.',
      mid: '결론을 먼저 정리하고 근거를 붙이는 방식이 오늘 직장운과 잘 맞습니다.',
      low: '오늘은 일을 더 가져오기보다 맡은 범위를 선명히 하는 편이 낫습니다.',
    },
    cautionTitles: {
      high: '속도에 취하지 않기',
      mid: '범위가 흐려지는 협업 피하기',
      low: '책임을 과하게 안지 않기',
    },
    cautionLeads: {
      high: '성과 욕심이 커질수록 일정과 역할이 엉키는 지점을 같이 봐야 합니다.',
      mid: '누가 무엇을 언제까지 하는지 흐려지면 오늘 흐름이 급격히 거칠어질 수 있습니다.',
      low: '지금은 버티는 힘을 과신하면 피로와 실수가 같이 쌓이기 쉽습니다.',
    },
  },
  relationship: {
    evidencePriority: ['relations', 'yongsin', 'gongmang'],
    cautionPriority: ['relations', 'gongmang', 'strength'],
    summaryLeads: {
      high: '관계에서는 먼저 손을 내밀어도 분위기가 부드럽게 풀리기 쉬운 흐름입니다.',
      mid: '관계는 결론보다 말의 순서와 거리감 조절이 더 중요합니다.',
      low: '관계에서는 맞고 틀림보다 상처를 키우지 않는 표현이 먼저입니다.',
    },
    actionTitles: {
      high: '관계를 풀어주는 첫 말',
      mid: '관계 거리감을 조율할 기준',
      low: '관계 오해를 막는 말의 기준',
    },
    actionLeads: {
      high: '짧은 확인이나 안부처럼 부담이 낮은 말이 흐름을 여는 데 유리합니다.',
      mid: '오늘은 큰 대화보다 말의 순서와 확인 방식이 관계의 체감을 바꿉니다.',
      low: '감정의 결론을 내리기보다 사실과 기분을 나눠 말하는 편이 낫습니다.',
    },
    cautionTitles: {
      high: '관계 흐름을 단정으로 깨지 않기',
      mid: '관계 서운함을 크게 키우지 않기',
      low: '관계 감정의 잔상을 결론처럼 쌓지 않기',
    },
    cautionLeads: {
      high: '가볍게 풀릴 일도 말 한마디가 강하면 갑자기 멀어질 수 있습니다.',
      mid: '지금은 서운함을 바로 결론처럼 말하면 관계의 온도가 더 쉽게 틀어집니다.',
      low: '오늘은 해명보다 표현의 강도 자체를 낮추는 편이 더 안전합니다.',
    },
  },
};

export function getInterpretationScoreBand(
  topic: FocusTopic,
  scoreMap: Record<ReportScore['key'], number>
): InterpretationScoreBand {
  const scoreKey =
    topic === 'today'
      ? 'overall'
      : topic === 'love'
        ? 'love'
        : topic === 'wealth'
          ? 'wealth'
          : topic === 'career'
            ? 'career'
            : 'relationship';
  const score = scoreMap[scoreKey];
  if (score >= 78) return 'high';
  if (score >= 68) return 'mid';
  return 'low';
}

export function getTopicInterpretationRule(topic: FocusTopic) {
  return TOPIC_INTERPRETATION_RULES[topic];
}

export function selectEvidenceCard(
  cards: ReportEvidenceCard[],
  priorities: ReportEvidenceKey[]
) {
  for (const key of priorities) {
    const card = cards.find((item) => item.key === key);
    if (card) return card;
  }
  return cards[0] ?? null;
}

export function toEvidenceSnippet(card: ReportEvidenceCard | null) {
  if (!card) return null;
  const candidate = card.body ?? card.plainSummary ?? card.title;
  const normalized = simplifySajuCopy(candidate)
    .replace(/^(강약|격국|용신|합충|공망|신살)\s*메모:\s*/u, '')
    .replace(/^쉽게 말하면\s*/, '')
    .replace(/^전문적으로는\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return `${card.label} 흐름을 참고했습니다.`;

  const [firstSentence] = normalized.split(/(?<=[.!?])\s+/);
  return (firstSentence ?? normalized).trim();
}
