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

// 2026-05-15: 카피 톤을 유보형 → 단정형 으로 전면 전환.
// 5명 사용자 테스트 부정 피드백의 1차 원인 가설: "편이 좋습니다", "할 수 있습니다" 같은
// 유보형 어미가 누구에게나 적용 가능한 일반론으로 들려 "내 얘기 같지 않다" 는 인상을 줌.
// 한국 주요 사주 사이트(점신·포스텔러·사주바주 등) 후기 분석상 단정형 + 명령형 어미가
// "사주를 본 게 맞다" 는 신뢰감을 만듦. 룰 테이블은 슬롯만 단정형으로 잡고, 일주/격국
// 글자 인용은 호출 측(build-report.ts buildScoreSummary / punch-copy.ts buildPersonal*) 에서 한다.
const TOPIC_INTERPRETATION_RULES: Record<FocusTopic, TopicInterpretationRule> = {
  today: {
    evidencePriority: ['yongsin', 'strength', 'pattern'],
    cautionPriority: ['strength', 'gongmang', 'relations'],
    summaryLeads: {
      high: '오늘은 원국의 강점이 바로 살아나는 날입니다.',
      mid: '오늘은 속도보다 균형을 먼저 잡는 날입니다.',
      low: '오늘은 욕심을 줄이고 정리와 보완에 무게를 두는 날입니다.',
    },
    actionTitles: {
      high: '지금 바로 살릴 흐름',
      mid: '오늘 먼저 정리할 원칙',
      low: '무리하지 않고 버티는 원칙',
    },
    actionLeads: {
      high: '잘 되는 축을 바로 행동으로 옮기세요. 오늘은 그 한 수가 흐름 전체를 살립니다.',
      mid: '강한 축보다 부족한 축을 먼저 채우세요. 그게 하루 전체를 안정시키는 핵심입니다.',
      low: '체면보다 리듬 회복을 먼저 잡으세요. 오늘은 그게 가장 큰 차이를 만듭니다.',
    },
    cautionTitles: {
      high: '과속만 조심하기',
      mid: '균형이 무너지는 선택 피하기',
      low: '빈틈이 커지는 흐름 조심',
    },
    cautionLeads: {
      high: '잘 풀릴수록 선을 넘기 쉽습니다. 한 박자 늦추고 확인을 한 번 더 두세요.',
      mid: '애매한 상태에서 결론을 서두르면 흐름이 거칠어집니다. 결정은 내일로 미루세요.',
      low: '버티는 방식이 틀리면 작은 피로가 크게 남습니다. 일정 하나는 반드시 비우세요.',
    },
  },
  love: {
    evidencePriority: ['yongsin', 'relations', 'strength'],
    cautionPriority: ['relations', 'gongmang', 'strength'],
    summaryLeads: {
      high: '연애운이 살아납니다. 먼저 마음을 여세요.',
      mid: '연애는 결론보다 분위기와 속도를 맞추는 날입니다.',
      low: '연애는 감정보다 거리감 조절이 먼저인 날입니다.',
    },
    actionTitles: {
      high: '먼저 말해도 되는 흐름',
      mid: '온도를 맞춰야 하는 흐름',
      low: '확인보다 여백이 필요한 흐름',
    },
    actionLeads: {
      high: '좋은 마음을 크게 증명하지 마세요. 짧고 분명한 한마디가 더 정확하게 전해집니다.',
      mid: '상대가 받아들이기 쉬운 속도로 말하세요. 오늘 연애운의 핵심은 속도입니다.',
      low: '마음을 몰아가지 마세요. 불편한 부분을 키우지 않는 것이 오늘의 답입니다.',
    },
    cautionTitles: {
      high: '반응을 재촉하지 않기',
      mid: '애매한 감정을 단정하지 않기',
      low: '서운함을 결론처럼 말하지 않기',
    },
    cautionLeads: {
      high: '흐름이 좋을수록 확인 압박은 독입니다. 답을 기다리는 시간을 늘리세요.',
      mid: '좋고 나쁨을 빨리 정리하려 들면 대화 자체가 막힙니다. 한 박자 늦추세요.',
      low: '감정의 크기보다 말투이 관계를 더 크게 흔드는 날입니다. 어미를 부드럽게 다듬으세요.',
    },
  },
  wealth: {
    evidencePriority: ['yongsin', 'pattern', 'strength'],
    cautionPriority: ['gongmang', 'strength', 'relations'],
    summaryLeads: {
      high: '재물운이 살아납니다. 기회를 빠르게 골라 담으세요.',
      mid: '재물은 확장보다 구조 정리에서 차이가 나는 날입니다.',
      low: '재물은 새 돈보다 새는 돈을 막는 쪽이 먼저인 날입니다.',
    },
    actionTitles: {
      high: '기회를 선별할 원칙',
      mid: '정산을 먼저 볼 원칙',
      low: '지출부터 잠글 원칙',
    },
    actionLeads: {
      high: '들어오는 흐름을 키우지 말고 남길 수 있는 선택만 추리세요. 그게 오늘의 핵심입니다.',
      mid: '수입 확대보다 고정비와 약속된 금액을 먼저 확인하세요. 작은 누락 하나가 결과를 바꿉니다.',
      low: '큰 돈 이야기를 꺼내기 전에 지금 줄일 수 있는 손실부터 정리하세요.',
    },
    cautionTitles: {
      high: '과신 지출 피하기',
      mid: '비교 부족과 누락 점검하기',
      low: '충동 결제 막기',
    },
    cautionLeads: {
      high: '잘 풀린다고 판단이 빨라지면 손에 남는 것이 줄어듭니다. 한 번 더 비교하세요.',
      mid: '작은 빈틈이 쌓이는 날입니다. 숫자 확인을 한 번 더 거치세요.',
      low: '체감 만족보다 나중 피로가 더 크게 남는 소비를 오늘은 끊으세요.',
    },
  },
  career: {
    evidencePriority: ['pattern', 'yongsin', 'strength'],
    cautionPriority: ['strength', 'relations', 'gongmang'],
    summaryLeads: {
      high: '직장에서 앞에 나서는 날입니다. 성과가 그대로 보입니다.',
      mid: '직장은 역할 정리와 전달 순서가 성과를 좌우하는 날입니다.',
      low: '직장은 확장보다 완성도를 높이는 쪽이 안전한 날입니다.',
    },
    actionTitles: {
      high: '성과를 보여줄 원칙',
      mid: '보고 순서를 세울 원칙',
      low: '역할을 줄여야 할 원칙',
    },
    actionLeads: {
      high: '해야 할 일을 좁혀서 결과를 눈에 보이게 만드세요. 오늘은 보여주는 게 일입니다.',
      mid: '결론을 먼저 정리하고 근거를 붙이는 방식으로 가세요. 오늘 직장운과 정확히 맞습니다.',
      low: '일을 더 가져오지 마세요. 맡은 범위를 선명히 하는 게 오늘의 답입니다.',
    },
    cautionTitles: {
      high: '속도에 취하지 않기',
      mid: '범위가 흐려지는 협업 피하기',
      low: '책임을 과하게 안지 않기',
    },
    cautionLeads: {
      high: '성과 욕심이 커지면 일정과 역할이 엉킵니다. 다음 단계를 먼저 적어두세요.',
      mid: '누가 무엇을 언제까지 하는지 흐려지면 흐름이 깨집니다. 한 줄로 확정하세요.',
      low: '버티는 힘을 과신하면 피로와 실수가 같이 쌓입니다. 일정 하나를 줄이세요.',
    },
  },
  relationship: {
    evidencePriority: ['relations', 'yongsin', 'gongmang'],
    cautionPriority: ['relations', 'gongmang', 'strength'],
    summaryLeads: {
      high: '관계운이 살아납니다. 먼저 손을 내미세요.',
      mid: '관계는 말의 순서와 거리감 조절이 결정하는 날입니다.',
      low: '관계는 맞고 틀림보다 상처를 키우지 않는 말이 먼저인 날입니다.',
    },
    actionTitles: {
      high: '관계를 풀어주는 첫 말',
      mid: '관계 거리감을 조율할 원칙',
      low: '관계 오해를 막는 말의 원칙',
    },
    actionLeads: {
      high: '짧은 확인이나 안부처럼 부담이 낮은 말로 흐름을 여세요. 오늘은 가벼움이 정답입니다.',
      mid: '큰 대화는 미루세요. 말의 순서와 확인 방식이 오늘 관계의 체감을 바꿉니다.',
      low: '감정의 결론을 내리지 마세요. 사실과 기분을 나눠 말하는 것이 오늘의 답입니다.',
    },
    cautionTitles: {
      high: '관계 흐름을 단정으로 깨지 않기',
      mid: '관계 서운함을 크게 키우지 않기',
      low: '관계 감정의 잔상을 결론처럼 쌓지 않기',
    },
    cautionLeads: {
      high: '가볍게 풀릴 일도 말 한마디가 강하면 갑자기 멀어집니다. 어미를 한 단계 낮추세요.',
      mid: '서운함을 바로 결론처럼 말하면 온도가 틀어집니다. 시간을 두고 말하세요.',
      low: '해명보다 말의 강도 자체를 낮추세요. 오늘은 그게 가장 안전합니다.',
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
