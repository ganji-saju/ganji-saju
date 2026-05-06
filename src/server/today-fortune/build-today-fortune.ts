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
import { resolveMoonlightCounselor, type MoonlightCounselorId } from '@/lib/counselors';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import { selectUpsell } from '@/lib/upsell';
import { getTodayConcern } from '@/lib/today-fortune/concerns';
import type {
  ConcernId,
  TodayCalendarType,
  TodayFortuneBirthPayload,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
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
    favorableTail: '짧은 안부나 확인처럼 부담이 낮은 표현부터 꺼내는 편이 맞습니다.',
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
    favorableTitle: '기준과 역할을 먼저 세우기 좋은 시간',
    favorableTail: '회의나 계약은 결론보다 조건과 책임 범위를 선명히 하는 쪽이 더 강합니다.',
    cautionTitle: '확답이 부담으로 남기 쉬운 시간',
    cautionTail: '합의가 덜 된 상태에서 바로 확답하거나 서명하는 흐름은 조심해야 합니다.',
    actNowTitle: '오늘 미팅을 바로 진행할 때',
    waitTitle: '한 번 더 조율하고 진행할 때',
    actNowTail: '기준과 역할만 분명하면 속도는 충분히 붙습니다.',
    waitTail: '수정안과 다음 약속을 함께 잡으면 주도권을 덜 잃습니다.',
  },
  relationship_conflict: {
    favorableTitle: '말의 순서를 조율하기 좋은 시간',
    favorableTail: '큰 대화보다 짧은 확인과 사실 정리를 먼저 두는 편이 흐름을 덜 흔듭니다.',
    cautionTitle: '서운함이 결론처럼 커지기 쉬운 시간',
    cautionTail: '단정형 표현이나 감정의 잔상을 크게 남기는 말은 줄이는 편이 좋습니다.',
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
    actNowTail: '작게라도 먼저 끝내는 행동이 하루 전체의 기준을 만들어 줍니다.',
    waitTail: '우선순위를 먼저 세우면 뒤쪽 선택이 훨씬 가벼워집니다.',
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
    caution: '서운한 마음을 결론처럼 말하면 길어질 수 있어 표현을 낮춰보세요.',
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

function clampScore(value: number) {
  return Math.max(48, Math.min(92, Math.round(value)));
}

function compactStrings(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
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

function stripEvidenceBoilerplate(text: string) {
  return simplifySajuCopy(text)
    .replace(/^쉽게 말하면\s*/g, '')
    .replace(/^전문적으로는\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizeEvidenceTitleForSentence(
  key: ReportEvidenceCard['key'],
  title: string
) {
  if (key === 'strength') {
    return title.replace(/\s*·\s*/g, ' ');
  }

  return title.replace(/\s*·\s*/g, ' · ');
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
  const withoutScorePrefix = description.replace(/^[^.!?]+점 기준입니다\.\s*/, '').trim();
  const withoutEvidence = evidenceSnippet
    ? withoutScorePrefix.replace(evidenceSnippet, '').trim()
    : withoutScorePrefix;

  return joinUniqueSentences([withoutEvidence]);
}

function getScore(report: SajuReport, key: ReportScore['key']) {
  return report.scores.find((item) => item.key === key);
}

function buildConditionScore(
  todayReport: SajuReport,
  loveReport: SajuReport,
  wealthReport: SajuReport,
  sajuData: SajuDataV1
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

function buildReasonSnippet(
  evidenceCard: ReportEvidenceCard | undefined,
  unknownBirthTime: boolean
) {
  const defaultBase =
    '오늘은 내 기운의 균형과 현재 흐름을 함께 보고, 관계와 돈, 말의 속도를 현실적으로 조절하는 날입니다.';

  const normalizedTitle = evidenceCard?.title?.replace(/\s*·\s*/g, ' ').trim();
  const normalizedBody = evidenceCard?.body ? stripEvidenceBoilerplate(evidenceCard.body) : '';

  let base = defaultBase;
  if (evidenceCard && normalizedTitle && normalizedBody) {
    const sentenceTitle = normalizeEvidenceTitleForSentence(evidenceCard.key, normalizedTitle);

    switch (evidenceCard.key) {
      case 'strength':
        base = `${evidenceCard.label}은 ${withKoreanParticle(sentenceTitle, '으로', '로')} 보이며 ${normalizedBody}`;
        break;
      case 'pattern':
        base = `${evidenceCard.label}은 ${sentenceTitle} 흐름으로 보이며 ${normalizedBody}`;
        break;
      case 'yongsin':
        base = `${evidenceCard.label}은 ${sentenceTitle} 쪽을 보완 힌트로 보며 ${normalizedBody}`;
        break;
      case 'relations':
        base = `${evidenceCard.label}은 ${sentenceTitle}로 읽히고 ${normalizedBody}`;
        break;
      default:
        base = `${evidenceCard.label}은 ${sentenceTitle}로 읽으며 ${normalizedBody}`;
        break;
    }
  } else if (evidenceCard?.plainSummary || evidenceCard?.technicalSummary || evidenceCard?.body) {
    base = stripEvidenceBoilerplate(
      evidenceCard.plainSummary || evidenceCard.technicalSummary || evidenceCard.body
    );
  }

  if (!unknownBirthTime) return polishFortuneCopy(base);

  return polishFortuneCopy(
    `${base} 다만 태어난 시간이 없어 시간대별 세부 흐름은 보수적으로 줄여 읽습니다.`
  );
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
  sajuData: SajuDataV1
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

function buildOpportunityBody(
  concernId: ConcernId,
  focusReport: SajuReport,
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const evidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const actionLead = compactActionDescription(
    focusReport.primaryAction.description,
    evidenceSnippet
  );
  const leadHint = getEvidenceActionHints(focusReport, 'lead', 1)[0];
  const luckFact = getLuckFactLine(sajuData);

  return joinUniqueSentences([
    evidenceSnippet,
    actionLead,
    leadHint ? `오늘은 "${leadHint}"부터 먼저 잡는 편이 좋습니다.` : null,
    luckFact ? `지금은 ${luckFact}을 함께 보며 ${concernCopy.favorableTail}` : concernCopy.favorableTail,
  ]);
}

function buildRiskBody(
  concernId: ConcernId,
  focusReport: SajuReport,
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const cautionCard = getTodayEvidenceCard(focusReport, 'caution');
  const evidenceSnippet = cautionCard ? toEvidenceSnippet(cautionCard) : null;
  const actionLead = compactActionDescription(
    focusReport.cautionAction.description,
    evidenceSnippet
  );
  const cautionHint = getEvidenceActionHints(focusReport, 'caution', 1)[0];
  const luckFact = getLuckFactLine(sajuData);

  return joinUniqueSentences([
    evidenceSnippet,
    actionLead,
    cautionHint ? `오늘은 ${withKoreanParticle(`"${cautionHint}"`, '을', '를')} 놓치면 흐름이 급히 거칠어질 수 있습니다.` : null,
    luckFact ? `지금은 ${luckFact}이 겹쳐 보여 단기 반응을 크게 믿지 않는 편이 안전합니다.` : concernCopy.cautionTail,
  ].map((part) => (part ? polishFortuneCopy(part) : part)));
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

function getLuckFactLine(sajuData: SajuDataV1) {
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

function buildLeadNarrative(report: SajuReport) {
  const baseSummary = report.summaryHighlights[0] ?? report.summary;
  const evidenceSnippet = getTodayEvidenceSnippet(report);

  if (!baseSummary) {
    return evidenceSnippet ?? '';
  }

  if (!evidenceSnippet) {
    return joinUniqueSentences([baseSummary]);
  }

  return joinUniqueSentences([baseSummary]);
}

function buildOneLineBody(
  concernId: ConcernId,
  concernLabel: string,
  focusReport: SajuReport,
  todayReport: SajuReport,
  counselorId: MoonlightCounselorId
) {
  const focusLead = buildLeadNarrative(focusReport);
  const todayLead = buildLeadNarrative(todayReport);

  switch (concernId) {
    case 'love_contact':
      return joinUniqueSentences([
        focusLead,
        counselorId === 'male'
          ? '먼저 닿는 말의 강도보다 속도를 조절하는 쪽이 낫습니다.'
          : '먼저 닿는 말의 온도와 속도를 맞추는 쪽이 훨씬 자연스럽습니다.',
      ]);
    case 'money_spend':
      return joinUniqueSentences([focusLead, '수입 확대보다 새는 돈을 막는 판단이 오늘 체감 차이를 크게 만듭니다.']);
    case 'work_meeting':
      return joinUniqueSentences([focusLead, '회의나 계약은 결론을 서두르기보다 먼저 기준을 분명히 세우는 편이 좋습니다.']);
    case 'relationship_conflict':
      return joinUniqueSentences([focusLead, '감정을 크게 키우기보다 질문 한 마디로 온도를 낮추는 쪽이 안전합니다.']);
    case 'energy_health':
      return joinUniqueSentences([
        todayLead,
        '몸을 쓰는 시간과 쉬어야 할 구간을 나눠 쓰는 것이 중요합니다.',
      ]);
    case 'general':
    default:
      return joinUniqueSentences([
        `${concernLabel}으로 읽으면 ${todayLead}`,
      ]);
  }
}

function getTimeBlockBaseScore(report: SajuReport) {
  const focusScore = getScore(report, report.focusScoreKey);
  return focusScore?.score ?? getScore(report, 'overall')?.score ?? 70;
}

function getTimeBlockCalculatedAt(
  sajuData: SajuDataV1,
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
  sajuData: SajuDataV1,
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
  sajuData: SajuDataV1
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
    .map((detail) => `${detail.slot} ${detail.branch}와 ${detail.label}`)
    .slice(0, 2);
  const cautionLabels = details
    .filter((detail) => detail.tone === 'caution')
    .map((detail) => `${detail.slot} ${detail.branch}와 ${detail.label}`)
    .slice(0, 2);

  return {
    totalDelta,
    supportLabels,
    cautionLabels,
  };
}

function getTimeBlockElementImpact(sajuData: SajuDataV1, stemElement: Element, branchElement: Element) {
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

function buildTimeBlockEvaluations(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1
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
    const score = clampScore(baseScore + elementImpact.delta + relationImpact.totalDelta);
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
        `${timePillar.timeGanzi}시에는 ${timePillar.branchElement} 기운이 전면에 서서 오늘 흐름의 결을 바꿉니다.`,
        ...elementImpact.supportLines,
        relationImpact.supportLabels[0]
          ? `${relationImpact.supportLabels.join(', ')}이 들어와 말이나 결정이 묶이는 힘을 더합니다.`
          : null,
      ],
      2
    ).join(' ');
    const cautionSummary = uniqueStrings(
      [
        `${timePillar.timeGanzi}시는 ${timePillar.branchElement} 기운이 튀어나와 감정이나 판단이 과해지기 쉬운 블록입니다.`,
        ...elementImpact.cautionLines,
        relationImpact.cautionLabels[0]
          ? `${relationImpact.cautionLabels.join(', ')}이 겹치면 작은 반응도 크게 받아들이기 쉽습니다.`
          : null,
      ],
      2
    ).join(' ');
    const relationSummary =
      relationImpact.supportLabels[0] || relationImpact.cautionLabels[0]
        ? uniqueStrings([
            relationImpact.supportLabels[0]
              ? `${relationImpact.supportLabels.join(', ')}이 들어와 관계가 묶이는 쪽으로 작동합니다.`
              : null,
            relationImpact.cautionLabels[0]
              ? `${relationImpact.cautionLabels.join(', ')}이 겹치면 말의 여파가 오래 남기 쉽습니다.`
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
  type: 'favorable' | 'caution'
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

  return limitEasyTimeSentences(
    joinUniqueSentences([branchBody, concernBody, hintBody, scoreBody]),
    3
  );
}

function toTodayScores(
  todayReport: SajuReport,
  loveReport: SajuReport,
  wealthReport: SajuReport,
  careerReport: SajuReport,
  relationshipReport: SajuReport,
  conditionScore: number
): TodayScoreItem[] {
  const baseScores: TodayScoreItem[] = [
    getScore(todayReport, 'overall'),
    getScore(loveReport, 'love'),
    getScore(wealthReport, 'wealth'),
    getScore(careerReport, 'career'),
    getScore(relationshipReport, 'relationship'),
  ]
    .filter((score): score is ReportScore => Boolean(score))
    .map((score) => ({
      key: score.key as TodayScoreItem['key'],
      label: SCORE_LABELS[score.key],
      score: score.score,
      summary: score.summary,
    }));

  baseScores.push({
    key: 'condition',
    label: SCORE_LABELS.condition,
    score: conditionScore,
    summary: '과로보다 리듬 조절이 중요합니다.',
  });

  return baseScores;
}

function buildTimeWindows(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1,
  type: 'favorable' | 'caution'
): TodayTimeWindow[] {
  const evaluations = pickTimeBlockWindows(buildTimeBlockEvaluations(concernId, report, sajuData), type);

  return evaluations.map((item) => ({
    range: item.range,
    mood: type,
    title: buildTimeWindowTitle(item, type),
    body: buildTimeWindowBody(concernId, item, type),
  }));
}

function buildScenarioComparison(
  concernId: ConcernId,
  report: SajuReport,
  sajuData: SajuDataV1
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

  return [
    {
      title: concernCopy.actNowTitle,
      better: joinUniqueSentences([
        evidenceSnippet,
        primaryAction,
        leadHint ? `특히 "${leadHint}"부터 잡고 들어가면 흐름을 덜 놓칩니다.` : null,
        concernCopy.actNowTail,
      ]),
      watch: joinUniqueSentences([
        cautionAction,
        cautionHint ? `${withKoreanParticle(`"${cautionHint}"`, '을', '를')} 같이 놓치면 작은 선택도 피로로 바뀌기 쉽습니다.` : null,
        luckFact ? `특히 ${luckFact}이 겹친 날이라 단기 반응을 과신하지 않는 편이 좋습니다.` : null,
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
  sajuData: SajuDataV1,
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

function buildRecommendedActions(
  concernId: ConcernId,
  focusReport: SajuReport,
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const leadHints = getEvidenceActionHints(focusReport, 'lead', 3);
  const leadEvidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const primaryAction = compactActionDescription(
    focusReport.primaryAction.description,
    leadEvidenceSnippet
  );
  const actions = uniqueStrings(
    [
      primaryAction,
      ...leadHints.map((item) => `${item} 흐름부터 먼저 잡아보세요.`),
      getLuckFactLine(sajuData)
        ? `지금은 ${getLuckFactLine(sajuData)}을 같이 보며 ${concernCopy.favorableTail}`
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
  sajuData: SajuDataV1
) {
  const concernCopy = CONCERN_WINDOW_COPY[concernId];
  const cautionHints = getEvidenceActionHints(focusReport, 'caution', 3);
  const cautionEvidenceSnippet = getTodayEvidenceSnippet(focusReport);
  const cautionAction = compactActionDescription(
    focusReport.cautionAction.description,
    cautionEvidenceSnippet
  );
  const actions = uniqueStrings(
    [
      cautionAction,
      ...cautionHints.map((item) => `${item}을 놓친 채 무리하게 진행하지 않는 편이 좋습니다.`),
      input.unknownTime
        ? '태어난 시간이 없으니 세부 타이밍보다 전체 흐름을 먼저 보는 편이 안전합니다.'
        : getLuckFactLine(sajuData)
          ? `${getLuckFactLine(sajuData)}이 겹친 날이라 반응이 좋더라도 같은 속도로 하루 종일 밀지 않는 편이 낫습니다.`
          : concernCopy.cautionTail,
    ],
    3
  );

  return actions;
}

export function buildTodayFortuneFreeResult(
  input: BirthInput,
  sajuData: SajuDataV1,
  options: TodayFortuneBuildOptions
): TodayFortuneFreeResult {
  const concern = getTodayConcern(options.concernId);
  const counselorId = resolveMoonlightCounselor(options.counselorId);
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');
  const reportByTopic = {
    today: todayReport,
    love: loveReport,
    wealth: wealthReport,
    career: careerReport,
    relationship: relationshipReport,
  } as const;
  const focusReport = reportByTopic[concern.focusTopic];
  const conditionScore = buildConditionScore(todayReport, loveReport, wealthReport, sajuData);
  const scores = toTodayScores(
    todayReport,
    loveReport,
    wealthReport,
    careerReport,
    relationshipReport,
    conditionScore
  );
  const reasonBody = buildReasonSnippet(focusReport.evidenceCards[0], Boolean(input.unknownTime));
  const groundingSummary = buildTodayGroundingSummary(
    options.grounding,
    options.kasiComparison,
    focusReport,
    sajuData
  );
  const upsell = selectUpsell({ scores }, options.concernId);

  return {
    sourceSessionId: options.sourceSessionId,
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
      headline: focusReport.headline,
      body: buildOneLineBody(options.concernId, concern.label, focusReport, todayReport, counselorId),
    },
    scores,
    opportunity: {
      title: `${concern.shortLabel} 쪽 기회`,
      body: buildOpportunityBody(options.concernId, focusReport, sajuData),
    },
    risk: {
      title: `${concern.shortLabel} 쪽 주의`,
      body: buildRiskBody(options.concernId, focusReport, sajuData),
    },
    reasonSnippet: {
      title: '사주 근거 한 줄',
      body: reasonBody,
    },
    groundingSummary,
    nextAction: {
      copy: upsell.copy,
      product: 'TODAY_DEEP_READING',
      coinCost: 1,
    },
    followUpQuestions: concern.followUpQuestions,
  };
}

export function buildTodayFortunePremiumResult(
  input: BirthInput,
  sajuData: SajuDataV1,
  concernId: ConcernId,
  grounding?: SajuInterpretationGrounding | null,
  kasiComparison?: KasiSingleInputComparison | null
): TodayFortunePremiumResult {
  const concern = getTodayConcern(concernId);
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const focusReport =
    concern.focusTopic === 'today'
      ? todayReport
      : buildSajuReport(input, sajuData, concern.focusTopic);

  return {
    productCode: 'TODAY_DEEP_READING',
    coinCost: 1,
    groundingSummary: buildTodayGroundingSummary(
      grounding,
      kasiComparison,
      focusReport,
      sajuData
    ),
    favorableWindows: buildTimeWindows(concernId, focusReport, sajuData, 'favorable'),
    cautionWindows: buildTimeWindows(concernId, focusReport, sajuData, 'caution'),
    avoidActions: buildAvoidActions(concernId, focusReport, input, sajuData),
    recommendedActions: buildRecommendedActions(concernId, focusReport, sajuData),
    scenarios: buildScenarioComparison(concernId, focusReport, sajuData),
    evidenceLines: buildEvidenceLines(focusReport, todayReport, sajuData, Boolean(input.unknownTime)),
    followUpQuestions: concern.followUpQuestions,
    safetyNote:
      concernId === 'energy_health'
        ? '건강운은 질병 진단이 아니라 컨디션, 휴식, 생활 리듬을 읽는 참고 조언으로 제한합니다.'
        : concernId === 'money_spend'
          ? '재물운은 투자 종목이나 매수·매도 지시가 아니라 돈이 새기 쉬운 패턴과 정산 타이밍을 읽는 참고 조언입니다.'
          : '관계와 선택의 흐름을 읽는 참고 해석이며, 이별·파혼·법적 판단처럼 큰 결론을 단정하지 않습니다.',
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
