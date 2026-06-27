import { Solar } from 'lunar-typescript';
import {
  buildSajuReport,
  type ReportEvidenceCard,
  type ReportScore,
  type SajuInterpretationGrounding,
  type SajuReport,
} from '@/domain/saju/report';
import {
  getTopicInterpretationRule,
  selectEvidenceCard,
  toEvidenceSnippet,
} from '@/domain/saju/report/interpretation-rule-table';
import type { KasiSingleInputComparison } from '@/domain/saju/validation/kasi-calendar';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { MoonlightCounselorId } from '@/lib/counselors';
import { sanitizeUserFacingCopy, simplifySajuCopy } from '@/lib/saju/public-copy';
import { toKoreanGanzi } from '@/lib/saju/ganzi-korean';
import { selectUpsell } from '@/lib/upsell';
import { getTodayConcern } from '@/lib/today-fortune/concerns';
// 2026-05-15 PR 2 — 운세톡톡 벤치마크: 행운 패키지 12종.
import { buildTodayLuckyPackage } from '@/lib/today-fortune/lucky-package';
// 2026-05-15 PR 3 — 운세톡톡 벤치마크: 일진 점수 산출 + 메시지 라이브러리.
import { calculateIljinScore, type SajuOriginInput } from '@/lib/today-fortune/iljin-score-engine';
import { pickIljinMessages } from '@/lib/today-fortune/iljin-case-picker';
import type { Branch as IljinBranch, Stem as IljinStem } from '@/lib/today-fortune/iljin-rules';
// 2026-05-15 PR — 02 신살 spec doc: 종합 신살 탐지 (20종).
import { applyActiveSinsalWeights } from '@/lib/sinsal-active-weights';
import { detectComprehensiveSinsals } from '@/lib/today-fortune/sinsal-comprehensive';
// 2026-05-16 PR #149 (Part C) — 사용자 상황 기반 영역 점수 재정렬.
import { reorderTodayScoresBySituation } from '@/lib/today-fortune/situation-score-priority';
// 2026-05-16 PR #179 — 사주 페이지 ↔ 운세 페이지 점수 단일화 helper.
import { unifyScoresWithIljinScore } from '@/lib/today-fortune/unify-saju-scores';
import type {
  ConcernId,
  TodayCalendarType,
  TodayFortuneBirthPayload,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
  TodaySajuChartSnapshot,
  TodayScoreItem,
  TodayTimeRule,
  TodayTimeWindow,
} from '@/lib/today-fortune/types';
import type { BirthInput, Branch, Element, Stem } from '@/lib/saju/types';

interface TodayFortuneBuildOptions {
  concernId: ConcernId;
  sourceSessionId: string;
  calendarType: TodayCalendarType;
  timeRule: TodayTimeRule;
  counselorId?: MoonlightCounselorId | null;
  grounding?: SajuInterpretationGrounding | null;
  kasiComparison?: KasiSingleInputComparison | null;
  // 2026-05-18: 테스트 전용 — fixed Date 주입으로 다른 "오늘" 시뮬레이션.
  // production 호출자는 미사용 → getTodayPillarSnapshot 이 new Date() default.
  now?: Date;
}

const SCORE_LABELS: Record<TodayScoreItem['key'], string> = {
  overall: '총운',
  love: '연애',
  wealth: '재물',
  career: '직장',
  relationship: '관계',
  condition: '컨디션',
};

const TIME_BLOCKS: Array<{
  range: string;
  startHour: number;
  midpointHour: number;
  dayOffset: number;
}> = [
  { range: '23:00 - 01:00', startHour: 23, midpointHour: 0, dayOffset: 1 },
  { range: '01:00 - 03:00', startHour: 1, midpointHour: 2, dayOffset: 0 },
  { range: '03:00 - 05:00', startHour: 3, midpointHour: 4, dayOffset: 0 },
  { range: '05:00 - 07:00', startHour: 5, midpointHour: 6, dayOffset: 0 },
  { range: '07:00 - 09:00', startHour: 7, midpointHour: 8, dayOffset: 0 },
  { range: '09:00 - 11:00', startHour: 9, midpointHour: 10, dayOffset: 0 },
  { range: '11:00 - 13:00', startHour: 11, midpointHour: 12, dayOffset: 0 },
  { range: '13:00 - 15:00', startHour: 13, midpointHour: 14, dayOffset: 0 },
  { range: '15:00 - 17:00', startHour: 15, midpointHour: 16, dayOffset: 0 },
  { range: '17:00 - 19:00', startHour: 17, midpointHour: 18, dayOffset: 0 },
  { range: '19:00 - 21:00', startHour: 19, midpointHour: 20, dayOffset: 0 },
  { range: '21:00 - 23:00', startHour: 21, midpointHour: 22, dayOffset: 0 },
];

const STEM_ELEMENT_MAP: Record<Stem, Element> = {
  '甲': '목',
  '乙': '목',
  '丙': '화',
  '丁': '화',
  '戊': '토',
  '己': '토',
  '庚': '금',
  '辛': '금',
  '壬': '수',
  '癸': '수',
};

const BRANCH_ELEMENT_MAP: Record<Branch, Element> = {
  '子': '수',
  '丑': '토',
  '寅': '목',
  '卯': '목',
  '辰': '토',
  '巳': '화',
  '午': '화',
  '未': '토',
  '申': '금',
  '酉': '금',
  '戌': '토',
  '亥': '수',
};

const BRANCH_ORDER: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const BRANCH_SIX_HARMONIES = new Map<string, string>(
  [
    ['子-丑', '토'],
    ['寅-亥', '목'],
    ['卯-戌', '화'],
    ['辰-酉', '금'],
    ['巳-申', '수'],
    ['午-未', '토'],
  ] as const
);

const BRANCH_CLASHES = new Set<string>(['子-午', '丑-未', '寅-申', '卯-酉', '辰-戌', '巳-亥']);
const BRANCH_HARMS = new Set<string>(['子-未', '丑-午', '寅-巳', '卯-辰', '申-亥', '酉-戌']);
const BRANCH_BREAKS = new Set<string>(['子-酉', '卯-午', '辰-丑', '未-戌', '寅-亥', '巳-申']);
const BRANCH_PUNISHMENTS = new Set<string>([
  '寅-巳',
  '巳-申',
  '寅-申',
  '丑-未',
  '未-戌',
  '丑-戌',
  '子-卯',
  '辰-辰',
  '午-午',
  '酉-酉',
  '亥-亥',
]);

const HALF_HARMONY_PAIRS = new Map<string, string>(
  [
    ['申-子', '수 반합'],
    ['子-辰', '수 반합'],
    ['亥-卯', '목 반합'],
    ['卯-未', '목 반합'],
    ['寅-午', '화 반합'],
    ['午-戌', '화 반합'],
    ['巳-酉', '금 반합'],
    ['酉-丑', '금 반합'],
  ] as const
);

const GENERATED_BY_MAP: Record<Element, Element> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목',
};

const GENERATOR_OF_MAP: Record<Element, Element> = {
  목: '수',
  화: '목',
  토: '화',
  금: '토',
  수: '금',
};

const CONTROLLER_OF_MAP: Record<Element, Element> = {
  목: '금',
  화: '수',
  토: '목',
  금: '화',
  수: '토',
};

const CONCERN_WINDOW_COPY: Record<
  ConcernId,
  {
    favorableTitle: string;
    favorableTail: string;
    cautionTitle: string;
    cautionTail: string;
    actNowTitle: string;
    waitTitle: string;
    actNowTail: string;
    waitTail: string;
  }
> = {
  love_contact: {
    favorableTitle: '먼저 닿는 말을 쓰기 좋은 시간',
    favorableTail: '짧은 안부나 확인처럼 부담이 낮은 말부터 꺼내는 편이 맞습니다.',
    cautionTitle: '감정 해석이 과열되기 쉬운 시간',
    cautionTail: '반응을 재촉하거나 감정의 결론을 묻는 말은 한 템포 늦추는 편이 안전합니다.',
    actNowTitle: '오늘 먼저 연락할 때',
    waitTitle: '조금 늦춰서 연락할 때',
    actNowTail: '안부처럼 가벼운 첫 문장을 쓰면 흐름을 열기 쉽습니다.',
    waitTail: '말의 온도와 길이를 다듬으면 충돌을 줄이기 좋습니다.',
  },
  money_spend: {
    favorableTitle: '정산과 확인을 끝내기 좋은 시간',
    favorableTail: '수입 확대보다 약속된 금액과 고정비를 먼저 정리하는 편이 정확합니다.',
    cautionTitle: '과신 결제가 새기 쉬운 시간',
    cautionTail: '비교 없이 결제하거나 권유만 믿고 움직이는 선택은 한 번 더 확인하세요.',
    actNowTitle: '오늘 바로 결제할 때',
    waitTitle: '하루 보류하고 다시 볼 때',
    actNowTail: '정해진 생활성 지출은 구조를 분명히 하고 끝내는 쪽이 낫습니다.',
    waitTail: '비교와 정산을 거치면 손실 체감이 확실히 줄어듭니다.',
  },
  work_meeting: {
    favorableTitle: '역할과 순서을 먼저 세우기 좋은 시간',
    favorableTail: '회의나 계약은 결론보다 조건과 책임 범위를 선명히 하는 쪽이 더 강합니다.',
    cautionTitle: '확답이 부담으로 남기 쉬운 시간',
    cautionTail: '합의가 덜 된 상태에서 바로 확답하거나 서명하는 흐름은 조심해야 합니다.',
    actNowTitle: '오늘 미팅을 바로 진행할 때',
    waitTitle: '한 번 더 조율하고 진행할 때',
    actNowTail: '역할과 순서만 분명하면 속도는 충분히 붙습니다.',
    waitTail: '수정안과 다음 약속을 함께 잡으면 주도권을 덜 잃습니다.',
  },
  relationship_conflict: {
    favorableTitle: '말의 순서를 조율하기 좋은 시간',
    favorableTail: '큰 대화보다 짧은 확인과 사실 정리를 먼저 두는 편이 흐름을 덜 흔듭니다.',
    cautionTitle: '서운함이 결론처럼 커지기 쉬운 시간',
    cautionTail: '단정형 말이나 감정의 잔상을 크게 남기는 말은 줄이는 편이 좋습니다.',
    actNowTitle: '바로 말할 때',
    waitTitle: '조금 식힌 뒤 말할 때',
    actNowTail: '사실과 감정을 분리해 말하면 오해를 줄이기 쉽습니다.',
    waitTail: '질문형 문장으로 바꾸면 상대의 방어를 낮추는 데 도움이 됩니다.',
  },
  energy_health: {
    favorableTitle: '힘을 써도 버틸 수 있는 시간',
    favorableTail: '집중해야 할 일은 짧게 나누고, 중간 회복 시간을 분명히 두는 편이 맞습니다.',
    cautionTitle: '피로가 누적되기 쉬운 시간',
    cautionTail: '몰아서 움직이기보다 쉬는 길이와 강도를 미리 정해두는 편이 안전합니다.',
    actNowTitle: '일정을 바로 진행할 때',
    waitTitle: '중간에 쉬어가며 쓸 때',
    actNowTail: '짧은 성과는 날 수 있지만 회복 구간이 없으면 뒷심이 급히 떨어질 수 있습니다.',
    waitTail: '집중 시간은 오히려 길어지고 판단도 차분해지기 쉽습니다.',
  },
  general: {
    favorableTitle: '하루의 첫 행동을 정하기 좋은 시간',
    favorableTail: '큰 결론보다 작은 행동 하나를 먼저 끝내는 편이 전체 흐름을 안정시킵니다.',
    cautionTitle: '균형이 무너지기 쉬운 시간',
    cautionTail: '생각만 길어지거나 반대로 너무 서두르면 좋은 흐름도 거칠어질 수 있습니다.',
    actNowTitle: '바로 움직일 때',
    waitTitle: '흐름을 먼저 보고 움직일 때',
    actNowTail: '작게라도 먼저 끝내는 행동이 하루 전체의 흐름을 만들어 줍니다.',
    waitTail: '우선순위를 먼저 세우면 뒤쪽 선택이 훨씬 가벼워집니다.',
  },
};

const FREE_RESULT_GUIDE_COPY: Record<
  ConcernId,
  {
    opportunityTitle: string;
    opportunityBody: string;
    riskTitle: string;
    riskBody: string;
  }
> = {
  love_contact: {
    opportunityTitle: '먼저 건네도 좋은 말',
    opportunityBody: '긴 고백보다 짧은 안부가 좋아요. 상대가 답하기 편한 문장 하나만 보내보세요.',
    riskTitle: '오늘 줄일 말',
    riskBody: '왜 답이 늦었는지 따지거나 마음을 바로 확인하려는 말은 피하는 편이 좋아요.',
  },
  money_spend: {
    opportunityTitle: '오늘 챙길 돈',
    opportunityBody: '새로 사기보다 이미 나가기로 한 돈, 구독료, 약속된 금액부터 확인해보세요.',
    riskTitle: '오늘 미룰 결제',
    riskBody: '권유만 듣고 바로 결제하는 일은 피하세요. 가격과 조건을 한 번 더 보면 충분합니다.',
  },
  work_meeting: {
    opportunityTitle: '먼저 정하면 좋은 순서',
    opportunityBody: '회의나 계약은 결론보다 조건, 일정, 책임 범위를 먼저 적어두면 편해요.',
    riskTitle: '오늘 피할 확답',
    riskBody: '아직 정리되지 않은 일에 바로 “네”라고 답하지 마세요. 확인 후 답해도 늦지 않습니다.',
  },
  relationship_conflict: {
    opportunityTitle: '오해를 줄이는 말',
    opportunityBody: '바로 판단하기보다 “내가 이렇게 이해해도 될까?”처럼 확인하는 말이 좋아요.',
    riskTitle: '오늘 피할 말',
    riskBody: '항상, 절대, 너는 원래 같은 단정적인 말은 줄이세요. 대화가 커질 수 있습니다.',
  },
  energy_health: {
    opportunityTitle: '오늘 살릴 컨디션',
    opportunityBody: '중요한 일은 짧게 나눠서 해보세요. 중간에 쉬는 시간을 먼저 잡으면 훨씬 낫습니다.',
    riskTitle: '오늘 무리할 일',
    riskBody: '한 번에 몰아서 끝내려는 일정은 피하세요. 피곤해지면 판단도 같이 흐려질 수 있습니다.',
  },
  general: {
    opportunityTitle: '오늘 먼저 끝낼 일',
    opportunityBody: '큰 결정보다 미뤄둔 작은 일 하나를 끝내면 하루가 훨씬 가벼워져요.',
    riskTitle: '오늘 줄일 습관',
    riskBody: '생각만 오래 하거나 급하게 정하는 일은 줄이세요. 할 일 하나만 고르면 충분합니다.',
  },
};

const TIME_BRANCH_LABELS: Record<Branch, string> = {
  子: '밤 정리',
  丑: '새벽 점검',
  寅: '아침 준비',
  卯: '아침 시작',
  辰: '오전 정리',
  巳: '오전 집중',
  午: '점심 전후',
  未: '오후 정돈',
  申: '오후 확인',
  酉: '저녁 마무리',
  戌: '저녁 정리',
  亥: '밤 휴식',
};

const TIME_BRANCH_WINDOW_COPY: Record<
  Branch,
  {
    favorableTitle: string;
    favorableBody: string;
    cautionTitle: string;
    cautionBody: string;
  }
> = {
  子: {
    favorableTitle: '내일 할 일 하나만 정하기 좋아요',
    favorableBody: '생각이 많아지는 시간이라 큰 결론보다 내일 첫 행동 하나를 적어두면 편합니다.',
    cautionTitle: '늦은 결론은 줄여요',
    cautionBody: '감정이 길어지기 쉬워 중요한 답장은 아침에 다시 보는 편이 좋습니다.',
  },
  丑: {
    favorableTitle: '돈과 약속을 차분히 확인하기 좋아요',
    favorableBody: '급히 바꾸기보다 빠진 금액, 시간, 약속을 조용히 확인하기 좋은 때입니다.',
    cautionTitle: '혼자 오래 붙잡지 마세요',
    cautionBody: '생각이 무거워지면 작은 일도 크게 느껴질 수 있어 잠깐 멈추는 편이 좋습니다.',
  },
  寅: {
    favorableTitle: '아침 준비를 시작하기 좋아요',
    favorableBody: '복잡한 일보다 몸을 깨우고 오늘 할 일을 가볍게 펼치기 좋은 시간입니다.',
    cautionTitle: '서두른 출발은 줄여요',
    cautionBody: '급하게 시작하면 빠뜨리는 일이 생기기 쉬워 순서를 먼저 확인하세요.',
  },
  卯: {
    favorableTitle: '연락과 가벼운 시작에 좋아요',
    favorableBody: '짧은 연락, 간단한 정리, 작은 시작처럼 부담 없는 행동에 잘 맞습니다.',
    cautionTitle: '말이 빨라지지 않게 해요',
    cautionBody: '좋은 뜻도 길게 말하면 부담이 될 수 있어 짧고 부드럽게 전하세요.',
  },
  辰: {
    favorableTitle: '해야 할 일을 정리하기 좋아요',
    favorableBody: '머릿속에 흩어진 일을 목록으로 나누면 오늘의 우선순위가 잘 보입니다.',
    cautionTitle: '계획만 늘리지 마세요',
    cautionBody: '생각이 많아져 실행이 늦어질 수 있으니 가장 작은 일부터 시작하세요.',
  },
  巳: {
    favorableTitle: '집중해서 처리하기 좋아요',
    favorableBody: '짧게 몰입해서 끝낼 수 있는 일에 잘 맞습니다. 알림은 잠시 줄여도 좋습니다.',
    cautionTitle: '말과 판단이 뜨거워질 수 있어요',
    cautionBody: '확답이나 결제는 한 번 더 확인하고, 감정적인 말은 조금 식힌 뒤 전하세요.',
  },
  午: {
    favorableTitle: '사람과 맞추기 좋아요',
    favorableBody: '혼자 결정하기보다 함께 확인하고 조율하는 일에 잘 맞는 시간입니다.',
    cautionTitle: '기분대로 정하지 마세요',
    cautionBody: '순간 기분이 선택을 크게 만들 수 있어 금액과 약속은 다시 확인하세요.',
  },
  未: {
    favorableTitle: '오후 계획을 다듬기 좋아요',
    favorableBody: '오전에 놓친 것을 정리하고 남은 일을 현실적으로 줄이기 좋은 때입니다.',
    cautionTitle: '피로한 상태의 약속은 줄여요',
    cautionBody: '컨디션이 흔들리면 판단도 흐려질 수 있어 무리한 약속은 피하세요.',
  },
  申: {
    favorableTitle: '결정 전 확인하기 좋아요',
    favorableBody: '바로 정하기보다 비교, 확인, 재점검을 거치면 실수가 줄어듭니다.',
    cautionTitle: '마음이 급해지기 쉬워요',
    cautionBody: '빨리 끝내고 싶은 마음이 커질 수 있어 중요한 선택은 숫자와 조건을 보세요.',
  },
  酉: {
    favorableTitle: '마무리와 정리에 좋아요',
    favorableBody: '오늘 한 일을 정리하고, 남은 답장이나 확인을 깔끔하게 끝내기 좋습니다.',
    cautionTitle: '평가에 예민해지지 마세요',
    cautionBody: '상대 반응을 크게 해석하기 쉬우니 사실과 감정을 나눠서 보세요.',
  },
  戌: {
    favorableTitle: '하루를 정리하기 좋아요',
    favorableBody: '새 일을 늘리기보다 오늘 끝낸 것과 남길 것을 나누면 마음이 가벼워집니다.',
    cautionTitle: '늦은 시간 확답은 줄여요',
    cautionBody: '피곤한 상태에서는 말이 딱딱해질 수 있어 중요한 대화는 짧게만 하세요.',
  },
  亥: {
    favorableTitle: '마음 정리와 휴식에 좋아요',
    favorableBody: '몸을 쉬게 하고 마음에 남은 일을 덜어내기 좋은 시간입니다.',
    cautionTitle: '생각을 오래 굴리지 마세요',
    cautionBody: '늦은 고민은 커지기 쉬워 내일 확인할 것만 적고 쉬는 편이 좋습니다.',
  },
};

const CONCERN_EASY_TIME_COPY: Record<
  ConcernId,
  {
    favorable: string;
    caution: string;
  }
> = {
  love_contact: {
    favorable: '연락은 짧게, 부담 없는 말부터 시작해보세요.',
    caution: '상대 반응을 바로 결론으로 보지 말고 한 템포 늦춰보세요.',
  },
  money_spend: {
    favorable: '새로 사기보다 금액, 조건, 고정비를 먼저 확인하기 좋습니다.',
    caution: '즉흥 결제나 권유성 구매는 잠시 보류하는 편이 낫습니다.',
  },
  work_meeting: {
    favorable: '회의나 약속은 역할, 조건, 다음 할 일을 짧게 정리하면 좋습니다.',
    caution: '합의가 덜 된 일에 바로 확답하지 말고 한 번 더 조율하세요.',
  },
  relationship_conflict: {
    favorable: '큰 대화보다 사실 확인과 짧은 질문으로 시작하는 편이 좋습니다.',
    caution: '서운한 마음을 결론처럼 말하면 길어질 수 있어 말을 낮춰보세요.',
  },
  energy_health: {
    favorable: '힘든 일은 짧게 나누고, 쉬는 시간을 먼저 정하면 덜 지칩니다.',
    caution: '몸을 몰아서 쓰기보다 속도를 낮추고 물, 식사, 휴식을 챙기세요.',
  },
  general: {
    favorable: '큰 계획보다 지금 끝낼 수 있는 작은 일 하나에 잘 맞습니다.',
    caution: '생각만 길어지거나 너무 서두르면 흐름이 흐트러질 수 있습니다.',
  },
};

const PUBLIC_ELEMENT_LABELS: Record<Element, string> = {
  목: '시작',
  화: '말',
  토: '정리',
  금: '선택',
  수: '생각',
};

export function formatTodayDateMarker(todayGanzi: string | null): string | null {
  // naming-policy §10 + 오늘운세 plain 티어: 본문 한자 0 · 명리어 미사용. 간지는 한글 독음으로만.
  return todayGanzi ? `오늘 하루(${toKoreanGanzi(todayGanzi)})` : null;
}

const PUBLIC_ELEMENT_COPY: Record<
  Element,
  {
    supportAction: string;
    supportShort: string;
    weakCare: string;
    strongCaution: string;
    bodyCue: string;
  }
> = {
  목: {
    supportAction: '작은 계획 하나를 바로 시작해보세요',
    supportShort: '작게 시작하세요',
    weakCare: '시작을 미루다 보면 하루가 늘어질 수 있어요',
    strongCaution: '일을 너무 많이 벌리면 마무리가 흐려질 수 있어요',
    bodyCue: '새로운 일은 크게 벌리지 말고 작게 열 때 편합니다.',
  },
  화: {
    supportAction: '짧게라도 먼저 말해보세요',
    supportShort: '짧게 말하세요',
    weakCare: '말을 너무 아끼면 오해가 길어질 수 있어요',
    strongCaution: '감정이 앞서면 말이 세게 들릴 수 있어요',
    bodyCue: '마음은 길게 설명하기보다 짧고 부드럽게 꺼낼 때 좋습니다.',
  },
  토: {
    supportAction: '돈, 일정, 할 일을 한 번 정리해보세요',
    supportShort: '먼저 정리하세요',
    weakCare: '생활 리듬이 흩어지면 판단도 같이 흔들릴 수 있어요',
    strongCaution: '붙잡는 일이 많아지면 몸과 마음이 무거워질 수 있어요',
    bodyCue: '흩어진 일을 한곳에 모아두면 하루가 훨씬 안정됩니다.',
  },
  금: {
    supportAction: '오늘 할 일 두 가지만 정해보세요',
    supportShort: '먼저 정하세요',
    weakCare: '선택할 선이 흐리면 작은 일도 오래 끌릴 수 있어요',
    strongCaution: '정답을 빨리 내리려다 말이 딱딱해질 수 있어요',
    bodyCue: '정할 것과 미룰 것을 나누면 선택이 쉬워집니다.',
  },
  수: {
    supportAction: '잠깐 멈춰서 자료와 마음을 확인해보세요',
    supportShort: '잠깐 확인하세요',
    weakCare: '생각을 정리하지 않으면 감정이 안쪽에서 커질 수 있어요',
    strongCaution: '생각이 길어지면 실행이 늦어질 수 있어요',
    bodyCue: '바로 결론내기보다 한 번 확인하면 실수가 줄어듭니다.',
  },
};

const TEN_GOD_PUBLIC_TONES: Record<string, { headline: string; body: string; caution: string }> = {
  비견: {
    headline: '혼자 해결하려는 마음이 강한 날',
    body: '혼자 다 처리하려는 힘이 먼저 올라올 수 있어요.',
    caution: '다 맡으려 하지 말고 하나는 나누세요.',
  },
  겁재: {
    headline: '가까운 사람과 선을 맞춰야 하는 날',
    body: '정 때문에 역할이나 돈의 경계가 흐려질 수 있어요.',
    caution: '부탁을 바로 받기보다 가능한 범위를 먼저 말하세요.',
  },
  식신: {
    headline: '꾸준히 만든 것이 힘이 되는 날',
    body: '새로운 자극보다 해오던 것을 이어갈 때 편해요.',
    caution: '기분 따라 루틴을 깨지 않는 편이 좋습니다.',
  },
  상관: {
    headline: '말과 아이디어가 빨라지는 날',
    body: '생각이 빠르게 튀어나와 분위기를 바꿀 수 있어요.',
    caution: '솔직함이 세게 들리지 않게 한 번 낮춰 말하세요.',
  },
  편재: {
    headline: '기회가 넓게 보이는 날',
    body: '사람, 제안, 돈의 흐름이 넓게 보일 수 있어요.',
    caution: '좋아 보여도 바로 잡기보다 조건을 먼저 확인하세요.',
  },
  정재: {
    headline: '돈과 약속을 지키기 좋은 날',
    body: '꾸준히 쌓는 일과 정해진 약속에서 안정감이 생겨요.',
    caution: '변화를 무조건 미루기보다 필요한 조정은 작게 해보세요.',
  },
  편관: {
    headline: '압박 속에서도 집중이 살아나는 날',
    body: '부담이 있어도 해야 할 일을 좁히면 힘이 납니다.',
    caution: '긴장을 오래 끌고 가지 말고 중간에 쉬어가세요.',
  },
  정관: {
    headline: '책임과 선택이 중요해지는 날',
    body: '역할을 바르게 해내려는 마음이 강해질 수 있어요.',
    caution: '완벽하게 하려다 지치지 않게 우선순위를 줄이세요.',
  },
  편인: {
    headline: '생각이 깊어지는 날',
    body: '남들이 놓친 부분을 혼자 깊게 살피기 쉬워요.',
    caution: '확인을 너무 오래 끌지 말고 멈출 선을 정하세요.',
  },
  정인: {
    headline: '도움과 배움이 편하게 들어오는 날',
    body: '혼자 버티기보다 묻고 배우면 일이 부드러워져요.',
    caution: '기다리기만 하지 말고 필요한 도움을 먼저 요청하세요.',
  },
};

const PUBLIC_TIME_BRANCH_COPY: Record<
  Branch,
  {
    label: string;
    action: string;
    caution: string;
    summary: string;
  }
> = {
  子: {
    label: '밤 생각 시간',
    action: '늦은 판단은 메모만 남기고 아침에 다시 보세요',
    caution: '밤에 커진 걱정을 그대로 결론으로 삼지 마세요',
    summary: '생각이 깊어질수록 답을 미루는 편이 안전합니다.',
  },
  丑: {
    label: '새벽 점검 시간',
    action: '돈, 약속, 준비물을 조용히 확인하세요',
    caution: '혼자 오래 붙잡으면 작은 일도 무겁게 느껴질 수 있어요',
    summary: '빠진 것을 찾아내는 감각이 살아납니다.',
  },
  寅: {
    label: '아침 준비 시간',
    action: '오늘 할 일을 두 가지로 줄여 시작하세요',
    caution: '출발부터 너무 많은 일을 잡지 마세요',
    summary: '시작의 힘은 좋지만 순서가 필요합니다.',
  },
  卯: {
    label: '아침 연락 시간',
    action: '짧은 연락이나 가벼운 시작을 먼저 해보세요',
    caution: '좋은 뜻도 길게 설명하면 부담이 될 수 있어요',
    summary: '말문을 부드럽게 여는 데 강점이 있습니다.',
  },
  辰: {
    label: '오전 정리 시간',
    action: '머릿속 일을 목록으로 나눠보세요',
    caution: '계획만 늘리다 실행이 늦어지지 않게 하세요',
    summary: '흩어진 일을 정리하면 하루가 편해집니다.',
  },
  巳: {
    label: '오전 집중 시간',
    action: '알림을 줄이고 한 가지 일에 집중하세요',
    caution: '확답과 결제는 한 번 더 확인하세요',
    summary: '집중력은 좋지만 판단이 빨라질 수 있습니다.',
  },
  午: {
    label: '대화 조율 시간',
    action: '혼자 정하기보다 한 사람과 확인해보세요',
    caution: '기분만으로 약속이나 돈을 정하지 마세요',
    summary: '사람과 맞추면 일이 더 쉽게 풀립니다.',
  },
  未: {
    label: '오후 정리 시간',
    action: '남은 일을 현실적으로 줄여보세요',
    caution: '피곤한 상태에서 새 약속을 늘리지 마세요',
    summary: '오전에 놓친 것을 수습하기 좋습니다.',
  },
  申: {
    label: '비교 확인 시간',
    action: '바로 정하지 말고 조건을 비교하세요',
    caution: '빨리 끝내고 싶은 마음이 실수를 부를 수 있어요',
    summary: '확인과 재점검에서 안정감이 생깁니다.',
  },
  酉: {
    label: '저녁 마무리 시간',
    action: '답장, 정산, 약속 확인을 깔끔하게 끝내세요',
    caution: '상대 반응을 너무 크게 해석하지 마세요',
    summary: '마무리와 정리에 힘이 붙습니다.',
  },
  戌: {
    label: '하루 정리 시간',
    action: '오늘 끝낸 것과 내일 넘길 일을 나누세요',
    caution: '피곤할 때 중요한 대화를 길게 끌지 마세요',
    summary: '새로 늘리기보다 덜어내야 편합니다.',
  },
  亥: {
    label: '밤 휴식 시간',
    action: '몸을 쉬게 하고 내일 볼 것만 적어두세요',
    caution: '늦은 고민을 오래 굴리지 마세요',
    summary: '마음 정리와 회복이 먼저입니다.',
  },
};

interface PublicTodayProfile {
  dayLabel: string;
  dominantElement: Element;
  weakestElement: Element;
  supportElement: Element;
  dominantLabel: string;
  weakestLabel: string;
  supportLabel: string;
  tenGod: string | null;
  roleHeadline: string;
  roleBody: string;
  roleCaution: string;
  strengthBody: string;
  actionShort: string;
  actionBody: string;
  balanceBody: string;
  cautionBody: string;
  hourLabel: string;
  hourAction: string;
  hourCaution: string;
  hourSummary: string;
  calendarCue: string;
  locationCue: string;
  timeRuleCue: string;
  signatureSeed: number;
  // 2026-05-15: 본문이 출생 정보 기반 고정 문자열만 이어붙던 회귀에 대응.
  // 오늘 일진(천간·지지) 관계 + dailyDelta 로 매일 다른 시그널 한 줄 제공.
  todayFlowSignal: string;
  // 오늘 일진 ganzi 라벨 (예: "辛巳"). 비어 있을 수 있음.
  todayGanzi: string;
  // 시드 의존 strength/role 변주 1문장 (매일 흐름 따라 다른 후보).
  strengthVariant: string;
  roleBodyVariant: string;
}

function clampScore(value: number) {
  return Math.max(48, Math.min(92, Math.round(value)));
}

function compactStrings(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
}

// 2026-06-04: 본문 조각 끝맺음 통일 — 종결부호가 없으면 마침표를 붙여
//   join 시 "…나눠보세요 정답을…"처럼 문장이 붙는 현상을 막는다.
function asSentence(text: string | null | undefined): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '';
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSentenceKey(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function getLastReadableChar(value: string) {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (!char) continue;
    if (/\s/.test(char)) continue;
    if (/["'“”‘’)\]}.,!?]/.test(char)) continue;
    return char;
  }

  return '';
}

function hasBatchimLike(value: string) {
  const lastChar = getLastReadableChar(value);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 !== 0;
}

function endsWithRieulBatchim(value: string) {
  const lastChar = getLastReadableChar(value);
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;

  return code % 28 === 8;
}

function withKoreanParticle(value: string, consonantParticle: string, vowelParticle: string) {
  if (consonantParticle === '으로' && vowelParticle === '로' && endsWithRieulBatchim(value)) {
    return `${value}${vowelParticle}`;
  }

  return `${value}${hasBatchimLike(value) ? consonantParticle : vowelParticle}`;
}

function polishFortuneCopy(text: string) {
  return simplifySajuCopy(text)
    .replace(/([^\s]+\s*\([^)]+\))\([^)]+\)/g, '$1')
    .replace(/([^\s]+(?:\s*\([^)]+\))?)을\(를\)/g, (_, value: string) => withKoreanParticle(value, '을', '를'))
    .replace(/([0-9]+점)로 계산되어/g, (_, value: string) => `${withKoreanParticle(value, '으로', '로')} 계산되어`)
    .replace(/\s+/g, ' ')
    .trim();
}

interface LocalDateTimeSnapshot {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface TodayTimeBlockEvaluation {
  range: string;
  timeGanzi: string;
  stem: Stem;
  branch: Branch;
  stemElement: Element;
  branchElement: Element;
  score: number;
  supportiveDelta: number;
  relationDelta: number;
  evidenceCard: ReportEvidenceCard | undefined;
  evidenceSnippet: string | null;
  actionLead: string;
  hint: string | null;
  relationSummary: string | null;
  supportSummary: string | null;
  cautionSummary: string | null;
}

function getLocalDateTimeSnapshot(
  calculatedAt: string,
  timeZone: string
): LocalDateTimeSnapshot {
  const parsed = new Date(calculatedAt);
  const sourceDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    const parts: Partial<Record<keyof LocalDateTimeSnapshot, number>> = {};

    for (const part of formatter.formatToParts(sourceDate)) {
      if (
        part.type === 'year' ||
        part.type === 'month' ||
        part.type === 'day' ||
        part.type === 'hour' ||
        part.type === 'minute'
      ) {
        parts[part.type] = Number.parseInt(part.value, 10);
      }
    }

    if (
      parts.year !== undefined &&
      parts.month !== undefined &&
      parts.day !== undefined &&
      parts.hour !== undefined &&
      parts.minute !== undefined
    ) {
      return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
      };
    }
  } catch {
    // Fall through to UTC below.
  }

  return {
    year: sourceDate.getUTCFullYear(),
    month: sourceDate.getUTCMonth() + 1,
    day: sourceDate.getUTCDate(),
    hour: sourceDate.getUTCHours(),
    minute: sourceDate.getUTCMinutes(),
  };
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function addDaysToDateParts(
  year: number,
  month: number,
  day: number,
  dayOffset: number
) {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function resolveTimeZoneOffset(baseDate: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(baseDate);
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+9';
    const normalized = offset.replace('GMT', '');
    const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return '+09:00';
    const [, sign, hours, minutes] = match;
    return `${sign}${hours.padStart(2, '0')}:${(minutes ?? '00').padStart(2, '0')}`;
  } catch {
    return '+09:00';
  }
}

// 2026-05-15: 오늘 일진(일주/월주/연주) 스냅샷. 결과의 시드·점수·dateKey 가
// 매일 다르게 흐르도록 calculatedAt + timezone 으로 오늘 ganzi 를 뽑아온다.
interface TodayPillarSnapshot {
  ganzi: string;
  stem: string;
  branch: string;
  stemElement: Element | null;
  branchElement: Element | null;
  yearGanzi: string;
  monthGanzi: string;
  dateKey: string;
}

const TODAY_STEM_ELEMENTS: Record<string, Element> = {
  '甲': '목', '乙': '목',
  '丙': '화', '丁': '화',
  '戊': '토', '己': '토',
  '庚': '금', '辛': '금',
  '壬': '수', '癸': '수',
};

const TODAY_BRANCH_ELEMENTS: Record<string, Element> = {
  '子': '수', '丑': '토', '寅': '목', '卯': '목',
  '辰': '토', '巳': '화', '午': '화', '未': '토',
  '申': '금', '酉': '금', '戌': '토', '亥': '수',
};

export function getTodayPillarSnapshot(
  sajuData: SajuDataV1 | SajuDataV2,
  options?: { now?: Date }
): TodayPillarSnapshot {
  // 2026-05-18 root cause fix (E2E saju.spec.ts:157 회귀):
  //   기존: `sajuData.metadata?.calculatedAt ?? new Date().toISOString()`
  //   문제: stored reading (saju 페이지) 의 calculatedAt = reading 생성 시점 (과거).
  //         fresh sajuData (today-fortune API) 의 calculatedAt = 지금.
  //         두 페이지가 다른 "오늘 ganzi" → 점수 불일치 (KST 자정 후 매일 fail).
  //   의도 (코멘트): "매일 다르게 흐르도록 오늘 ganzi". calculatedAt 이 아닌 실제 오늘이 원칙.
  //   대운/세운/월운 산출은 별도 함수에서 sajuData.metadata.calculatedAt 을 그대로 사용 — 영향 없음.
  //
  //   options.now 는 테스트 전용: 다른 "오늘" 시뮬레이션 시 fixed Date 주입.
  //   production 호출자는 now 없이 호출 → 항상 실제 오늘.
  const calculatedAt = (options?.now ?? new Date()).toISOString();
  const timezone = sajuData.input?.timezone ?? 'Asia/Seoul';
  const local = getLocalDateTimeSnapshot(calculatedAt, timezone);
  try {
    const solar = Solar.fromYmdHms(local.year, local.month, local.day, 0, 0, 0);
    const eightChar = solar.getLunar().getEightChar();
    const dayGanzi = eightChar.getDay();
    const stem = dayGanzi.charAt(0) ?? '';
    const branch = dayGanzi.charAt(1) ?? '';
    return {
      ganzi: dayGanzi,
      stem,
      branch,
      stemElement: TODAY_STEM_ELEMENTS[stem] ?? null,
      branchElement: TODAY_BRANCH_ELEMENTS[branch] ?? null,
      yearGanzi: eightChar.getYear(),
      monthGanzi: eightChar.getMonth(),
      dateKey: `${local.year}-${pad2(local.month)}-${pad2(local.day)}`,
    };
  } catch {
    return {
      ganzi: '',
      stem: '',
      branch: '',
      stemElement: null,
      branchElement: null,
      yearGanzi: '',
      monthGanzi: '',
      dateKey: `${local.year}-${pad2(local.month)}-${pad2(local.day)}`,
    };
  }
}

// 오늘 일주 천간/지지 오행 vs 나의 일간 오행 관계로 점수 ±delta 산출.
// - 같음(비겁/인성 일부): +6
// - 인성(today 가 나를 生): +5
// - 식상(나 → today 생, 설기): -1
// - 관살(today → 나 극): -6
// - 재성(나 → today 극, 소모): -2
// 천간 / 지지 각각 평가 후 (stem*0.6 + branch*0.4) 가중합.
function calculateTodayElementDelta(
  myDayMasterElement: Element,
  todayElement: Element | null
): number {
  if (!todayElement) return 0;
  if (todayElement === myDayMasterElement) return 6;
  if (GENERATOR_OF_MAP[myDayMasterElement] === todayElement) return 5;
  if (GENERATED_BY_MAP[myDayMasterElement] === todayElement) return -1;
  if (CONTROLLER_OF_MAP[myDayMasterElement] === todayElement) return -6;
  if (CONTROLLER_OF_MAP[todayElement] === myDayMasterElement) return -2;
  return 0;
}

export function buildDailyDelta(
  todayPillar: TodayPillarSnapshot,
  sajuData: SajuDataV1 | SajuDataV2
): number {
  const myEl = sajuData.dayMaster?.element ?? null;
  if (!myEl) return 0;
  const stemDelta = calculateTodayElementDelta(myEl, todayPillar.stemElement);
  const branchDelta = calculateTodayElementDelta(myEl, todayPillar.branchElement);
  return Math.round(stemDelta * 0.6 + branchDelta * 0.4);
}

// 오늘 일진 vs 내 일간 관계를 사람이 읽는 한 줄로 변환.
// dailyDelta 단순 부호가 아니라 element 종류와 관계 (인성/관살/식상/재성/같음) 별 카피.
type TodayFlowTone = 'same' | 'support' | 'release' | 'press' | 'tidy';

// 천간(겉)/지지(바탕) 각각의 오늘 일진 vs 내 일간 관계 톤.
function resolveTodayFlowTone(myEl: Element, todayEl: Element | null): TodayFlowTone | null {
  if (!todayEl) return null;
  if (todayEl === myEl) return 'same';
  if (GENERATOR_OF_MAP[myEl] === todayEl) return 'support';
  if (GENERATED_BY_MAP[myEl] === todayEl) return 'release';
  if (CONTROLLER_OF_MAP[myEl] === todayEl) return 'press';
  if (CONTROLLER_OF_MAP[todayEl] === myEl) return 'tidy';
  return null;
}

// 2026-06-04: 천간/지지를 각각 "오늘은 ~날입니다" 두 문장으로 내보내면
//   "나를 누르는 흐름" + "나를 받쳐주는 흐름"처럼 상충이 한 문단에 나열됐다.
//   겉(천간)·바탕(지지)을 한 문장으로 통합 서술한다(naming-policy: 한자/명리어/"결" 0).
export function buildTodayFlowSignal(
  todayPillar: TodayPillarSnapshot,
  sajuData: SajuDataV1 | SajuDataV2
): string {
  const myEl = sajuData.dayMaster?.element;
  if (!myEl || (!todayPillar.stemElement && !todayPillar.branchElement)) {
    return '';
  }

  // 2026-06-28 — 같은 오행 톤이라도 날짜(일진 ganzi)마다 표현이 달라지도록 변형군 + 결정론적 선택.
  //   같은 날은 항상 같은 문장(새로고침 안정), 일진이 바뀌면 문장도 바뀜. (한자/명리어/예측 0 유지)
  const fullPhrases: Record<TodayFlowTone, readonly string[]> = {
    same: [
      '내 성향과 잘 맞아 자기 페이스를 지키기 좋은',
      '나와 비슷해 무리 없이 흘러가는',
      '내 페이스대로 움직이기 편한',
    ],
    support: [
      '나를 받쳐줘 회복과 정리에 힘이 실리는',
      '뒤에서 힘을 보태줘 차분히 채우기 좋은',
      '나를 도와줘 쉬어가며 정돈하기 좋은',
    ],
    release: [
      '내 에너지를 밖으로 풀어내 표현은 잘 되지만 소모도 있는',
      '에너지를 바깥으로 내보내 활동은 늘지만 지치기 쉬운',
      '나를 드러내기 좋지만 그만큼 힘이 빠지는',
    ],
    press: [
      '나를 눌러 결정이 무겁고 마찰이 생기기 쉬운',
      '부담이 더해져 속도가 더디고 마찰이 생기기 쉬운',
      '신중함이 필요해 한 박자 천천히 가는 편이 나은',
    ],
    tidy: [
      '잔손이 많이 가 작은 정리에 품이 드는',
      '자잘한 일이 늘어 정리에 손이 가는',
      '소소한 정리가 쌓여 손이 자주 가는',
    ],
  };
  const shortPhrases: Record<TodayFlowTone, readonly string[]> = {
    same: ['나와 잘 맞는', '내 성향과 통하는', '나와 같은'],
    support: ['나를 받쳐주는', '나에게 힘을 보태는', '나를 도와주는'],
    release: ['에너지를 밖으로 풀어내는', '에너지를 바깥으로 내보내는', '나를 드러내게 하는'],
    press: ['나를 누르는', '나에게 부담을 주는', '나를 조이는'],
    tidy: ['잔손이 가는', '자잘한 정리가 필요한', '손이 자주 가는'],
  };

  // 일진 ganzi 기반 결정론 seed: 같은 날 고정, 날마다(일진 변동 시) 달라짐.
  const seedBase = todayPillar.ganzi || `${todayPillar.stem}${todayPillar.branch}`;
  let seed = 0;
  for (let i = 0; i < seedBase.length; i += 1) seed = (seed * 31 + seedBase.charCodeAt(i)) >>> 0;
  const pick = (arr: readonly string[], salt: number) => arr[(seed + salt) % arr.length];

  const stemTone = resolveTodayFlowTone(myEl, todayPillar.stemElement);
  const branchTone = resolveTodayFlowTone(myEl, todayPillar.branchElement);

  if (stemTone && branchTone) {
    if (stemTone === branchTone) {
      const f = pick(fullPhrases[stemTone], 0);
      const sameTemplates = [
        `오늘은 안팎으로 ${f} 흐름이 함께 도는 날입니다.`,
        `오늘은 겉과 속이 모두 ${f} 흐름으로 도는 하루예요.`,
        `오늘은 위아래로 ${f} 흐름이 한 방향으로 도는 날입니다.`,
      ];
      return sameTemplates[seed % sameTemplates.length];
    }
    const a = pick(shortPhrases[stemTone], 0);
    const b = pick(shortPhrases[branchTone], 5);
    const mixTemplates = [
      `오늘은 겉으로는 ${a} 흐름이, 바탕에서는 ${b} 흐름이 함께 도는 날이라, 한쪽에 치우치지 말고 흐름을 살피며 움직이면 좋습니다.`,
      `오늘은 드러나는 쪽은 ${a} 흐름, 안쪽은 ${b} 흐름이 같이 도는 하루예요. 한쪽만 보지 말고 균형을 잡아보세요.`,
      `겉으로는 ${a} 흐름이 보이지만 바탕에는 ${b} 흐름이 깔려 있는 하루라, 둘 다 염두에 두고 움직이면 좋습니다.`,
    ];
    return mixTemplates[seed % mixTemplates.length];
  }

  const single = stemTone ?? branchTone;
  if (!single) return '';
  const f = pick(fullPhrases[single], 0);
  const singleTemplates = [
    `오늘은 ${f} 흐름이 도는 날입니다.`,
    `오늘은 ${f} 흐름이 하루를 이끄는 날이에요.`,
  ];
  return singleTemplates[seed % singleTemplates.length];
}

function pickStrengthVariant(level: string | null | undefined, seed: number): string {
  const variants: Record<'신강' | '신약' | '중화', string[]> = {
    신강: [
      '내가 먼저 끌고 가려는 힘이 강해지는 편입니다.',
      '주도권을 잡고 움직이는 힘이 살아 있어 결정이 빨라지기 쉬워요.',
      '내 페이스로 끌고 가는 힘이 강해 무리하지 않게 호흡을 길게 가져가는 편이 좋아요.',
    ],
    신약: [
      '주변 분위기와 컨디션에 영향을 받기 쉬운 편입니다.',
      '주변 흐름과 사람 분위기에 휘청이기 쉬운 편이라 자기 페이스를 먼저 정해두면 편해져요.',
      '주변 신호에 민감해질 수 있어 정보와 일정을 단순화하는 편이 좋아요.',
    ],
    중화: [
      '상황을 보고 맞추는 감각이 살아 있는 편입니다.',
      '한쪽으로 치우치지 않아 조율과 중재가 잘 되는 감각이 살아 있어요.',
      '균형을 보며 움직이는 감각이 살아 있어 작은 분기마다 한 박자 쉬어가면 더 정돈됩니다.',
    ],
  };
  const key = (level === '신강' || level === '신약' || level === '중화') ? level : '중화';
  return pickVariant(variants[key], seed, 5);
}

function pickRoleBodyVariant(
  baseRoleBody: string,
  dayLabel: string,
  seed: number
): string {
  const extras = [
    baseRoleBody,
    `${dayLabel} 감각이 먼저 반응하는 흐름이에요.`,
    `${dayLabel} 쪽이 첫 신호로 올라오는 흐름이에요.`,
  ];
  return pickVariant(extras, seed, 9);
}

function sortBranchKey(left: Branch, right: Branch) {
  return [left, right]
    .sort((a, b) => BRANCH_ORDER.indexOf(a) - BRANCH_ORDER.indexOf(b))
    .join('-');
}

function generatedByElement(element: Element) {
  return GENERATED_BY_MAP[element];
}

function generatorOfElement(element: Element) {
  return GENERATOR_OF_MAP[element];
}

function controllerOfElement(element: Element) {
  return CONTROLLER_OF_MAP[element];
}

function joinUniqueSentences(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const sentences: string[] = [];

  for (const part of compactStrings(parts)) {
    for (const sentence of splitSentences(simplifySajuCopy(part))) {
      const key = normalizeSentenceKey(sentence);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sentences.push(sentence);
    }
  }

  return sentences.join(' ');
}

function uniqueStrings(parts: Array<string | null | undefined>, limit?: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of compactStrings(parts)) {
    const readablePart = simplifySajuCopy(part);
    if (!readablePart || seen.has(readablePart)) continue;
    seen.add(readablePart);
    result.push(readablePart);
    if (limit && result.length >= limit) break;
  }

  return result;
}

function compactActionDescription(
  description: string,
  evidenceSnippet: string | null
) {
  const withoutScorePrefix = description.replace(/^[^.!?]+점 정보입니다\.\s*/, '').trim();
  const withoutEvidence = evidenceSnippet
    ? withoutScorePrefix.replace(evidenceSnippet, '').trim()
    : withoutScorePrefix;

  return joinUniqueSentences([withoutEvidence]);
}

function getScore(report: SajuReport, key: ReportScore['key']) {
  return report.scores.find((item) => item.key === key);
}

export function buildConditionScore(
  todayReport: SajuReport,
  loveReport: SajuReport,
  wealthReport: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2
) {
  const overall = getScore(todayReport, 'overall')?.score ?? 70;
  const love = getScore(loveReport, 'love')?.score ?? overall;
  const wealth = getScore(wealthReport, 'wealth')?.score ?? overall;
  const dominantCount = sajuData.fiveElements.byElement[sajuData.fiveElements.dominant]?.count ?? 0;
  const weakestCount = sajuData.fiveElements.byElement[sajuData.fiveElements.weakest]?.count ?? 0;
  const balancePenalty = Math.max(0, dominantCount - weakestCount) * 2;
  const strengthAdjust =
    sajuData.strength?.level === '신약' ? -4 : sajuData.strength?.level === '신강' ? 2 : 0;

  return clampScore((overall + love + wealth) / 3 - balancePenalty + strengthAdjust);
}

function buildKasiSummary(kasiComparison: KasiSingleInputComparison | null | undefined) {
  if (!kasiComparison) {
    return {
      available: false,
      ok: true,
      summary: '역법 대조 정보는 아직 함께 저장되지 않았습니다.',
    };
  }

  const lunarDate = `${kasiComparison.kasi.lunYear}.${kasiComparison.kasi.lunMonth}.${kasiComparison.kasi.lunDay}${kasiComparison.kasi.lunLeapmonth === '윤' ? ' 윤달' : ''}`;
  if (kasiComparison.issues.length === 0) {
    return {
      available: true,
      ok: true,
      summary: `공식 달력 정보와 대조했을 때 음력일과 하루 흐름이 일치합니다. 음력일은 ${lunarDate}, 하루 흐름은 ${kasiComparison.kasi.lunIljin ?? '미제공'}입니다.`,
    };
  }

  const issueSummary = kasiComparison.issues
    .slice(0, 2)
    .map((issue) => `${issue.field} 차이`)
    .join(', ');

  return {
    available: true,
    ok: false,
    summary: `공식 달력 대조에서 ${issueSummary}가 확인됐습니다. 음력일은 ${lunarDate}, 하루 흐름은 ${kasiComparison.kasi.lunIljin ?? '미제공'}입니다.`,
  };
}

function buildTodayGroundingSummary(
  grounding: SajuInterpretationGrounding | null | undefined,
  kasiComparison: KasiSingleInputComparison | null | undefined,
  focusReport: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2
) {
  const evidenceCards =
    focusReport.focusTopic === 'today'
      ? grounding?.evidenceJson.classics.cards ?? focusReport.evidenceCards
      : focusReport.evidenceCards;
  const primaryConcept = simplifySajuCopy(
    focusReport.evidenceCards[0]?.label ?? grounding?.evidenceJson.primaryConcept ?? '보완 힌트'
  );
  const strengthLine =
    grounding?.evidenceJson.strength.level && grounding?.evidenceJson.strength.score !== null
      ? `기운의 균형 ${grounding.evidenceJson.strength.level}`
      : `기운의 균형 ${sajuData.strength?.level ?? '정리 중'}`;
  const patternLine =
    grounding?.evidenceJson.pattern.name
      ? `역할 흐름 ${grounding.evidenceJson.pattern.name}${grounding.evidenceJson.pattern.tenGod ? ` · ${grounding.evidenceJson.pattern.tenGod}` : ''}`
      : `역할 흐름 ${sajuData.pattern?.name ?? '정리 중'}`;
  const yongsinLine =
    grounding?.evidenceJson.yongsin.primary
      ? `보완 힌트 ${grounding.evidenceJson.yongsin.primary}${grounding.evidenceJson.yongsin.support.length > 0 ? ` · 보조 ${grounding.evidenceJson.yongsin.support.join(' · ')}` : ''}`
      : `보완 힌트 ${sajuData.yongsin?.primary?.label ?? '정리 중'}`;
  const luckLine = grounding?.evidenceJson.luckFlow.currentMajorLuck
    ? `현재 큰 흐름 ${grounding.evidenceJson.luckFlow.currentMajorLuck}`
    : grounding?.evidenceJson.luckFlow.saewoon
      ? `올해 흐름 ${grounding.evidenceJson.luckFlow.saewoon}`
      : `현재 흐름 ${sajuData.currentLuck?.saewoon?.ganzi ?? '정리 중'}`;

  return {
    primaryConcept,
    factLines: [
      `나를 나타내는 기운 ${sajuData.dayMaster.stem}${sajuData.dayMaster.element ? ` · ${sajuData.dayMaster.element}` : ''}`,
      strengthLine,
      patternLine,
      yongsinLine,
      luckLine,
    ],
    evidenceLines: evidenceCards
      .slice(0, 3)
      .map((card) => polishFortuneCopy(`${card.label} · ${card.plainSummary || card.title}`)),
    kasi: buildKasiSummary(kasiComparison),
  };
}

function normalizeElement(value: string | null | undefined): Element | null {
  const matched = value?.match(/[목화토금수]/u)?.[0] as Element | undefined;
  return matched ?? null;
}

function getPrimarySupportElement(sajuData: SajuDataV1 | SajuDataV2) {
  return normalizeElement(sajuData.yongsin?.primary?.value ?? sajuData.yongsin?.primary?.label);
}

function buildSignatureSeed(
  input: BirthInput,
  sajuData: SajuDataV1 | SajuDataV2,
  options: Pick<TodayFortuneBuildOptions, 'calendarType' | 'timeRule'>,
  todayPillar: TodayPillarSnapshot
) {
  const locationSeed = input.birthLocation
    ? Math.round(Math.abs(input.birthLocation.latitude * 10) + Math.abs(input.birthLocation.longitude * 10))
    : 0;
  const ganziSeed = Array.from(
    `${sajuData.pillars.day.ganzi}${sajuData.pillars.hour?.ganzi ?? ''}`
  ).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const calendarSeed = options.calendarType === 'lunar' ? 19 : 0;
  const timeRuleSeed =
    options.timeRule === 'trueSolarTime'
      ? 29
      : options.timeRule === 'earlyZi'
        ? 17
        : options.timeRule === 'nightZi'
          ? 11
          : 0;
  // 2026-05-15: 매일 다른 카피가 뽑히도록 오늘 일진(일주/월주) ganzi 와 dateKey 를 시드에 mixin.
  // 가중치 31 을 곱해 base 시드 대비 충분히 분포가 흔들리도록 함.
  const todayGanziSeed = Array.from(`${todayPillar.ganzi}${todayPillar.monthGanzi}`)
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const dateKeySeed = Array.from(todayPillar.dateKey).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );

  return (
    input.year * 3 +
    input.month * 11 +
    input.day * 17 +
    (input.hour ?? 6) * 23 +
    (input.minute ?? 0) +
    locationSeed +
    ganziSeed +
    calendarSeed +
    timeRuleSeed +
    todayGanziSeed * 31 +
    dateKeySeed * 7
  );
}

function pickVariant<T>(items: T[], seed: number, offset = 0) {
  return items[Math.abs(seed + offset) % items.length];
}

function buildCalendarCue(calendarType: TodayCalendarType) {
  return calendarType === 'lunar'
    ? '음력 생일은 양력 날짜로 바꿔 오늘 흐름에 맞춰 봤어요.'
    : '양력 생일로 오늘 흐름을 봤어요.';
}

function buildTimeRuleCue(input: BirthInput, timeRule: TodayTimeRule) {
  if (input.unknownTime) return '태어난 시간이 없어 하루 전체 흐름 중심으로 봤어요.';
  if (timeRule === 'trueSolarTime' && input.birthLocation) {
    return `${input.birthLocation.label}의 위치를 반영해 시간을 더 좁혀 봤어요.`;
  }
  if (timeRule === 'earlyZi') return '자시를 이른 밤 방식으로 나눠 봤어요.';
  if (timeRule === 'nightZi') return '늦은 밤 자시를 한 흐름으로 묶어 봤어요.';
  return '표준시 정보로 태어난 시간을 반영했어요.';
}

function buildLocationCue(input: BirthInput) {
  if (!input.birthLocation) return '출생지는 비어 있어 시간 해석은 넓게만 봤어요.';
  if (input.solarTimeMode === 'longitude') {
    return `${input.birthLocation.label} 출생지 보정까지 함께 봤어요.`;
  }
  return `${input.birthLocation.label} 출생 정보까지 함께 두고 봤어요.`;
}

function buildPublicTodayProfile(
  input: BirthInput,
  sajuData: SajuDataV1 | SajuDataV2,
  options: Pick<TodayFortuneBuildOptions, 'calendarType' | 'timeRule'>,
  todayPillar: TodayPillarSnapshot
): PublicTodayProfile {
  const dominantElement = sajuData.fiveElements.dominant;
  const weakestElement = sajuData.fiveElements.weakest;
  const supportElement = getPrimarySupportElement(sajuData) ?? weakestElement;
  const tenGod = sajuData.pattern?.tenGod ?? sajuData.tenGods?.dominant ?? null;
  const roleTone = tenGod ? TEN_GOD_PUBLIC_TONES[tenGod] : null;
  const signatureSeed = buildSignatureSeed(input, sajuData, options, todayPillar);
  const dayLabel = PUBLIC_ELEMENT_LABELS[sajuData.dayMaster.element];
  const supportCopy = PUBLIC_ELEMENT_COPY[supportElement];
  const dominantCopy = PUBLIC_ELEMENT_COPY[dominantElement];
  const weakestCopy = PUBLIC_ELEMENT_COPY[weakestElement];
  const hourBranch = sajuData.pillars.hour?.branch ?? null;
  const hourCopy = hourBranch
    ? PUBLIC_TIME_BRANCH_COPY[hourBranch]
    : {
        label: '전체 흐름형',
        action: '오늘은 시간보다 하루 전체 리듬을 먼저 보세요',
        caution: '세부 시간에 맞추려 하기보다 무리한 선택을 줄이세요',
        summary: '태어난 시간이 없어 하루 전체 흐름으로 넓게 봅니다.',
      };
  const strengthBody =
    sajuData.strength?.level === '신강'
      ? '내가 먼저 끌고 가려는 힘이 강해지는 편입니다.'
      : sajuData.strength?.level === '신약'
        ? '주변 분위기와 컨디션에 영향을 받기 쉬운 편입니다.'
        : '상황을 보고 맞추는 감각이 살아 있는 편입니다.';

  const baseRoleBody = roleTone?.body ?? `${dayLabel} 쪽 성향이 오늘 선택의 첫 반응으로 올라옵니다.`;

  return {
    dayLabel,
    dominantElement,
    weakestElement,
    supportElement,
    dominantLabel: PUBLIC_ELEMENT_LABELS[dominantElement],
    weakestLabel: PUBLIC_ELEMENT_LABELS[weakestElement],
    supportLabel: PUBLIC_ELEMENT_LABELS[supportElement],
    tenGod,
    roleHeadline: roleTone?.headline ?? `${dayLabel} 감각이 먼저 드러나는 날`,
    roleBody: baseRoleBody,
    roleCaution: roleTone?.caution ?? supportCopy.weakCare,
    strengthBody,
    actionShort: supportCopy.supportShort,
    actionBody: supportCopy.supportAction,
    balanceBody: `${dominantCopy.bodyCue} ${supportCopy.bodyCue}`,
    cautionBody:
      dominantElement === weakestElement
        ? asSentence(supportCopy.weakCare)
        : `${asSentence(dominantCopy.strongCaution)} ${asSentence(weakestCopy.weakCare)}`,
    hourLabel: hourCopy.label,
    hourAction: hourCopy.action,
    hourCaution: hourCopy.caution,
    hourSummary: hourCopy.summary,
    calendarCue: buildCalendarCue(options.calendarType),
    locationCue: buildLocationCue(input),
    timeRuleCue: buildTimeRuleCue(input, options.timeRule),
    signatureSeed,
    // 2026-05-15: 본문에 매일 다른 흐름을 주입하기 위한 새 필드들.
    todayFlowSignal: buildTodayFlowSignal(todayPillar, sajuData),
    todayGanzi: todayPillar.ganzi,
    strengthVariant: pickStrengthVariant(sajuData.strength?.level, signatureSeed),
    roleBodyVariant: pickRoleBodyVariant(baseRoleBody, dayLabel, signatureSeed),
  };
}

function buildPublicTodayHeadline(
  concernId: ConcernId,
  profile: PublicTodayProfile
) {
  switch (concernId) {
    case 'love_contact':
      return `마음은 ${profile.actionShort.replace('하세요', '하면')} 편해지는 날`;
    case 'money_spend':
      return `돈은 새로 쓰기보다 ${profile.actionShort.replace('하세요', '할')} 날`;
    case 'work_meeting':
      return `일은 ${profile.actionShort.replace('하세요', '할')} 때 풀리는 날`;
    case 'relationship_conflict':
      return `관계는 말보다 순서를 먼저 볼 날`;
    case 'energy_health':
      return `몸과 마음은 무리보다 회복이 먼저인 날`;
    case 'general':
    default:
      return pickVariant(
        [
          `${profile.roleHeadline}, ${profile.actionShort}`,
          `${profile.hourLabel}이라 ${withKoreanParticle(profile.supportLabel, '을', '를')} 챙기면 좋은 날`,
          `${withKoreanParticle(profile.dominantLabel, '이', '가')} 먼저 나오고 ${withKoreanParticle(profile.weakestLabel, '을', '를')} 놓치기 쉬운 날`,
        ],
        profile.signatureSeed
      );
  }
}

// 2026-05-15: concern 별 본문 한 줄도 매일 다른 후보가 뽑히도록 3 variant 화.
const CONCERN_BODY_VARIANTS: Record<ConcernId, string[]> = {
  love_contact: [
    '오늘은 마음을 크게 확인하기보다 상대가 답하기 쉬운 한마디가 더 좋습니다.',
    '오늘은 진심을 길게 풀어내기보다 짧고 가벼운 안부가 거리감을 줄여줍니다.',
    '오늘은 답을 재촉하기보다 상대의 호흡에 맞춰 한 박자 늦게 말하는 편이 좋아요.',
  ],
  money_spend: [
    '오늘은 새 결제보다 이미 나갈 돈과 약속된 금액을 먼저 보는 쪽이 낫습니다.',
    '오늘은 새로운 지출보다 자동결제·정기지출 점검 하나가 더 큰 차이를 만듭니다.',
    '오늘은 즉흥 구매보다 영수증과 다음 주 일정의 돈 흐름을 한 번 정리해두면 든든해져요.',
  ],
  work_meeting: [
    '오늘은 결론을 빨리 내기보다 역할, 일정, 조건을 짧게 맞추는 편이 좋습니다.',
    '오늘은 결정 한 방보다 누가 무엇을 언제까지 할지 짧게 적어두는 쪽이 더 멀리 갑니다.',
    '오늘은 길게 회의하기보다 핵심 1줄 + 다음 액션 1줄 만 합의해도 충분합니다.',
  ],
  relationship_conflict: [
    '오늘은 맞고 틀림을 가르기보다 오해가 커지지 않게 말의 순서를 낮추는 편이 좋습니다.',
    '오늘은 누가 잘못했는지 따지기보다 어디서 신호가 어긋났는지 한 번 확인해보세요.',
    '오늘은 즉답보다 한 박자 늦은 답장이 관계를 더 부드럽게 만듭니다.',
  ],
  energy_health: [
    '오늘은 몰아서 버티기보다 쉬는 구간을 먼저 잡아야 오래 갑니다.',
    '오늘은 일정 사이에 짧은 휴식 한 토막을 끼워 넣으면 컨디션이 무너지지 않아요.',
    '오늘은 무리한 운동·약속보다 수면·식사·물 한 잔의 기본 리듬을 챙기는 편이 좋아요.',
  ],
  general: [
    '오늘은 큰 결정보다 지금 바로 정리할 수 있는 작은 일 하나가 하루를 바꿉니다.',
    '오늘은 큰 그림을 다시 그리기보다 책상·일정·메모 중 하나만 정돈해도 흐름이 풀립니다.',
    '오늘은 새로 시작하는 일보다 미뤄둔 한 가지를 마무리하는 쪽이 더 가볍게 끝나요.',
  ],
};

function pickConcernBodyVariant(concernId: ConcernId, seed: number): string {
  const variants = CONCERN_BODY_VARIANTS[concernId] ?? CONCERN_BODY_VARIANTS.general;
  return pickVariant(variants, seed, 13);
}

function buildPublicTodayBody(
  concernId: ConcernId,
  profile: PublicTodayProfile,
  unknownBirthTime: boolean
) {
  // 2026-06-04: 조각 무맥락 나열 → 구조화(흐름 → 성향 → 핵심 포인트 → 조언 → 주의 → 마무리).
  //   - flowSignal 은 천간/지지 통합 1문장(상충 제거, buildTodayFlowSignal)
  //   - 성향은 strengthVariant 하나로(roleBodyVariant 와 중복이라 제거)
  //   - actionBody 의 "오늘은" 접두 제거(반복 완화), 각 조각 asSentence 로 끝맺음 통일
  const concernLine = pickConcernBodyVariant(concernId, profile.signatureSeed);
  const flowSignal = profile.todayFlowSignal;
  const todayDateMarker = formatTodayDateMarker(profile.todayGanzi);

  return joinUniqueSentences([
    // 1) 오늘 흐름 — 겉·바탕 통합 종합
    asSentence(flowSignal) || null,
    // 2) 내 성향 — 강약 변주 한 줄
    asSentence(profile.strengthVariant || profile.strengthBody),
    // 3) 오늘 핵심 포인트 — 고민별
    asSentence(concernLine),
    // 4) 행동 조언 — 먼저 할 일 + 시간대 행동
    asSentence(profile.actionBody),
    asSentence(profile.hourAction),
    // 5) 오늘 주의 — 끝맺음 통일된 cautionBody
    asSentence(profile.cautionBody),
    // 6) 마무리 흐름 + 기준 안내
    asSentence(profile.hourSummary),
    asSentence(profile.calendarCue),
    todayDateMarker ? `${todayDateMarker}로 본 흐름입니다.` : null,
    unknownBirthTime ? '태어난 시간이 정확하지 않아 시간대 해석은 넓게만 봅니다.' : null,
  ]);
}

function buildPublicReasonBody(profile: PublicTodayProfile, unknownBirthTime: boolean) {
  return joinUniqueSentences(
    pickVariant(
      [
        [
          `${profile.roleHeadline}입니다.`,
          `${profile.dominantLabel} 쪽 반응이 먼저 나오고, ${profile.weakestLabel} 쪽은 놓치기 쉬워요.`,
          `그래서 오늘은 ${profile.actionBody}.`,
          profile.roleCaution,
        ],
        [
          `${withKoreanParticle(profile.hourLabel, '으로', '로')} 봅니다.`,
          profile.hourSummary,
          `오늘 먼저 할 일은 ${profile.hourAction}.`,
          profile.hourCaution,
        ],
        [
          `${withKoreanParticle(profile.supportLabel, '을', '를')} 챙기는 날입니다.`,
          profile.locationCue,
          profile.timeRuleCue,
          `오늘은 ${profile.actionBody}.`,
        ],
      ],
      profile.signatureSeed,
      3
    ).concat(
      unknownBirthTime ? ['태어난 시간이 없으면 세부 시간보다 하루 전체 흐름을 중심으로 보세요.'] : []
    )
  );
}

function buildPublicGroundingSummary(
  profile: PublicTodayProfile,
  kasiComparison: KasiSingleInputComparison | null | undefined
) {
  return {
    primaryConcept: `${profile.supportLabel} 챙기기`,
    factLines: [
      `내 기본 반응: ${profile.dayLabel}`,
      `강하게 나오는 쪽: ${profile.dominantLabel}`,
      `오늘 챙길 쪽: ${profile.supportLabel}`,
      `시간 리듬: ${profile.hourLabel}`,
    ],
    evidenceLines: [
      profile.roleBody,
      `${withKoreanParticle(profile.weakestLabel, '이', '가')} 부족해질 때는 ${PUBLIC_ELEMENT_COPY[profile.weakestElement].weakCare}`,
    ],
    kasi: {
      available: Boolean(kasiComparison),
      ok: !kasiComparison || kasiComparison.issues.length === 0,
      summary: kasiComparison && kasiComparison.issues.length > 0
        ? '달력 확인은 일부 확인이 필요합니다.'
        : '달력 확인 확인 완료',
    },
  };
}

function getAxisElement(key: TodayScoreItem['key'], profile: PublicTodayProfile) {
  switch (key) {
    case 'overall':
      return profile.supportElement;
    case 'love':
      return profile.supportElement === '화' ? '화' : profile.weakestElement;
    case 'wealth':
      return profile.dominantElement === '토' || profile.dominantElement === '금'
        ? profile.dominantElement
        : profile.supportElement;
    case 'career':
      return profile.dominantElement;
    case 'relationship':
      return profile.weakestElement;
    case 'condition':
    default:
      return profile.weakestElement;
  }
}

function buildAxisScoreSummary(
  key: TodayScoreItem['key'],
  score: number,
  profile: PublicTodayProfile
) {
  const element = getAxisElement(key, profile);
  const label = PUBLIC_ELEMENT_LABELS[element];
  const copy = PUBLIC_ELEMENT_COPY[element];
  const band = score >= 78 ? 'high' : score >= 68 ? 'mid' : 'low';

  if (key === 'overall') {
    return pickVariant(
      band === 'high'
        ? [
            `${profile.roleHeadline}이라 ${copy.supportShort.replace('하세요', '하면')} 하루가 빨리 열립니다.`,
            `${profile.hourLabel} 리듬이 살아 있어 ${profile.hourAction}.`,
          ]
        : band === 'mid'
          ? [
              `${withKoreanParticle(label, '을', '를')} 챙기면 하루가 안정됩니다. ${copy.supportAction}.`,
              `${profile.hourLabel}이라 ${profile.hourAction}.`,
            ]
          : [
              `${withKoreanParticle(label, '을', '를')} 놓치기 쉬워요. 오늘은 속도를 낮추고 ${copy.supportShort}.`,
              `${profile.hourCaution}. 먼저 ${copy.supportShort}.`,
            ],
      profile.signatureSeed,
      5
    );
  }

  if (key === 'love') {
    return band === 'high'
      ? '마음을 어렵게 설명하기보다 짧고 부드럽게 꺼내면 좋습니다.'
      : band === 'mid'
        ? '마음을 짧고 부드럽게 말하면 감정이 덜 엉킵니다. 답을 재촉하지 마세요.'
        : '오늘은 확인보다 여백이 필요합니다. 말의 양을 줄이면 편해요.';
  }

  if (key === 'wealth') {
    return band === 'high'
      ? `${label} 감각이 살아 있어 작은 기회를 정리하기 좋습니다.`
      : band === 'mid'
        ? '새로 쓰기보다 이미 나갈 돈과 구독, 약속된 금액을 확인하세요.'
        : '즉흥 결제는 미루고 필요한 것만 남기는 편이 안전합니다.';
  }

  if (key === 'career') {
    return band === 'high'
      ? `${label} 쪽 강점이 일에서 보입니다. 결론을 먼저 말하면 전달이 쉽습니다.`
      : band === 'mid'
        ? '할 일을 넓히기보다 맡은 범위와 마감부터 분명히 하세요.'
        : '새 일을 더 받기보다 이미 맡은 일을 끝까지 정리하는 편이 좋습니다.';
  }

  if (key === 'relationship') {
    return band === 'high'
      ? '짧은 안부나 확인처럼 가벼운 말이 관계를 편하게 만듭니다.'
      : band === 'mid'
        ? '말이 부족하면 오해가 커질 수 있어요. 사실과 기분을 나눠 말하세요.'
        : '서운함을 결론처럼 말하지 말고 한 번 더 확인하는 편이 안전합니다.';
  }

  return pickVariant(
    band === 'high'
      ? [
          '몸이 가볍게 따라오는 편입니다. 그래도 쉬는 시간을 끼워 넣으세요.',
          `${profile.hourLabel} 리듬을 살려 짧게 집중하고 쉬어가세요.`,
        ]
      : band === 'mid'
        ? [
            `${withKoreanParticle(label, '이', '가')} 부족해지면 쉽게 지칠 수 있어요. 중간 휴식을 먼저 잡으세요.`,
            `${profile.hourCaution}. 물, 식사, 쉬는 시간을 먼저 챙기세요.`,
          ]
        : [
            '무리해서 버티기보다 일정 하나를 줄이는 편이 낫습니다.',
            `${profile.hourLabel}이라 회복 구간을 먼저 비워두세요.`,
          ],
    profile.signatureSeed,
    11
  );
}

function buildPublicOpportunity(
  concernId: ConcernId,
  profile: PublicTodayProfile
) {
  const staticCopy = FREE_RESULT_GUIDE_COPY[concernId];
  if (concernId !== 'general') {
    return {
      title: staticCopy.opportunityTitle,
      body: joinUniqueSentences([
        staticCopy.opportunityBody,
        `${withKoreanParticle(profile.supportLabel, '을', '를')} 챙기려면 ${profile.actionBody}.`,
        profile.hourAction,
      ]),
    };
  }

  return pickVariant(
    [
      {
        title: `${withKoreanParticle(profile.supportLabel, '을', '를')} 살리는 작은 행동`,
        body: `${profile.actionBody}. 이것 하나만 해도 오늘이 훨씬 덜 복잡해집니다.`,
      },
      {
        title: `${profile.hourLabel}에 맞는 첫 행동`,
        body: `${profile.hourAction}. 크게 바꾸기보다 이 한 가지를 먼저 해보세요.`,
      },
      {
        title: `${withKoreanParticle(profile.dominantLabel, '을', '를')} 좋은 쪽으로 쓰기`,
        body: `${profile.balanceBody} 그래서 오늘은 ${profile.actionBody}.`,
      },
    ],
    profile.signatureSeed,
    7
  );
}

function buildPublicRisk(
  concernId: ConcernId,
  profile: PublicTodayProfile
) {
  const staticCopy = FREE_RESULT_GUIDE_COPY[concernId];
  if (concernId !== 'general') {
    return {
      title: staticCopy.riskTitle,
      body: joinUniqueSentences([staticCopy.riskBody, profile.roleCaution, profile.hourCaution]),
    };
  }

  return pickVariant(
    [
      {
        title: `${withKoreanParticle(profile.weakestLabel, '이', '가')} 비는 순간`,
        body: `${PUBLIC_ELEMENT_COPY[profile.weakestElement].weakCare}. ${profile.roleCaution}`,
      },
      {
        title: `${profile.hourLabel}에서 조심할 점`,
        body: `${profile.hourCaution}. 급히 정하기보다 한 번 확인하세요.`,
      },
      {
        title: `${withKoreanParticle(profile.dominantLabel, '이', '가')} 과해질 때`,
        body: `${PUBLIC_ELEMENT_COPY[profile.dominantElement].strongCaution}. 오늘은 ${profile.actionShort}.`,
      },
    ],
    profile.signatureSeed,
    13
  );
}

function getTodayEvidenceSnippet(report: SajuReport) {
  const rule = getTopicInterpretationRule(report.focusTopic);
  const card = selectEvidenceCard(report.evidenceCards, rule.evidencePriority);
  return toEvidenceSnippet(card);
}

function getTodayEvidenceCard(
  report: SajuReport,
  type: 'lead' | 'caution'
) {
  const rule = getTopicInterpretationRule(report.focusTopic);
  const priorities = type === 'lead' ? rule.evidencePriority : rule.cautionPriority;
  return selectEvidenceCard(report.evidenceCards, priorities);
}

function getEvidenceActionHints(
  report: SajuReport,
  type: 'lead' | 'caution',
  limit = 2
) {
  return uniqueStrings(getTodayEvidenceCard(report, type)?.practicalActions ?? [], limit);
}

function getLuckFactLine(sajuData: SajuDataV1 | SajuDataV2) {
  return compactStrings([
    sajuData.currentLuck?.currentMajorLuck?.ganzi
      ? `${sajuData.currentLuck.currentMajorLuck.ganzi} 큰 흐름`
      : null,
    sajuData.currentLuck?.saewoon?.ganzi
      ? `${sajuData.currentLuck.saewoon.ganzi} 올해 흐름`
      : null,
    sajuData.currentLuck?.wolwoon?.ganzi
      ? `${sajuData.currentLuck.wolwoon.ganzi} 이번 달 흐름`
      : null,
  ]).join(' / ');
}

function getTimeBlockBaseScore(report: SajuReport) {
  const focusScore = getScore(report, report.focusScoreKey);
  return focusScore?.score ?? getScore(report, 'overall')?.score ?? 70;
}

function getTimeBlockCalculatedAt(
  sajuData: SajuDataV1 | SajuDataV2,
  block: (typeof TIME_BLOCKS)[number]
) {
  const baseDate = new Date(sajuData.metadata.calculatedAt);
  const local = getLocalDateTimeSnapshot(
    sajuData.metadata.calculatedAt,
    sajuData.input.timezone
  );
  const nextDate = addDaysToDateParts(local.year, local.month, local.day, block.dayOffset);
  const offset = resolveTimeZoneOffset(baseDate, sajuData.input.timezone);
  return `${nextDate.year}-${pad2(nextDate.month)}-${pad2(nextDate.day)}T${pad2(block.midpointHour)}:00:00${offset}`;
}

function parseTimeBlockPillar(
  sajuData: SajuDataV1 | SajuDataV2,
  block: (typeof TIME_BLOCKS)[number]
) {
  const calculatedAt = getTimeBlockCalculatedAt(sajuData, block);
  const local = getLocalDateTimeSnapshot(calculatedAt, sajuData.input.timezone);
  const solar = Solar.fromYmdHms(local.year, local.month, local.day, local.hour, 0, 0);
  const eightChar = solar.getLunar().getEightChar();
  eightChar.setSect(sajuData.input.jasiMethod === 'split' ? 1 : 2);

  const timeGanzi = eightChar.getTime();
  const stem = timeGanzi[0] as Stem;
  const branch = timeGanzi[1] as Branch;

  return {
    calculatedAt,
    timeGanzi,
    stem,
    branch,
    stemElement: STEM_ELEMENT_MAP[stem],
    branchElement: BRANCH_ELEMENT_MAP[branch],
  };
}

function describeBranchRelation(left: Branch, right: Branch) {
  const branchKey = sortBranchKey(left, right);

  if (BRANCH_SIX_HARMONIES.has(branchKey)) {
    return { label: '육합', delta: 7, tone: 'support' as const };
  }
  if (HALF_HARMONY_PAIRS.has(branchKey)) {
    return { label: '반합', delta: 5, tone: 'support' as const };
  }
  if (BRANCH_CLASHES.has(branchKey)) {
    return { label: '충', delta: -7, tone: 'caution' as const };
  }
  if (BRANCH_PUNISHMENTS.has(branchKey)) {
    return { label: '형', delta: -5, tone: 'caution' as const };
  }
  if (BRANCH_BREAKS.has(branchKey)) {
    return { label: '파', delta: -4, tone: 'caution' as const };
  }
  if (BRANCH_HARMS.has(branchKey)) {
    return { label: '해', delta: -3, tone: 'caution' as const };
  }

  return null;
}

function getTimeBlockRelationImpact(
  blockBranch: Branch,
  sajuData: SajuDataV1 | SajuDataV2
) {
  const natalBranches = [
    { slot: '시주', branch: sajuData.pillars.hour?.branch ?? null, weight: 0.9 },
    { slot: '일주', branch: sajuData.pillars.day.branch, weight: 1.35 },
    { slot: '월주', branch: sajuData.pillars.month.branch, weight: 1.15 },
    { slot: '년주', branch: sajuData.pillars.year.branch, weight: 0.8 },
  ];

  const details = natalBranches
    .filter((entry): entry is { slot: string; branch: Branch; weight: number } => Boolean(entry.branch))
    .map((entry) => {
      const relation = describeBranchRelation(blockBranch, entry.branch);
      if (!relation) return null;
      return {
        ...relation,
        slot: entry.slot,
        branch: entry.branch,
        weightedDelta: Math.round(relation.delta * entry.weight),
      };
    })
    .filter(
      (
        detail
      ): detail is {
        label: string;
        delta: number;
        tone: 'support' | 'caution';
        slot: string;
        branch: Branch;
        weightedDelta: number;
      } => Boolean(detail)
    );

  const totalDelta = details.reduce((sum, detail) => sum + detail.weightedDelta, 0);
  const supportLabels = details
    .filter((detail) => detail.tone === 'support')
    .map((detail) => `${detail.slot} ${withKoreanParticle(detail.branch, '과', '와')} ${detail.label}`)
    .slice(0, 2);
  const cautionLabels = details
    .filter((detail) => detail.tone === 'caution')
    .map((detail) => `${detail.slot} ${withKoreanParticle(detail.branch, '과', '와')} ${detail.label}`)
    .slice(0, 2);

  return {
    totalDelta,
    supportLabels,
    cautionLabels,
  };
}

function getTimeBlockElementImpact(sajuData: SajuDataV1 | SajuDataV2, stemElement: Element, branchElement: Element) {
  const primaryElement = (sajuData.yongsin?.primary?.value as Element | undefined) ?? null;
  const supportElements = (sajuData.yongsin?.secondary ?? []).map((item) => item.value as Element);
  const cautionElements = (sajuData.yongsin?.kiyshin ?? []).map((item) => item.value as Element);
  const dayMasterElement = sajuData.dayMaster.element;
  const resourceElement = generatorOfElement(dayMasterElement);
  const outputElement = generatedByElement(dayMasterElement);
  const officerElement = controllerOfElement(dayMasterElement);

  let delta = 0;
  const supportLines: string[] = [];
  const cautionLines: string[] = [];

  if (primaryElement && branchElement === primaryElement) {
    delta += 8;
    supportLines.push(`${branchElement} 기운이 오늘의 보완 힌트와 맞닿습니다.`);
  }
  if (primaryElement && stemElement === primaryElement) {
    delta += 4;
    supportLines.push(`${stemElement} 기운이 오늘 부족한 부분을 한 번 더 받쳐줍니다.`);
  }
  if (supportElements.includes(branchElement)) {
    delta += 5;
    supportLines.push(`${branchElement} 기운이 보조 힌트와 이어져 작은 선택을 받쳐줍니다.`);
  }
  if (supportElements.includes(stemElement)) {
    delta += 2;
  }
  if (cautionElements.includes(branchElement)) {
    delta -= 6;
    cautionLines.push(`${branchElement} 기운이 조절할 흐름과 닿아 과한 반응을 키우기 쉽습니다.`);
  }
  if (cautionElements.includes(stemElement)) {
    delta -= 3;
  }

  if (sajuData.strength?.level === '신강') {
    if (branchElement === outputElement || branchElement === officerElement) {
      delta += 3;
      supportLines.push(`${branchElement} 기운이 강한 내 기운을 밖으로 잘 풀어줍니다.`);
    }
    if (branchElement === dayMasterElement || branchElement === resourceElement) {
      delta -= 3;
      cautionLines.push(`${branchElement} 기운이 이미 강한 축을 더 키워 균형을 무겁게 만들 수 있습니다.`);
    }
  }

  if (sajuData.strength?.level === '신약') {
    if (branchElement === dayMasterElement || branchElement === resourceElement) {
      delta += 4;
      supportLines.push(`${branchElement} 기운이 약한 축을 바로 보강해 버티는 힘을 줍니다.`);
    }
    if (branchElement === outputElement || branchElement === officerElement) {
      delta -= 4;
      cautionLines.push(`${branchElement} 기운이 약한 내 기운을 더 빨리 소모시킬 수 있습니다.`);
    }
  }

  if (branchElement === sajuData.fiveElements.weakest) {
    delta += 2;
  }
  if (branchElement === sajuData.fiveElements.dominant) {
    delta -= 2;
  }

  return {
    delta,
    supportLines,
    cautionLines,
  };
}

function selectTimeBlockEvidenceCard(
  report: SajuReport,
  type: 'favorable' | 'caution',
  supportiveDelta: number,
  relationDelta: number
) {
  const rule = getTopicInterpretationRule(report.focusTopic);
  const priorities = type === 'favorable' ? rule.evidencePriority : rule.cautionPriority;
  const relationWeighted = Math.abs(relationDelta) >= 4;
  const strengthWeighted = Math.abs(supportiveDelta) >= 6;

  return [...report.evidenceCards].sort((left, right) => {
    const scoreCard = (card: ReportEvidenceCard) => {
      let score = 24 - Math.max(0, priorities.indexOf(card.key)) * 4;
      if (priorities.indexOf(card.key) === -1) score = 2;
      if (card.key === 'relations' && relationWeighted) score += 8;
      if (card.key === 'yongsin' && supportiveDelta > 0) score += 7;
      if (card.key === 'strength' && strengthWeighted) score += 5;
      if (card.key === 'gongmang' && type === 'caution' && supportiveDelta < 0) score += 3;
      return score;
    };

    return scoreCard(right) - scoreCard(left);
  })[0];
}

// 2026-05-15: premium 결과(시간 윈도우/액션/시나리오)도 매일 다르게 흐르게 하기 위한
// daily context. free 빌더와 공유.
interface DailyContext {
  todayPillar: TodayPillarSnapshot;
  signatureSeed: number;
  dailyDelta: number;
  flowSignal: string;
}

function getDailyBlockBias(startHour: number, ctx?: DailyContext | null): number {
  if (!ctx) return 0;
  // 0~10 사이의 진폭, 평균 ~5 가 빠진 -5~+5 정도 변동.
  // 같은 사용자라도 dateKeySeed + startHour 조합으로 매일 블록별 순위가 바뀌도록.
  const bias = ((ctx.signatureSeed + startHour * 13) % 11) - 5;
  return bias;
}

function buildTimeBlockEvaluations(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2,
  dailyContext?: DailyContext | null
) {
  const baseScore = getTimeBlockBaseScore(report);
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const actionRuleLeadHints = getEvidenceActionHints(report, 'lead', 3);
  const actionRuleCautionHints = getEvidenceActionHints(report, 'caution', 3);
  const luckFact = getLuckFactLine(sajuData);

  return TIME_BLOCKS.map((block) => {
    const timePillar = parseTimeBlockPillar(sajuData, block);
    const elementImpact = getTimeBlockElementImpact(
      sajuData,
      timePillar.stemElement,
      timePillar.branchElement
    );
    const relationImpact = getTimeBlockRelationImpact(timePillar.branch, sajuData);
    const dailyBias = getDailyBlockBias(block.startHour, dailyContext);
    const score = clampScore(
      baseScore + elementImpact.delta + relationImpact.totalDelta + dailyBias
    );
    const evidenceCard = selectTimeBlockEvidenceCard(
      report,
      score >= baseScore ? 'favorable' : 'caution',
      elementImpact.delta,
      relationImpact.totalDelta
    );
    const evidenceSnippet = evidenceCard ? toEvidenceSnippet(evidenceCard) : null;
    const hints = uniqueStrings(
      evidenceCard?.practicalActions ?? [],
      3
    );
    const fallbackHints = score >= baseScore ? actionRuleLeadHints : actionRuleCautionHints;
    const hintPool = hints.length > 0 ? hints : fallbackHints;
    const hint =
      hintPool.length > 0
        ? hintPool[(block.startHour + Math.max(0, score - 40)) % hintPool.length]
        : null;
    const actionLead = compactActionDescription(
      score >= baseScore ? report.primaryAction.description : report.cautionAction.description,
      evidenceSnippet
    );
    const supportSummary = uniqueStrings(
      [
        `${timePillar.timeGanzi}시에는 ${timePillar.branchElement} 기운이 전면에 서서 오늘 흐름을 바꿉니다.`,
        ...elementImpact.supportLines,
        relationImpact.supportLabels[0]
          ? `${withKoreanParticle(relationImpact.supportLabels.join(', '), '이', '가')} 들어와 말이나 결정이 묶이는 힘을 더합니다.`
          : null,
      ],
      2
    ).join(' ');
    const cautionSummary = uniqueStrings(
      [
        `${timePillar.timeGanzi}시는 ${timePillar.branchElement} 기운이 튀어나와 감정이나 판단이 과해지기 쉬운 블록입니다.`,
        ...elementImpact.cautionLines,
        relationImpact.cautionLabels[0]
          ? `${withKoreanParticle(relationImpact.cautionLabels.join(', '), '이', '가')} 겹치면 작은 반응도 크게 받아들이기 쉽습니다.`
          : null,
      ],
      2
    ).join(' ');
    const relationSummary =
      relationImpact.supportLabels[0] || relationImpact.cautionLabels[0]
        ? uniqueStrings([
            relationImpact.supportLabels[0]
              ? `${withKoreanParticle(relationImpact.supportLabels.join(', '), '이', '가')} 들어와 관계가 묶이는 쪽으로 작동합니다.`
              : null,
            relationImpact.cautionLabels[0]
              ? `${withKoreanParticle(relationImpact.cautionLabels.join(', '), '이', '가')} 겹치면 말의 여파가 오래 남기 쉽습니다.`
              : null,
          ]).join(' ')
        : null;

    return {
      range: block.range,
      timeGanzi: timePillar.timeGanzi,
      stem: timePillar.stem,
      branch: timePillar.branch,
      stemElement: timePillar.stemElement,
      branchElement: timePillar.branchElement,
      score,
      supportiveDelta: elementImpact.delta,
      relationDelta: relationImpact.totalDelta,
      evidenceCard,
      evidenceSnippet,
      actionLead,
      hint,
      relationSummary,
      supportSummary,
      cautionSummary,
      luckFact,
      favorableTail: concernCopy.favorableTail,
      cautionTail: concernCopy.cautionTail,
    };
  });
}

function pickTimeBlockWindows(
  evaluations: ReturnType<typeof buildTimeBlockEvaluations>,
  type: 'favorable' | 'caution'
) {
  const sorted = [...evaluations].sort((left, right) =>
    type === 'favorable' ? right.score - left.score : left.score - right.score
  );
  const selected: typeof evaluations = [];

  for (const candidate of sorted) {
    if (selected.length === 0) {
      selected.push(candidate);
      continue;
    }

    const hasDifferentEvidence = selected.every(
      (item) => item.evidenceCard?.key !== candidate.evidenceCard?.key
    );
    const hasDifferentBranch = selected.every((item) => item.branch !== candidate.branch);
    if (hasDifferentEvidence || hasDifferentBranch || selected.length >= 2) {
      selected.push(candidate);
    }
    if (selected.length >= 2) break;
  }

  return selected.slice(0, 2);
}

function limitEasyTimeSentences(value: string, maxSentences = 3) {
  const sentences = splitSentences(simplifySajuCopy(value))
    .map((sentence) =>
      sentence
        .replace(/밀어붙이/gu, '무리하게 진행하')
        .replace(/밀기보다/gu, '무리하기보다')
        .replace(/밀어도 되는/gu, '진행하기 좋은')
        .replace(/밀어도/gu, '진행해도')
        .replace(/밀고/gu, '진행하고')
        .replace(/기운/gu, '분위기')
        .replace(/보완 힌트/gu, '도움 되는 점')
        .replace(/선택 힌트/gu, '선택할 때 볼 점')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  return sentences.slice(0, maxSentences).join(' ');
}

function buildTimeWindowTitle(item: TodayTimeBlockEvaluation, type: 'favorable' | 'caution') {
  const branchCopy = TIME_BRANCH_WINDOW_COPY[item.branch];
  const suffix = type === 'favorable' ? branchCopy.favorableTitle : branchCopy.cautionTitle;
  return `${TIME_BRANCH_LABELS[item.branch]} · ${suffix}`;
}

function buildTimeWindowBody(
  concernId: ConcernId,
  item: TodayTimeBlockEvaluation,
  type: 'favorable' | 'caution',
  dailyContext?: DailyContext | null,
  windowIndex: number = 0
) {
  const branchCopy = TIME_BRANCH_WINDOW_COPY[item.branch];
  const concernCopy = CONCERN_EASY_TIME_COPY[concernId];
  const branchBody = type === 'favorable' ? branchCopy.favorableBody : branchCopy.cautionBody;
  const concernBody = type === 'favorable' ? concernCopy.favorable : concernCopy.caution;
  const scoreBody =
    type === 'favorable'
      ? item.score >= 78
        ? '중요한 일도 바로 크게 잡기보다 작게 시작하면 좋습니다.'
        : '부담 없는 일부터 하면 흐름이 편해집니다.'
      : item.score <= 58
        ? '오늘은 속도를 낮추고 확인을 하나 더 넣는 편이 안전합니다.'
        : '무리한 결론만 피하면 크게 흔들리지 않습니다.';
  const hintBody = item.hint
    ? `먼저 할 일은 "${limitEasyTimeSentences(item.hint, 1)}"입니다.`
    : null;
  // 2026-05-15: 첫 번째 윈도우(가장 점수 높/낮은 블록) 본문에만 일진 마커 한 줄 추가.
  // 매일 일진이 바뀌면 이 줄이 통째로 다른 ganzi 로 교체됨.
  const dailyMarker =
    dailyContext && windowIndex === 0 && dailyContext.todayPillar.ganzi
      ? `오늘 일진 ${dailyContext.todayPillar.ganzi} 흐름으로 본 시간대입니다.`
      : null;

  return limitEasyTimeSentences(
    joinUniqueSentences([branchBody, concernBody, hintBody, scoreBody, dailyMarker]),
    3
  );
}

function toTodayScores(
  todayReport: SajuReport,
  loveReport: SajuReport,
  wealthReport: SajuReport,
  careerReport: SajuReport,
  relationshipReport: SajuReport,
  conditionScore: number,
  profile: PublicTodayProfile,
  // 2026-05-15: 오늘 일진 vs 일간 오행 관계로 ±delta 적용해 매일 점수가 흐르게 함.
  dailyDelta: number = 0
): TodayScoreItem[] {
  const baseScores: TodayScoreItem[] = [
    getScore(todayReport, 'overall'),
    getScore(loveReport, 'love'),
    getScore(wealthReport, 'wealth'),
    getScore(careerReport, 'career'),
    getScore(relationshipReport, 'relationship'),
  ]
    .filter((score): score is ReportScore => Boolean(score))
    .map((score) => {
      const adjusted = clampScore(score.score + dailyDelta);
      return {
        key: score.key as TodayScoreItem['key'],
        label: SCORE_LABELS[score.key],
        score: adjusted,
        summary: sanitizeUserFacingCopy(
          buildAxisScoreSummary(score.key as TodayScoreItem['key'], adjusted, profile)
        ),
      };
    });

  baseScores.push({
    key: 'condition',
    label: SCORE_LABELS.condition,
    score: conditionScore,
    summary: sanitizeUserFacingCopy(buildAxisScoreSummary('condition', conditionScore, profile)),
  });

  return baseScores;
}

function buildTimeWindows(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2,
  type: 'favorable' | 'caution',
  dailyContext?: DailyContext | null
): TodayTimeWindow[] {
  const evaluations = pickTimeBlockWindows(
    buildTimeBlockEvaluations(concernId, report, sajuData, dailyContext),
    type
  );

  return evaluations.map((item, index) => ({
    range: item.range,
    mood: type,
    title: buildTimeWindowTitle(item, type),
    body: buildTimeWindowBody(concernId, item, type, dailyContext, index),
  }));
}

function buildScenarioComparison(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2,
  dailyContext?: DailyContext | null
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const evidenceSnippet = getTodayEvidenceSnippet(report);
  const leadHints = getEvidenceActionHints(report, 'lead', 2);
  const cautionHints = getEvidenceActionHints(report, 'caution', 2);
  const leadHint = leadHints[0];
  const secondaryLeadHint = leadHints[1] ?? leadHints[0];
  const cautionHint = cautionHints[0];
  const secondaryCautionHint = cautionHints[1] ?? cautionHints[0];
  const luckFact = getLuckFactLine(sajuData);
  const primaryAction = compactActionDescription(report.primaryAction.description, evidenceSnippet);
  const cautionAction = compactActionDescription(report.cautionAction.description, evidenceSnippet);
  const flowSignal = dailyContext?.flowSignal ?? null;

  return [
    {
      title: concernCopy.actNowTitle,
      better: joinUniqueSentences([
        flowSignal,
        evidenceSnippet,
        primaryAction,
        leadHint ? `특히 "${leadHint}"부터 잡고 들어가면 흐름을 덜 놓칩니다.` : null,
        concernCopy.actNowTail,
      ]),
      watch: joinUniqueSentences([
        cautionAction,
        cautionHint ? `${withKoreanParticle(`"${cautionHint}"`, '을', '를')} 같이 놓치면 작은 선택도 피로로 바뀌기 쉽습니다.` : null,
        luckFact ? `특히 ${withKoreanParticle(luckFact, '이', '가')} 겹친 날이라 단기 반응을 과신하지 않는 편이 좋습니다.` : null,
      ]),
    },
    {
      title: concernCopy.waitTitle,
      better: joinUniqueSentences([
        evidenceSnippet,
        secondaryLeadHint ? `${withKoreanParticle(`"${secondaryLeadHint}"`, '을', '를')} 먼저 정리하고 움직이면 결과가 더 매끈해집니다.` : null,
        concernCopy.waitTail,
      ]),
      watch: joinUniqueSentences([
        flowSignal,
        secondaryCautionHint
          ? `${withKoreanParticle(`"${secondaryCautionHint}"`, '을', '를')} 미루기만 하면 같은 빈틈이 뒤에서 다시 커질 수 있습니다.`
          : null,
        '우선순위 없이 미루기만 하면 좋은 흐름도 손에서 미끄러질 수 있습니다.',
      ]),
    },
  ];
}

function buildEvidenceLines(
  focusReport: SajuReport,
  todayReport: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2,
  unknownBirthTime: boolean
) {
  const lines = [
    `${focusReport.evidenceCards[0]?.label ?? '오늘 흐름'} · ${focusReport.evidenceCards[0]?.title ?? focusReport.summary}`,
    `큰 흐름 · ${sajuData.currentLuck?.currentMajorLuck?.ganzi ?? '정리 중'} / ${sajuData.currentLuck?.saewoon?.ganzi ?? '올해 흐름 정리 중'} / ${sajuData.currentLuck?.wolwoon?.ganzi ?? '이번 달 흐름 정리 중'}`,
    `보완 힌트 · ${sajuData.yongsin?.plainSummary ?? '부족한 부분을 차분히 채우는 편이 좋습니다.'}`,
  ];

  if (unknownBirthTime) {
    lines.push('태어난 시간이 없어 시간대별 흐름은 줄여 읽고, 전체 흐름 중심으로 정리했습니다.');
  }

  if (todayReport.evidenceCards[1]?.title) {
    lines.push(`${todayReport.evidenceCards[1].label} · ${todayReport.evidenceCards[1].title}`);
  }

  return lines;
}

// 2026-05-15: 동일 사용자가 같은 자세히 보기에서 매일 같은 추천/회피를 보지 않도록
// daily lead 카피 후보들. 일진 element 관계로 카테고리 6종으로 매핑.
type DailyRelationKind = 'same' | 'support' | 'leak' | 'control' | 'spend' | 'neutral';

function getDailyRelationKind(
  myEl: Element | null | undefined,
  todayEl: Element | null
): DailyRelationKind {
  if (!myEl || !todayEl) return 'neutral';
  if (myEl === todayEl) return 'same';
  if (GENERATOR_OF_MAP[myEl] === todayEl) return 'support';
  if (GENERATED_BY_MAP[myEl] === todayEl) return 'leak';
  if (CONTROLLER_OF_MAP[myEl] === todayEl) return 'control';
  if (CONTROLLER_OF_MAP[todayEl] === myEl) return 'spend';
  return 'neutral';
}

const DAILY_LEAD_VARIANTS: Record<DailyRelationKind, string[]> = {
  same: [
    '오늘은 내 흐름을 그대로 따라가는 일에서 가장 매끈한 성과가 나옵니다.',
    '오늘은 내 페이스가 살아나는 흐름이라 미뤄둔 본업을 잡아도 좋아요.',
  ],
  support: [
    '오늘은 받쳐주는 흐름이 들어오는 날이라 회복 · 학습 · 정리에 손이 잘 갑니다.',
    '오늘은 도움을 받기 좋은 흐름이라 누군가에게 작게 요청해도 자연스럽습니다.',
  ],
  leak: [
    '오늘은 말이 잘 풀리는 흐름이지만 에너지 소모도 큰 편이라, 하루 종일 쏟지 마세요.',
    '오늘은 의견을 꺼내기 좋은 흐름이라 짧고 명확한 한 줄을 미리 적어두세요.',
  ],
  control: [
    '오늘은 누르는 힘이 들어오는 날이라 결정은 한 박자 늦추고 확인 한 번을 더 두세요.',
    '오늘은 무게가 실리는 흐름이라 큰 약속은 다음 날로 미루는 편이 안전합니다.',
  ],
  spend: [
    '오늘은 정돈해야 하는 흐름이라 작은 실행과 마무리에 손이 많이 갑니다.',
    '오늘은 끝내야 할 일을 먼저 짚고 시작하면 흐름이 가벼워져요.',
  ],
  neutral: [
    '오늘은 평이한 흐름이라 큰 결단보다 한 일을 끝까지 마무리하는 쪽이 좋습니다.',
    '오늘은 특별히 튀는 신호가 없는 날이라 평소 루틴을 한 번 더 점검해보세요.',
  ],
};

const DAILY_AVOID_VARIANTS: Record<DailyRelationKind, string[]> = {
  same: [
    '오늘은 내 페이스에만 갇혀 주변 신호를 놓치지 않도록 한 박자 둘러보세요.',
    '오늘은 자기 주관이 강해 상대 의견을 가볍게 흘리기 쉽습니다.',
  ],
  support: [
    '오늘은 도움을 받기 좋은 만큼 의존이 길어지지 않도록 마무리는 직접 정리하세요.',
    '오늘은 결정을 미루기 쉬운 흐름이라 마감은 명확히 잡아두세요.',
  ],
  leak: [
    '오늘은 말이 길어지면 의도와 다르게 들릴 수 있으니 한 줄로 줄여보세요.',
    '오늘은 많이 말하다 보면 에너지가 빠지기 쉽습니다.',
  ],
  control: [
    '오늘은 마찰이 생기기 쉬운 흐름이라 즉답보다 한 박자 쉬고 답하세요.',
    '오늘은 큰 결정은 다음 날로 미루는 편이 안전합니다.',
  ],
  spend: [
    '오늘은 작은 결정도 손이 많이 가는 흐름이라 일을 늘리지 않는 편이 좋아요.',
    '오늘은 새로 시작하기보다 마무리에 무게를 두세요.',
  ],
  neutral: [
    '오늘은 무리한 변화보다 평소 흐름을 유지하는 편이 좋습니다.',
    '오늘은 결정이 흩어지기 쉬우니 우선순위를 한 줄로 적어두세요.',
  ],
};

function pickDailyLeadCopy(dailyContext: DailyContext | null | undefined, sajuData: SajuDataV1 | SajuDataV2) {
  if (!dailyContext) return null;
  const myEl = sajuData.dayMaster?.element ?? null;
  const todayEl =
    dailyContext.todayPillar.stemElement ?? dailyContext.todayPillar.branchElement ?? null;
  const kind = getDailyRelationKind(myEl, todayEl);
  return pickVariant(DAILY_LEAD_VARIANTS[kind], dailyContext.signatureSeed, 17);
}

function pickDailyAvoidCopy(dailyContext: DailyContext | null | undefined, sajuData: SajuDataV1 | SajuDataV2) {
  if (!dailyContext) return null;
  const myEl = sajuData.dayMaster?.element ?? null;
  const todayEl =
    dailyContext.todayPillar.stemElement ?? dailyContext.todayPillar.branchElement ?? null;
  const kind = getDailyRelationKind(myEl, todayEl);
  return pickVariant(DAILY_AVOID_VARIANTS[kind], dailyContext.signatureSeed, 23);
}

function buildRecommendedActions(
  concernId: ConcernId,
  focusReport: SajuReport,
  sajuData: SajuDataV1 | SajuDataV2,
  dailyContext?: DailyContext | null
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const leadHints = getEvidenceActionHints(focusReport, 'lead', 3);
  const leadEvidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const primaryAction = compactActionDescription(
    focusReport.primaryAction.description,
    leadEvidenceSnippet
  );
  const dailyLead = pickDailyLeadCopy(dailyContext, sajuData);
  // 2026-05-15: dailyLead 를 primary 뒤·practical hints 앞에 끼워 매일 추천이 흔들리게 함.
  const actions = uniqueStrings(
    [
      primaryAction,
      dailyLead,
      ...leadHints.map((item) => `${item} 흐름부터 먼저 잡아보세요.`),
      getLuckFactLine(sajuData)
        ? `지금은 ${withKoreanParticle(getLuckFactLine(sajuData), '을', '를')} 같이 보며 ${concernCopy.favorableTail}`
        : concernCopy.favorableTail,
      `오늘 부족한 부분을 생활 루틴으로 채우면 체감 안정감이 더 큽니다.`,
    ],
    3
  );

  return actions;
}

function buildAvoidActions(
  concernId: ConcernId,
  focusReport: SajuReport,
  input: BirthInput,
  sajuData: SajuDataV1 | SajuDataV2,
  dailyContext?: DailyContext | null
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const cautionHints = getEvidenceActionHints(focusReport, 'caution', 3);
  const cautionEvidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const cautionAction = compactActionDescription(
    focusReport.cautionAction.description,
    cautionEvidenceSnippet
  );
  const dailyAvoid = pickDailyAvoidCopy(dailyContext, sajuData);
  const actions = uniqueStrings(
    [
      cautionAction,
      dailyAvoid,
      ...cautionHints.map((item) => `${withKoreanParticle(item, '을', '를')} 놓친 채 무리하게 진행하지 않는 편이 좋습니다.`),
      input.unknownTime
        ? '태어난 시간이 없으니 세부 타이밍보다 전체 흐름을 먼저 보는 편이 안전합니다.'
        : getLuckFactLine(sajuData)
          ? `${withKoreanParticle(getLuckFactLine(sajuData), '이', '가')} 겹친 날이라 반응이 좋더라도 같은 속도로 하루 종일 밀지 않는 편이 낫습니다.`
          : concernCopy.cautionTail,
    ],
    3
  );

  return actions;
}

// 2026-05-15 PR 2 — 운세톡톡 벤치마크: 행운 패키지용 lucky/unlucky 오행 추출.
// yongsin.primary 가 type='element' 면 value 직사용, type='stem'/'branch' 면 매핑.
// 없으면 사주 최약 오행을 lucky 로, 최강 오행을 unlucky 로 fallback.
export function deriveLuckyElements(
  sajuData: SajuDataV1 | SajuDataV2
): { lucky: '목' | '화' | '토' | '금' | '수'; unlucky: '목' | '화' | '토' | '금' | '수' | null } {
  type Elem = '목' | '화' | '토' | '금' | '수';
  const yongsin = sajuData.yongsin;
  let lucky: Elem | null = null;
  let unlucky: Elem | null = null;

  function symbolToElement(ref: { type: string; value: string } | undefined | null): Elem | null {
    if (!ref) return null;
    if (ref.type === 'element') {
      if (['목', '화', '토', '금', '수'].includes(ref.value)) return ref.value as Elem;
    }
    if (ref.type === 'stem') {
      return STEM_ELEMENT_MAP[ref.value as Stem] as Elem | undefined ?? null;
    }
    if (ref.type === 'branch') {
      return BRANCH_ELEMENT_MAP[ref.value as Branch] as Elem | undefined ?? null;
    }
    return null;
  }

  if (yongsin) {
    lucky = symbolToElement(yongsin.primary);
    // kiyshin (기신) 의 첫 항목을 unlucky 로.
    const firstKi = yongsin.kiyshin?.[0];
    unlucky = symbolToElement(firstKi);
  }

  if (!lucky) {
    lucky = sajuData.fiveElements.weakest as Elem;
  }
  if (!unlucky) {
    const dominantEl = sajuData.fiveElements.dominant as Elem;
    // lucky 와 같으면 unlucky 폴백 비움.
    unlucky = dominantEl === lucky ? null : dominantEl;
  }

  return { lucky, unlucky };
}

// 2026-05-15 PR 1 — 운세톡톡 벤치마크: 사주 명식 신뢰 카드용 스냅샷 빌더.
// 5개 오행을 dominant/weakest 표시와 함께 정렬해, UI 가 바로 막대바 렌더링.
// 2026-05-15 PR — 일주 ganzi → 60갑자 인덱스 (0~59). 공망 계산에 사용.
// 천간 i (0~9) 와 지지 j (0~11) 가 갑자 인덱스 k 일 때, k % 10 = i / k % 12 = j 를 만족.
function computeDayGanziIndex(dayStem: string, dayBranch: string): number {
  const STEM_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCH_ORDER_LOCAL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const stemIdx = STEM_ORDER.indexOf(dayStem);
  const branchIdx = BRANCH_ORDER_LOCAL.indexOf(dayBranch);
  if (stemIdx < 0 || branchIdx < 0) return 0;
  // 가능한 6 가지 k 중 (stemIdx + 10k) % 12 = branchIdx 만족하는 k 찾기.
  for (let k = 0; k < 6; k += 1) {
    if ((stemIdx + 10 * k) % 12 === branchIdx) return stemIdx + 10 * k;
  }
  return 0;
}

function buildSajuChartSnapshot(
  sajuData: SajuDataV1 | SajuDataV2,
  todayGanzi: string | null,
  todayStem: string | null,
  todayBranch: string | null,
  currentYearBranch: string | null
): TodaySajuChartSnapshot {
  const dayMasterElement = sajuData.dayMaster.element as '목' | '화' | '토' | '금' | '수';
  const dominantElement = sajuData.fiveElements.dominant;
  const weakestElement = sajuData.fiveElements.weakest;
  const elementOrder: Array<'목' | '화' | '토' | '금' | '수'> = ['목', '화', '토', '금', '수'];

  const fiveElements = elementOrder.map((el) => {
    const value = sajuData.fiveElements.byElement[el];
    return {
      element: el,
      count: value?.count ?? 0,
      percentage: Math.round(value?.percentage ?? 0),
      isDominant: el === dominantElement,
      isWeakest: el === weakestElement,
    };
  });

  return {
    pillars: {
      year: {
        stem: sajuData.pillars.year.stem,
        branch: sajuData.pillars.year.branch,
        ganzi: sajuData.pillars.year.ganzi,
      },
      month: {
        stem: sajuData.pillars.month.stem,
        branch: sajuData.pillars.month.branch,
        ganzi: sajuData.pillars.month.ganzi,
      },
      day: {
        stem: sajuData.pillars.day.stem,
        branch: sajuData.pillars.day.branch,
        ganzi: sajuData.pillars.day.ganzi,
      },
      hour: sajuData.pillars.hour
        ? {
            stem: sajuData.pillars.hour.stem,
            branch: sajuData.pillars.hour.branch,
            ganzi: sajuData.pillars.hour.ganzi,
          }
        : null,
    },
    dayMaster: {
      stem: sajuData.pillars.day.stem,
      element: dayMasterElement,
    },
    fiveElements,
    strengthLabel: sajuData.strength?.level ?? null,
    patternName: sajuData.pattern?.name ?? null,
    todayGanzi,
    detectedSinsals: (() => {
      try {
        const dayGanziIndex = computeDayGanziIndex(
          sajuData.pillars.day.stem,
          sajuData.pillars.day.branch
        );
        const iljinInput = todayStem && todayBranch
          ? { stem: todayStem as IljinStem, branch: todayBranch as IljinBranch }
          : undefined;
        const rawHits = detectComprehensiveSinsals(
          {
            dayMaster: sajuData.pillars.day.stem as IljinStem,
            yearBranch: sajuData.pillars.year.branch as IljinBranch,
            monthBranch: sajuData.pillars.month.branch as IljinBranch,
            dayBranch: sajuData.pillars.day.branch as IljinBranch,
            hourBranch: (sajuData.pillars.hour?.branch ?? null) as IljinBranch | null,
            dayGanziIndex,
          },
          {
            iljin: iljinInput,
            currentYearBranch: currentYearBranch as IljinBranch | undefined,
          }
        );
        // PR #140 — active sinsal_weight_version 이 있으면 scoreHint override.
        // cache 가 비어있으면 background refresh + 이번 요청은 hardcoded 그대로.
        const hits = applyActiveSinsalWeights(rawHits);
        return hits.map((h) => ({
          name: h.name,
          category: h.category,
          positions: h.positions,
          scoreHint: h.scoreHint,
          hint: h.hint,
        }));
      } catch {
        return [];
      }
    })(),
  };
}

export function buildTodayFortuneFreeResult(
  input: BirthInput,
  sajuData: SajuDataV1 | SajuDataV2,
  options: TodayFortuneBuildOptions
): TodayFortuneFreeResult {
  const concern = getTodayConcern(options.concernId);
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');
  // 2026-05-15: 매일 다른 결과를 위해 오늘 일진 스냅샷 + element delta 적용.
  // 2026-05-18: options.now 가 있으면 fixed Date 사용 (테스트 전용) — 없으면 new Date() (production).
  const todayPillar = getTodayPillarSnapshot(sajuData, { now: options.now });
  const dailyDelta = buildDailyDelta(todayPillar, sajuData);
  const profile = buildPublicTodayProfile(input, sajuData, options, todayPillar);
  const conditionScore = clampScore(
    buildConditionScore(todayReport, loveReport, wealthReport, sajuData) + dailyDelta
  );
  const rawScores = toTodayScores(
    todayReport,
    loveReport,
    wealthReport,
    careerReport,
    relationshipReport,
    conditionScore,
    profile,
    dailyDelta
  );

  // PR #165 — iljinScore 를 scores 정규화 전에 미리 계산.
  // 2026-05-16 PR #179 — inline 로직을 computeSajuIljinScore + unifyScoresWithIljinScore helper 로 추출.
  //   사주 페이지(서버 컴포넌트)에서도 동일 helper 호출해 두 페이지 점수 일치 보장.
  // 2026-05-18 — options.now 전달 (테스트 전용 fixed Date).
  const iljinScoreResult = computeSajuIljinScore(sajuData, { now: options.now });
  const computedIljinScore = iljinScoreResult
    ? {
        totalScore: iljinScoreResult.totalScore,
        grade: iljinScoreResult.grade,
        gradeEmoji: iljinScoreResult.gradeEmoji,
        gradeMessage: iljinScoreResult.gradeMessage,
        breakdown: iljinScoreResult.breakdown,
      }
    : null;

  // scores 의 overall + 영역별을 iljinScore.totalScore 바탕으로 정규화.
  // iljinScore 없으면 (시간 미입력 등) 기존 raw scores 유지.
  const unifiedScores: TodayScoreItem[] = computedIljinScore
    ? unifyScoresWithIljinScore(rawScores, computedIljinScore.totalScore)
    : rawScores;

  // PR #149 (Part C) — 사용자 상황 기반 영역 점수 재정렬. overall 은 항상 맨 앞.
  // grounding.personalizationContext.userSituation 에서 추출.
  const userSituation =
    options.grounding?.personalizationContext?.userSituation ?? null;
  const scores = reorderTodayScoresBySituation(unifiedScores, userSituation);
  const reasonBody = buildPublicReasonBody(profile, Boolean(input.unknownTime));
  const groundingSummary = buildPublicGroundingSummary(profile, options.kasiComparison);
  const upsell = selectUpsell({ scores }, options.concernId);
  const opportunity = buildPublicOpportunity(options.concernId, profile);
  const risk = buildPublicRisk(options.concernId, profile);

  return {
    sourceSessionId: options.sourceSessionId,
    // 2026-05-15: 클라이언트 sessionStorage 키에 사용 — 어제 캐시가 오늘 화면을 가리지 않게 분리.
    dateKey: todayPillar.dateKey,
    // 2026-05-15: hero 카드가 "달빛이님" 으로 하드코드돼 사용자 이름을 무시하던 회귀 fix.
    userName: input.name?.trim() || null,
    concernId: options.concernId,
    concernLabel: concern.label,
    concernHanja: concern.hanja,
    focusTopic: concern.focusTopic,
    birthMeta: {
      calendarType: options.calendarType,
      timeRule: options.timeRule,
      unknownBirthTime: Boolean(input.unknownTime),
      usesLocation: Boolean(input.birthLocation),
    },
    oneLine: {
      eyebrow: `${concern.prompt} · ${concern.hanja}`,
      headline: sanitizeUserFacingCopy(buildPublicTodayHeadline(options.concernId, profile)),
      body: sanitizeUserFacingCopy(
        buildPublicTodayBody(
          options.concernId,
          profile,
          Boolean(input.unknownTime)
        )
      ),
    },
    scores,
    // PR #149 (Part C) — UI 가 chip strip + perspective 한 줄에 사용.
    userSituation,
    opportunity: {
      title: sanitizeUserFacingCopy(opportunity.title),
      body: sanitizeUserFacingCopy(opportunity.body),
    },
    risk: {
      title: sanitizeUserFacingCopy(risk.title),
      body: sanitizeUserFacingCopy(risk.body),
    },
    reasonSnippet: {
      title: '사주 근거 한 줄',
      body: sanitizeUserFacingCopy(reasonBody),
    },
    groundingSummary,
    nextAction: {
      copy: upsell.copy,
      product: 'TODAY_DEEP_READING',
      // 2026-06-26 — 실제 차감(detail_report=10코인)과 표시 일치. 기존 1 은 표시≠실제 불일치였음.
      coinCost: 10,
    },
    followUpQuestions: concern.followUpQuestions,
    // 2026-05-15 PR 1 — 운세톡톡 벤치마크: 사주 명식 신뢰 카드 + 대운 CTA 데이터.
    sajuChart: buildSajuChartSnapshot(
      sajuData,
      todayPillar.ganzi ?? null,
      todayPillar.stem ?? null,
      todayPillar.branch ?? null,
      // 올해 연지 — 삼재 탐지용. todayPillar.monthGanzi 가 있다면 그 천간/지지로 추론 가능.
      // 실제 연지는 sajuData.currentLuck?.saewoon?.branch 가 있으면 사용. 없으면 null.
      (() => {
        const saewoonGanzi = sajuData.currentLuck?.saewoon?.ganzi ?? null;
        if (saewoonGanzi && saewoonGanzi.length === 2) {
          return saewoonGanzi.charAt(1);
        }
        return null;
      })()
    ),
    // sourceSessionId 는 createReading() 이 반환한 reading slug. /saju/[slug]/deep 으로 직접 연결.
    sajuSlug: options.sourceSessionId,
    // 2026-05-15 PR 2 — 운세톡톡 벤치마크: 행운 패키지 12종.
    // PR #167 — 사주 lucky element 외에 오늘 일진 천간의 element 도 source 로 추가.
    // 사주 lucky 가 평생 안 변하던 항목 (색·숫자·방향·음식·향·보석·음악·시간·성씨) 이
    // 일진과 다를 때 두 element 의 항목을 모두 노출 → 매일 일부 변동 + 명리 정확성 유지.
    luckyPackage: (() => {
      const { lucky, unlucky } = deriveLuckyElements(sajuData);
      const todayStemElement = todayPillar.stem
        ? (STEM_ELEMENT_MAP[todayPillar.stem as Stem] as
            | '목'
            | '화'
            | '토'
            | '금'
            | '수'
            | undefined) ?? null
        : null;
      return buildTodayLuckyPackage({
        luckyElement: lucky,
        unluckyElement: unlucky,
        todayBranch: todayPillar.branch ?? null,
        todayStemElement,
        dateKey: todayPillar.dateKey,
        dayGanzi: sajuData.pillars.day.ganzi,
      });
    })(),
    // 2026-05-15 PR 3 — 운세톡톡 벤치마크: 일진 점수 8영역 + 메시지 라이브러리.
    // PR #165 — 위에서 미리 계산한 computedIljinScore 재사용 (중복 계산 제거 + 정규화 일치).
    iljinScore: computedIljinScore,
    iljinMessages: (() => {
      if (!todayPillar.stem || !todayPillar.branch) return null;
      const { lucky, unlucky } = deriveLuckyElements(sajuData);
      const sajuOrigin = buildSajuOriginForIljin(sajuData, lucky, unlucky);
      const picked = pickIljinMessages(
        sajuOrigin,
        todayPillar.stem as IljinStem,
        todayPillar.branch as IljinBranch,
        { name: input.name ?? '선생님', element: sajuData.fiveElements.weakest },
        `${todayPillar.dateKey}::${sajuData.pillars.day.ganzi}`,
        3
      );
      return { caseIds: picked.caseIds, messages: picked.messages };
    })(),
  };
}

// 2026-05-15 PR 3 — SajuDataV1 → iljin-score-engine 의 SajuOriginInput 변환.
export function buildSajuOriginForIljin(
  sajuData: SajuDataV1 | SajuDataV2,
  yongsinEl: '목' | '화' | '토' | '금' | '수',
  kishinEl: '목' | '화' | '토' | '금' | '수' | null
): SajuOriginInput {
  const byEl = sajuData.fiveElements.byElement;
  return {
    dayMaster: sajuData.pillars.day.stem as IljinStem,
    dayMasterElement: sajuData.dayMaster.element as '목' | '화' | '토' | '금' | '수',
    yearStem: sajuData.pillars.year.stem as IljinStem,
    yearBranch: sajuData.pillars.year.branch as IljinBranch,
    monthStem: sajuData.pillars.month.stem as IljinStem,
    monthBranch: sajuData.pillars.month.branch as IljinBranch,
    dayBranch: sajuData.pillars.day.branch as IljinBranch,
    hourStem: (sajuData.pillars.hour?.stem ?? null) as IljinStem | null,
    hourBranch: (sajuData.pillars.hour?.branch ?? null) as IljinBranch | null,
    elementPercentages: {
      목: byEl['목']?.percentage ?? 0,
      화: byEl['화']?.percentage ?? 0,
      토: byEl['토']?.percentage ?? 0,
      금: byEl['금']?.percentage ?? 0,
      수: byEl['수']?.percentage ?? 0,
    },
    strengthLabel: sajuData.strength?.level ?? null,
    yongsinElement: yongsinEl,
    kishinElement: kishinEl,
  };
}

// 2026-05-16 PR #179 — 사주 페이지에서 동일한 iljinScore 통일 절차를 재사용하기 위한 wrapper.
// getTodayPillarSnapshot + deriveLuckyElements + buildSajuOriginForIljin + calculateIljinScore
// 4단계를 묶어 하나의 호출로. 시 미입력 등 todayPillar 부족 시 null 반환.
export function computeSajuIljinScore(
  sajuData: SajuDataV1 | SajuDataV2,
  options?: { now?: Date }
) {
  const todayPillar = getTodayPillarSnapshot(sajuData, options);
  if (!todayPillar.stem || !todayPillar.branch) return null;
  const { lucky, unlucky } = deriveLuckyElements(sajuData);
  const sajuOrigin = buildSajuOriginForIljin(sajuData, lucky, unlucky);
  return calculateIljinScore(sajuOrigin, {
    todayStem: todayPillar.stem as IljinStem,
    todayBranch: todayPillar.branch as IljinBranch,
  });
}

export function buildTodayFortunePremiumResult(
  input: BirthInput,
  sajuData: SajuDataV1 | SajuDataV2,
  concernId: ConcernId,
  grounding?: SajuInterpretationGrounding | null,
  kasiComparison?: KasiSingleInputComparison | null,
  // 2026-05-18: 테스트 전용 — fixed Date 주입으로 다른 "오늘" 시뮬레이션.
  options?: { now?: Date }
): TodayFortunePremiumResult {
  const concern = getTodayConcern(concernId);
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const focusReport =
    concern.focusTopic === 'today'
      ? todayReport
      : buildSajuReport(input, sajuData, concern.focusTopic);

  // 2026-05-15: free 결과와 동일한 일진/시드 컨텍스트를 자세히 보기에도 주입.
  // premium 빌더 시그니처는 그대로 두고 내부에서 derive — caller 영향 없음.
  // 2026-05-18: options.now 전달 (테스트 전용 fixed Date).
  const todayPillar = getTodayPillarSnapshot(sajuData, options);
  const dailyDelta = buildDailyDelta(todayPillar, sajuData);
  const flowSignal = buildTodayFlowSignal(todayPillar, sajuData);
  const signatureSeed = buildSignatureSeed(
    input,
    sajuData,
    { calendarType: 'solar', timeRule: 'standard' },
    todayPillar
  );
  const dailyContext: DailyContext = {
    todayPillar,
    signatureSeed,
    dailyDelta,
    flowSignal,
  };

  return {
    productCode: 'TODAY_DEEP_READING',
    // 2026-06-26 — 실제 차감(detail_report=10코인)과 표시 일치(기존 1 은 표시≠실제 불일치).
    coinCost: 10,
    dateKey: todayPillar.dateKey,
    groundingSummary: buildTodayGroundingSummary(
      grounding,
      kasiComparison,
      focusReport,
      sajuData
    ),
    favorableWindows: buildTimeWindows(concernId, focusReport, sajuData, 'favorable', dailyContext),
    cautionWindows: buildTimeWindows(concernId, focusReport, sajuData, 'caution', dailyContext),
    avoidActions: buildAvoidActions(concernId, focusReport, input, sajuData, dailyContext),
    recommendedActions: buildRecommendedActions(concernId, focusReport, sajuData, dailyContext),
    scenarios: buildScenarioComparison(concernId, focusReport, sajuData, dailyContext),
    evidenceLines: buildEvidenceLines(focusReport, todayReport, sajuData, Boolean(input.unknownTime)),
    followUpQuestions: concern.followUpQuestions,
    safetyNote:
      concernId === 'energy_health'
        ? '건강운은 질병 진단이 아니라 컨디션, 휴식, 생활 리듬을 읽는 참고 조언으로 제한합니다.'
        : concernId === 'money_spend'
          ? '재물운은 투자 종목이나 매수·매도 지시가 아니라 돈이 새기 쉬운 패턴과 정산 타이밍을 읽는 참고 조언입니다.'
          : '관계와 선택의 흐름을 읽는 참고 해석이며, 이별·파혼·법적 판단처럼 큰 결론을 단정하지 않습니다.',
    // 2026-06-24 — 오늘 일진 풀이를 premium 에도 통합(근인: free 만 쓰고 premium 은 미사용 →
    //   결제 풀이가 매일 동일). 매일 다른 일진 → 발동 케이스 → 메시지. premium 은 topN=5 로 더 깊게,
    //   seed 에 'premium' prefix 로 free 와 다른 variant 노출.
    todayIljinReading: (() => {
      if (!todayPillar.stem || !todayPillar.branch) return null;
      const { lucky, unlucky } = deriveLuckyElements(sajuData);
      const sajuOrigin = buildSajuOriginForIljin(sajuData, lucky, unlucky);
      const picked = pickIljinMessages(
        sajuOrigin,
        todayPillar.stem as IljinStem,
        todayPillar.branch as IljinBranch,
        { name: input.name ?? '선생님', element: sajuData.fiveElements.weakest },
        `premium::${todayPillar.dateKey}::${sajuData.pillars.day.ganzi}`,
        5
      );
      if (picked.messages.length === 0) return null;
      const iljinScore = computeSajuIljinScore(sajuData, options);
      return {
        ganzi: todayPillar.ganzi,
        score: iljinScore?.totalScore ?? null,
        messages: picked.messages,
      };
    })(),
  };
}

export function buildBirthInputFromTodayPayload(
  payload: TodayFortuneBirthPayload
): Omit<TodayFortuneBuildOptions, 'sourceSessionId' | 'counselorId'> & {
  birthDraft: {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    gender: string;
    birthLocationCode: string;
    birthLocationLabel: string;
    birthLatitude: string;
    birthLongitude: string;
    unknownTime: boolean;
    jasiMethod: 'split' | 'unified';
    solarTimeMode: 'standard' | 'longitude';
  };
} {
  const timeRule = payload.timeRule;
  const unknownBirthTime = payload.unknownBirthTime;
  const hasLocation = Boolean(payload.birthLocationCode);
  const useLongitude = timeRule === 'trueSolarTime' && hasLocation;
  const usesSplit = timeRule === 'earlyZi';

  return {
    concernId: payload.concernId,
    calendarType: payload.calendarType,
    timeRule,
    birthDraft: {
      year: payload.year,
      month: payload.month,
      day: payload.day,
      hour: payload.hour,
      minute: payload.minute,
      gender: payload.gender,
      birthLocationCode: payload.birthLocationCode,
      birthLocationLabel: payload.birthLocationLabel,
      birthLatitude: payload.birthLatitude,
      birthLongitude: payload.birthLongitude,
      unknownTime: unknownBirthTime,
      jasiMethod: usesSplit ? 'split' : 'unified',
      solarTimeMode: useLongitude ? 'longitude' : 'standard',
    },
  };
}
