import type { SajuDataV1, SajuMajorLuckCycle } from '@/domain/saju/engine/saju-data-v1';
import {
  ELEMENT_INFO,
  getLuckyElementsFromSajuData,
  getPersonalityFromSajuData,
} from '@/lib/saju/elements';
import type { BirthInput, Element } from '@/lib/saju/types';
import { buildSajuReport } from './build-report';
import { buildYearlyReport } from './build-yearly-report';
import type {
  LifetimeKeyword,
  LifetimeLuckPhase,
  LifetimeMajorLuckCycle as LifetimeMajorLuckCycleRow,
  SajuLifetimeReport,
} from './lifetime-types';

function compactStrings(values: Array<string | null | undefined | false>) {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

function formatElementName(element: Element) {
  return ELEMENT_INFO[element].name.split(' ')[0] ?? element;
}

function formatSymbolList(symbols: Array<{ label: string }> | null | undefined) {
  return symbols && symbols.length > 0 ? symbols.map((symbol) => symbol.label).join(' · ') : '';
}

function formatLuckRange(cycle: { startAge: number | null; endAge: number | null }) {
  if (cycle.startAge === null && cycle.endAge === null) return '나이 미산정';
  if (cycle.startAge !== null && cycle.endAge !== null) return `${cycle.startAge}-${cycle.endAge}세`;
  if (cycle.startAge !== null) return `${cycle.startAge}세 이후`;
  return `${cycle.endAge}세 이전`;
}

const STEM_ELEMENT_BY_SYMBOL: Record<string, Element> = {
  甲: '목',
  乙: '목',
  丙: '화',
  丁: '화',
  戊: '토',
  己: '토',
  庚: '금',
  辛: '금',
  壬: '수',
  癸: '수',
  갑: '목',
  을: '목',
  병: '화',
  정: '화',
  무: '토',
  기: '토',
  경: '금',
  신: '금',
  임: '수',
  계: '수',
};

const BRANCH_ELEMENT_BY_SYMBOL: Record<string, Element> = {
  寅: '목',
  卯: '목',
  巳: '화',
  午: '화',
  辰: '토',
  戌: '토',
  丑: '토',
  未: '토',
  申: '금',
  酉: '금',
  子: '수',
  亥: '수',
  인: '목',
  묘: '목',
  사: '화',
  오: '화',
  진: '토',
  술: '토',
  축: '토',
  미: '토',
  신: '금',
  유: '금',
  자: '수',
  해: '수',
};

const BRANCH_LUCK_HINT_BY_SYMBOL: Record<string, string> = {
  子: '마음과 정보의 흐름이 자주 바뀔 수 있어, 중요한 약속과 돈의 흐름은 기록으로 남기는 습관이 필요합니다.',
  亥: '멀리 보거나 방향을 바꾸고 싶은 마음이 커질 수 있어, 바로 움직이기보다 준비 시간을 충분히 두는 편이 좋습니다.',
  寅: '새로운 일을 열 힘이 붙는 구간이라, 처음 만나는 사람과 배움이 이후 흐름을 크게 바꿀 수 있습니다.',
  卯: '관계와 협업의 영향이 커지므로, 혼자 밀어붙이기보다 함께 갈 사람을 고르는 기준이 중요합니다.',
  巳: '속도와 표현이 빨라질 수 있어, 말하기 전 한 번 정리하고 결정 전 한 번 확인하는 습관이 도움이 됩니다.',
  午: '주목과 성과가 앞으로 나오기 쉬워, 체력과 감정의 과열을 조절해야 좋은 결과가 오래 갑니다.',
  辰: '쌓아 둔 역할과 생활 기반을 다시 점검하는 구간이라, 미뤄 둔 정리와 구조 조정이 흐름을 가볍게 만듭니다.',
  戌: '마무리와 경계선이 중요한 구간이라, 애매하게 이어 온 일과 관계를 분명히 정리하는 편이 좋습니다.',
  丑: '저장하고 버티는 힘이 커지는 구간이라, 돈과 생활 루틴을 안정적으로 묶어 두면 다음 선택이 편해집니다.',
  未: '돌봄, 가족, 오래된 책임이 함께 올라올 수 있어, 내가 맡을 것과 나눌 것을 구분해야 지치지 않습니다.',
  申: '일, 기술, 거래처럼 실무 기준이 중요해져서, 작은 실수도 절차와 확인으로 줄이는 편이 좋습니다.',
  酉: '판단과 마감의 힘이 강해지므로, 끊고 남기는 기준을 세우되 말투는 부드럽게 조절하는 편이 좋습니다.',
  자: '마음과 정보의 흐름이 자주 바뀔 수 있어, 중요한 약속과 돈의 흐름은 기록으로 남기는 습관이 필요합니다.',
  해: '멀리 보거나 방향을 바꾸고 싶은 마음이 커질 수 있어, 바로 움직이기보다 준비 시간을 충분히 두는 편이 좋습니다.',
  인: '새로운 일을 열 힘이 붙는 구간이라, 처음 만나는 사람과 배움이 이후 흐름을 크게 바꿀 수 있습니다.',
  묘: '관계와 협업의 영향이 커지므로, 혼자 밀어붙이기보다 함께 갈 사람을 고르는 기준이 중요합니다.',
  사: '속도와 표현이 빨라질 수 있어, 말하기 전 한 번 정리하고 결정 전 한 번 확인하는 습관이 도움이 됩니다.',
  오: '주목과 성과가 앞으로 나오기 쉬워, 체력과 감정의 과열을 조절해야 좋은 결과가 오래 갑니다.',
  진: '쌓아 둔 역할과 생활 기반을 다시 점검하는 구간이라, 미뤄 둔 정리와 구조 조정이 흐름을 가볍게 만듭니다.',
  술: '마무리와 경계선이 중요한 구간이라, 애매하게 이어 온 일과 관계를 분명히 정리하는 편이 좋습니다.',
  축: '저장하고 버티는 힘이 커지는 구간이라, 돈과 생활 루틴을 안정적으로 묶어 두면 다음 선택이 편해집니다.',
  미: '돌봄, 가족, 오래된 책임이 함께 올라올 수 있어, 내가 맡을 것과 나눌 것을 구분해야 지치지 않습니다.',
  신: '일, 기술, 거래처럼 실무 기준이 중요해져서, 작은 실수도 절차와 확인으로 줄이는 편이 좋습니다.',
  유: '판단과 마감의 힘이 강해지므로, 끊고 남기는 기준을 세우되 말투는 부드럽게 조절하는 편이 좋습니다.',
};

const ELEMENT_LUCK_READING: Record<
  Element,
  {
    phase: Exclude<LifetimeLuckPhase, '전환기'>;
    summary: string;
    task: string;
    supportTask: string;
    dominantTask: string;
  }
> = {
  목: {
    phase: '성장기',
    summary: '새로운 배움, 사람, 방향이 열리기 쉬운 구간입니다.',
    task: '처음부터 크게 넓히기보다 새 인연과 공부를 작게 시험해 보고, 오래 갈 방향만 남기는 편이 좋습니다.',
    supportTask: '부족했던 성장 축을 채우는 시기라 새 기술, 새 관계, 새 루틴을 작게 시작할수록 이후 흐름이 부드러워집니다.',
    dominantTask: '이미 커진 성장 욕구가 더 강해질 수 있어, 벌이는 일보다 마무리할 일을 먼저 정해야 흔들림이 줄어듭니다.',
  },
  화: {
    phase: '표현기',
    summary: '말, 평판, 성과처럼 바깥으로 드러나는 일이 커지기 쉬운 구간입니다.',
    task: '보여줄 것과 아껴둘 것을 구분하고, 성급한 반응보다 확인된 결과를 앞세우는 편이 좋습니다.',
    supportTask: '표현과 추진력이 보완되는 시기라 발표, 홍보, 관계 회복처럼 밖으로 꺼내야 할 일을 미루지 않는 편이 좋습니다.',
    dominantTask: '이미 뜨거운 기운이 더 빨라질 수 있어, 말과 결정의 속도를 낮추고 체력 회복 시간을 먼저 확보해야 합니다.',
  },
  토: {
    phase: '기반기',
    summary: '생활 기반, 책임, 자리 잡기가 중요한 구간입니다.',
    task: '한 번에 바꾸려 하기보다 집, 일, 돈, 관계의 기본 구조를 단단하게 정리해야 다음 선택이 편해집니다.',
    supportTask: '흩어진 생활을 묶어 주는 힘이 들어오므로, 계약·저축·거주·가족 역할처럼 오래 남을 기준을 세우기 좋습니다.',
    dominantTask: '책임이 무거워지거나 고집으로 굳기 쉬우니, 혼자 떠안기보다 역할을 나누는 기준을 먼저 정해야 합니다.',
  },
  금: {
    phase: '결정기',
    summary: '정리, 선택, 기준 세우기가 강해지는 구간입니다.',
    task: '관계를 끊거나 일을 마감하기 전에 무엇을 남길지 먼저 정하면, 결정이 날카로움보다 실속으로 이어집니다.',
    supportTask: '기준을 세우는 힘이 보완되는 시기라 미뤄둔 정리, 계약, 경계선 세우기를 차분히 진행하기 좋습니다.',
    dominantTask: '판단이 강해져 말이나 결정이 차갑게 보일 수 있으니, 정리하더라도 설명과 여지를 남기는 편이 좋습니다.',
  },
  수: {
    phase: '준비기',
    summary: '정보, 이동, 마음의 방향을 다시 살피는 구간입니다.',
    task: '겉으로 성과를 재촉하기보다 배울 것, 만날 사람, 옮길 타이밍을 조용히 준비하면 다음 구간의 선택지가 넓어집니다.',
    supportTask: '부족했던 유연함이 채워지는 시기라 쉬어 가며 정보를 모으고, 감정과 상황을 다시 읽는 시간이 도움이 됩니다.',
    dominantTask: '생각이 많아져 결정이 늦어질 수 있으니, 고민을 기록하고 날짜를 정해 하나씩 결론 내리는 편이 좋습니다.',
  },
};

function getGanziElements(ganzi: string): { stem: Element | null; branch: Element | null } {
  const chars = Array.from(ganzi);

  return {
    stem: chars[0] ? (STEM_ELEMENT_BY_SYMBOL[chars[0]] ?? null) : null,
    branch: chars[1] ? (BRANCH_ELEMENT_BY_SYMBOL[chars[1]] ?? null) : null,
  };
}

function buildMajorLuckReading(
  cycle: SajuMajorLuckCycle,
  isCurrent: boolean,
  context: {
    supportElements: Element[];
    dominant: Element;
    weakest: Element;
  }
): { phase: LifetimeLuckPhase; summary: string; task: string } {
  const { stem, branch } = getGanziElements(cycle.ganzi);
  const branchSymbol = Array.from(cycle.ganzi)[1] ?? '';
  const primaryElement = stem ?? branch ?? context.weakest;
  const secondaryElement = branch && branch !== primaryElement ? branch : null;
  const base = ELEMENT_LUCK_READING[primaryElement];
  const isSupportFlow =
    context.supportElements.includes(primaryElement) ||
    (secondaryElement ? context.supportElements.includes(secondaryElement) : false);
  const isDominantFlow =
    primaryElement === context.dominant || (secondaryElement ? secondaryElement === context.dominant : false);
  const phase = isCurrent ? '전환기' : base.phase;
  const elementLine = secondaryElement
    ? `${formatElementName(primaryElement)} 기운에 ${formatElementName(secondaryElement)} 기운이 섞여`
    : `${formatElementName(primaryElement)} 기운이 중심이 되어`;
  const relationLine = isSupportFlow
    ? '내 사주에서 보완이 되는 축이라 잘 쓰면 부족했던 부분을 채워 주는 흐름입니다.'
    : isDominantFlow
      ? '이미 강한 축이 더 커지는 흐름이라 장점은 빨리 드러나지만 과하면 피로와 고집도 함께 커질 수 있습니다.'
      : '내 사주의 강한 축과 약한 축 사이를 이어 주는 흐름이라, 생활 방식과 관계 선택을 조정하는 일이 중요합니다.';
  const baseTask = isSupportFlow ? base.supportTask : isDominantFlow ? base.dominantTask : base.task;
  const branchHint = BRANCH_LUCK_HINT_BY_SYMBOL[branchSymbol] ?? '';
  const task = compactStrings([baseTask, branchHint]).join(' ');

  return {
    phase,
    summary: `${elementLine} ${base.summary} ${relationLine}`,
    task: isCurrent
      ? `${task} 지금은 이 흐름이 현재 선택과 관계 조정에 직접 작동하므로, 당장 결론보다 순서와 이유를 먼저 확인하는 편이 좋습니다.`
      : task,
  };
}

function getCurrentKoreaYear() {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date());
  const parsed = Number.parseInt(formatted, 10);

  return Number.isInteger(parsed) ? parsed : new Date().getFullYear();
}

function buildKeywords(input: {
  dayMasterStem: string;
  dayMasterMetaphor: string | null | undefined;
  dominant: string;
  weakest: string;
  supportLabels: string;
  currentMajorLuck: string | null;
}): LifetimeKeyword[] {
  return [
    {
      label: `${input.dayMasterStem} 일간`,
      reason: input.dayMasterMetaphor
        ? `${input.dayMasterMetaphor}의 상징으로 반응 속도와 자기 표현의 결을 읽습니다.`
        : `${input.dayMasterStem} 일간의 반응 방식이 삶 전체의 기준이 됩니다.`,
    },
    {
      label: `보완 축 ${input.supportLabels}`,
      reason: '평생 운은 강한 기운을 더 키우기보다, 이 보완 축을 생활 안에 안정적으로 들이는 쪽에서 좋아집니다.',
    },
    {
      label: `강한 축 ${input.dominant}`,
      reason: '잘 쓰면 장점이 빠르게 드러나지만, 과속하면 같은 기운이 피로와 고집으로 바뀌기 쉽습니다.',
    },
    {
      label: `약한 축 ${input.weakest}`,
      reason: '무너지기 쉬운 패턴은 대개 약한 축을 방치할 때 드러납니다. 보완 루틴을 먼저 잡아야 합니다.',
    },
    {
      label: input.currentMajorLuck ? `현재 ${input.currentMajorLuck} 대운` : '현재 대운',
      reason: '원국의 본질은 고정값이고, 대운은 그 본질이 어느 장면에서 크게 드러나는지를 바꾸는 배경입니다.',
    },
  ];
}

// 2026-05-15 PR 2 — 8단 sub-section 빌더 helpers.
// 사주아이 reference: hook(상황 호명) → chapterBody(상세) → mental(내면) → relationship(관계)
// → wealthCareer(돈/일) → practicalActions(개운법 4건) → closingNote(마지막).
// 현 단계는 룰 기반 텍스트 — PR 3 (카피 패턴) / PR 4 (개운법 3단) / PR 5 (사전) 에서 보강.

import type { UserSituation } from '@/lib/saju/types';
import type { PracticalAction } from './lifetime-types';

const RELATIONSHIP_LABEL: Record<NonNullable<UserSituation['relationshipStatus']>, string> = {
  single: '솔로',
  dating: '연애 중',
  married: '기혼',
  separated: '이별 정리 중',
};
const OCCUPATION_LABEL: Record<NonNullable<UserSituation['occupation']>, string> = {
  employee: '직장 다니시는',
  'self-employed': '자영업·프리랜서이신',
  student: '학생이신',
  homemaker: '가정 살림 중심으로 지내시는',
  'job-seeking': '구직 중이신',
  other: '활동 중이신',
};
const CONCERN_LABEL: Record<NonNullable<UserSituation['currentConcern']>, string> = {
  business: '사업·이직 고민',
  romance: '결혼·연애 고민',
  family: '자녀·가족 고민',
  health: '건강·멘탈 고민',
  wealth: '재물·투자 고민',
  other: '지금 마음에 머무는 고민',
};

function buildHookSentence(
  cycle: SajuMajorLuckCycle,
  isCurrent: boolean,
  context: { dominant: Element; weakest: Element },
  userSituation: UserSituation | null
): string {
  const ageRange = formatLuckRange(cycle);
  const ganzi = cycle.ganzi;
  const occ = userSituation?.occupation ? OCCUPATION_LABEL[userSituation.occupation] : null;
  const concern = userSituation?.currentConcern ? CONCERN_LABEL[userSituation.currentConcern] : null;
  const note = userSituation?.concernNote?.trim().slice(0, 60);
  const personalCue = occ ? `${occ} 분에게 ` : '';
  const concernCue = note ? `'${note}' 같은 ` : concern ? `${concern} 한 가운데 ` : '';

  if (isCurrent) {
    return `${personalCue}지금 진행 중인 ${ganzi} 대운(${ageRange})은 ${concernCue}일상의 무게와 직접 부딪는 10년입니다.`;
  }
  return `${personalCue}${ageRange}의 ${ganzi} 대운은 ${concernCue}10년 흐름의 결을 새로 잡는 챕터입니다.`;
}

function buildChapterBodyText(
  cycle: SajuMajorLuckCycle,
  reading: { summary: string },
  context: { supportElements: Element[]; dominant: Element; weakest: Element }
): string {
  const { stem, branch } = getGanziElements(cycle.ganzi);
  const noteJoin = cycle.notes.slice(0, 3).join(' ').trim();
  const stemLabel = stem ? formatElementName(stem) : '';
  const branchLabel = branch ? formatElementName(branch) : '';
  const headParts = compactStrings([
    stemLabel ? `천간의 ${stemLabel}` : null,
    branchLabel ? `지지의 ${branchLabel}` : null,
  ]).join(' · ');
  const head = headParts ? `${head_open(cycle)} ${headParts} 결이 함께 작동합니다.` : `${head_open(cycle)} 흐름이 함께 작동합니다.`;
  return compactStrings([head, noteJoin || null, reading.summary]).join(' ');
}

function head_open(cycle: SajuMajorLuckCycle): string {
  return `${cycle.ganzi} 대운에는`;
}

function buildMentalText(
  cycle: SajuMajorLuckCycle,
  context: { supportElements: Element[]; dominant: Element; weakest: Element }
): string {
  const { stem } = getGanziElements(cycle.ganzi);
  const element = stem ?? context.weakest;
  const isSupport = context.supportElements.includes(element);
  const isDominant = element === context.dominant;
  const elementLabel = formatElementName(element);

  if (isSupport) {
    return `이 대운의 ${elementLabel} 결은 내면의 빈 자리를 채워줍니다. 마음을 비우고 받아들이는 시간이 늘어나면 결정이 부드러워지고, 평소 무거웠던 일도 한 박자 가볍게 다룰 수 있는 시기입니다.`;
  }
  if (isDominant) {
    return `이미 강한 ${elementLabel} 축이 더 커지는 흐름이라 자신감과 추진력이 빠르게 살아납니다. 다만 너무 자기 기준만 밀면 피로가 누적되고 가까운 사람과 거리가 생기기 쉬워요. 의식적으로 한 박자 멈춰서 보세요.`;
  }
  return `${elementLabel} 결이 일상의 결정 방식을 흔드는 시기입니다. 익숙한 패턴 대신 새로운 방식이 자연스럽게 자리 잡으니, 변화의 결을 막지 말고 흐름에 맞춰 작은 루틴부터 정돈하면 마음이 편해집니다.`;
}

function buildRelationshipText(
  cycle: SajuMajorLuckCycle,
  context: { supportElements: Element[]; dominant: Element; weakest: Element },
  userSituation: UserSituation | null
): string {
  const status = userSituation?.relationshipStatus;
  const baseLine = `${cycle.ganzi} 대운의 결은 관계의 거리감과 표현 방식을 함께 흔듭니다.`;

  if (status === 'dating') {
    return `${baseLine} 연애 중이신 만큼 이 10년에는 상대와의 호흡 차이가 자주 드러납니다. 결론을 빠르게 내기보다 말의 순서와 일정 합의를 또렷이 두면 오해가 길어지지 않아요.`;
  }
  if (status === 'married') {
    return `${baseLine} 부부 관계라면 역할 분담과 생활 리듬이 새로 정의되는 시기입니다. 큰 결정은 함께 적어두고 시작하면 흔들림이 작아집니다.`;
  }
  if (status === 'single') {
    return `${baseLine} 솔로 상태라면 인연이 들어오는 결이 평소와 달라집니다. 이상형이 바뀔 수 있으니 평소 안 만나던 결의 사람과의 첫 만남을 너무 빠르게 닫지 마세요.`;
  }
  if (status === 'separated') {
    return `${baseLine} 정리 중인 관계라면 감정과 사실을 나눠 적어두는 게 가장 큰 보호막입니다. 이 10년은 같은 자리에서 결을 다시 짜는 시간입니다.`;
  }
  return `${baseLine} 가까운 사람과의 거리감, 말의 강도, 표현 빈도를 의식적으로 조절하면 관계의 온도가 안정됩니다.`;
}

function buildWealthCareerText(
  cycle: SajuMajorLuckCycle,
  context: { supportElements: Element[]; dominant: Element; weakest: Element },
  userSituation: UserSituation | null
): string {
  const occupation = userSituation?.occupation;
  const concern = userSituation?.currentConcern;
  const base = `${cycle.ganzi} 대운은 돈과 일의 결을 함께 재편합니다.`;

  if (occupation === 'self-employed' || concern === 'business') {
    return `${base} 자영업·프리랜서·새 사업 영역에서 흐름이 크게 흔들리는 시기입니다. 매출보다 단가·고정비·정산 주기를 먼저 점검하세요. 확장 전에 손익 구조를 한 줄로 정리할 수 있는지가 분기점입니다.`;
  }
  if (occupation === 'employee') {
    return `${base} 직장에서는 역할·평가·이직 타이밍이 평소보다 명확히 갈리는 10년입니다. 본인의 강점을 한 줄로 적어두고, 그 한 줄로 평가 받을 수 있는 기회를 가급적 잡으세요.`;
  }
  if (occupation === 'job-seeking' || concern === 'wealth') {
    return `${base} 수입원의 구조가 한 번에 정해질 수 있는 시기입니다. 큰 결정은 비교 후보 3개를 적어두고 들어가야 후회가 적어요. 무리한 투자보다 안정 현금 흐름이 우선입니다.`;
  }
  return `${base} 일에서는 새로 시작하는 일과 마무리할 일을 의식적으로 나누세요. 한쪽으로만 치우치면 10년 끝에 같은 자리에서 다시 시작하기 쉽습니다.`;
}

function buildPracticalActions(
  cycle: SajuMajorLuckCycle,
  context: { supportElements: Element[]; dominant: Element; weakest: Element }
): PracticalAction[] {
  const { stem, branch } = getGanziElements(cycle.ganzi);
  const supportLabel = formatElementName(context.supportElements[0] ?? context.weakest);
  const dominantLabel = formatElementName(context.dominant);
  const weakestLabel = formatElementName(context.weakest);
  const cycleLabel = formatElementName(stem ?? branch ?? context.weakest);

  return [
    {
      reason: `대운의 ${cycleLabel} 결이 들어오는 시기`,
      what: `${supportLabel} 축을 생활 안에서 챙기기`,
      how: `매일 같은 시간에 짧게 산책·정리 루틴 하나만 고정. 10년 단위 흐름에서는 작은 반복이 큰 차이를 만듭니다.`,
    },
    {
      reason: `강한 ${dominantLabel} 축이 더 커지는 패턴`,
      what: '한 박자 멈추고 점검하는 습관',
      how: '큰 결정 직전 1주일은 결정 미루기. 결정 사유를 한 줄로 적어두고 한 번 더 비교한 뒤 진행.',
    },
    {
      reason: `약한 ${weakestLabel} 축이 빈 자리`,
      what: '약한 축을 보완하는 환경/사람 선택',
      how: '평소 안 만나던 결의 사람·환경에 의식적으로 한 달에 1번씩 노출. 새 정보 채널 1개 고정 구독.',
    },
    {
      reason: '대운 cycle 안의 합·충 신호',
      what: '관계 거리감 미세 조정',
      how: '가까운 사람과의 약속을 한 줄로 적어두기. 정기 약속(주 1회)을 한 자리에만 두고 나머지는 가볍게 두기.',
    },
  ];
}

// 2026-05-15 PR 3 — 사주아이 reference 10 패턴 챕터명 빌더.
// 동일 패턴이라도 매번 같은 문장이 나오면 다시 generic 으로 느껴지므로
// cycle 의 ganzi 코드값을 seed 로 후보 풀에서 1개 선택.
type ChapterPattern =
  | 'signal'      // 시그널형 — 대운 시작
  | 'questionFomo' // 질문+FOMO — concern 호명
  | 'fomoAd'       // 감탄+FOMO — 전성기
  | 'hope'         // 희망형 — 진입기/support
  | 'transform'   // 변환형 — 결실/수익기
  | 'warning'     // 경고형 — 약점/주의기
  | 'reverse'    // 반전형 — dominant 과한 cycle
  | 'crisis'     // 위기형 — relationship 위험
  | 'empathy'    // 공감형 — 멘탈/내면
  | 'secret';    // 비밀형 — 개운법 부각

const CHAPTER_PATTERN_TEMPLATES: Record<ChapterPattern, string[]> = {
  signal: [
    '내 인생의 대격변, 새로운 10년의 문이 열렸어요',
    '큰 흐름이 갈리는 분기점, 다음 10년이 결정됩니다',
    '한 챕터가 닫히고 새 챕터가 열리는 결',
  ],
  questionFomo: [
    '{age} 한가운데, 이 결정에 인생을 걸어도 될까?',
    '{age}, 지금 안 움직이면 후회할 결의 시기',
    '{age}에 맞는 다음 한 수, 답을 찾아야 할 때',
  ],
  fomoAd: [
    '역대급 전성기! 올해 안 잡으면 평생 후회해요',
    '드디어 운이 내 편! 지금이 폭발할 타이밍입니다',
    '10년 중 가장 빛나는 결, 망설일 시간이 없어요',
  ],
  hope: [
    '터지기 일보 직전! 폭발적인 추진력이 붙는 결',
    '드디어 받쳐주는 흐름이 들어옵니다, 출발선에 서세요',
    '회복과 정리가 끝나고 본격 도약이 시작되는 시기',
  ],
  transform: [
    '현실적인 결과물이 쏟아진다! 수익 극대화의 타이밍',
    '쌓아둔 기반이 돈으로 바뀌는 결실의 10년',
    '눈에 보이는 성과로 변환되는 시기, 마무리를 챙기세요',
  ],
  warning: [
    '⚠️ 암흑기 주의보! 비바람을 피해 잠시 쉬어가야 할 때',
    '⚠️ 무리하지 말 것, 이 10년은 보존이 핵심입니다',
    '⚠️ 큰 결정 보류 신호 — 지금은 흔들리는 결',
  ],
  reverse: [
    '화려한 무대 뒤, 내실을 다져야 텅장을 면해요',
    '잘 풀릴수록 위험이 커지는 결 — 분산이 핵심',
    '강한 기운이 더 강해지는 시기, 과속을 경계하세요',
  ],
  crisis: [
    '{relationship}, 가까운 관계의 결이 흔들릴 수 있어요',
    '{relationship} 분에게 — 표현과 거리감을 새로 잡아야 할 시기',
    '관계의 온도가 바뀌는 결, 말의 강도를 한 단계 낮추세요',
  ],
  empathy: [
    '완벽주의 때문에 밤잠 설치는 당신에게',
    '혼자 다 짊어지려 했던 마음에 쉼표가 필요한 시기',
    '마음의 무게를 한 번 정리하고 가야 할 결',
  ],
  secret: [
    '대박 나는 비책, 이것만 지키면 흐름이 바뀝니다',
    '잘 풀리는 사람들의 공통 루틴, 이 10년의 핵심',
    '운명을 내 편으로 만드는 4가지 행동',
  ],
};

const RELATIONSHIP_TITLE_HINT: Record<NonNullable<UserSituation['relationshipStatus']>, string> = {
  single: '솔로 분',
  dating: '연애 중이신 분',
  married: '결혼하신 분',
  separated: '정리 중인 분',
};

const AGE_TITLE_HINT_BY_DECADE: Record<number, string> = {
  20: '20대 초반',
  25: '20대 중후반',
  30: '30대 초반',
  35: '30대 중후반',
  40: '40대 초반',
  45: '40대 중후반',
  50: '50대 초반',
  55: '50대 중후반',
  60: '60대 초반',
  65: '60대 중후반',
  70: '70대 이후',
};

function hintForAge(startAge: number | null | undefined): string {
  if (typeof startAge !== 'number') return '인생의 한 마디';
  const decade = Math.floor(startAge / 5) * 5;
  return AGE_TITLE_HINT_BY_DECADE[decade] ?? `${decade}대 무렵`;
}

function pickFromSeed(items: string[], seed: number): string {
  if (items.length === 0) return '';
  const index = Math.abs(seed) % items.length;
  return items[index] ?? items[0];
}

function ganziSeed(ganzi: string): number {
  return Array.from(ganzi).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function selectChapterPattern(
  cycle: SajuMajorLuckCycle,
  isCurrent: boolean,
  isFirstCycle: boolean,
  context: { supportElements: Element[]; dominant: Element; weakest: Element },
  userSituation: UserSituation | null
): ChapterPattern {
  const { stem, branch } = getGanziElements(cycle.ganzi);
  const element = stem ?? branch ?? context.weakest;
  const isSupport =
    context.supportElements.includes(element) ||
    (branch && stem ? context.supportElements.includes(branch) : false);
  const isDominant = element === context.dominant;
  const isWeakest = element === context.weakest;
  const concern = userSituation?.currentConcern ?? null;
  const status = userSituation?.relationshipStatus ?? null;

  // 1) 시그널형 — 첫 cycle (인생 초입 또는 처음 산출된 대운).
  if (isFirstCycle) return 'signal';

  // 2) 현재 cycle 우선순위 — Peak vs 경고 vs 반전 vs 위기.
  if (isCurrent) {
    if (isSupport && (concern === 'business' || concern === 'wealth')) return 'fomoAd';
    if (isSupport) return 'hope';
    if (isDominant) return 'reverse';
    if (isWeakest) return 'warning';
    if (status && (concern === 'romance' || concern === 'family')) return 'crisis';
    return 'questionFomo';
  }

  // 3) 비현재 cycle — element 결 + 사용자 입력 분기.
  if (isSupport && (concern === 'wealth' || concern === 'business')) return 'transform';
  if (isWeakest) return 'warning';
  if (isDominant) return 'reverse';
  if (status && (concern === 'romance' || concern === 'family')) return 'crisis';
  if (concern === 'health') return 'empathy';
  // 4) phase 가 결정기/표현기 면 변환·희망 톤 우선.
  if (cycle.notes.join(' ').includes('결실') || cycle.notes.join(' ').includes('수확')) return 'transform';
  // 5) 사용자 정보 거의 없는 일반 cycle → 비밀형으로 개운법 부각.
  return 'secret';
}

function fillTitleTemplate(
  template: string,
  cycle: SajuMajorLuckCycle,
  userSituation: UserSituation | null
): string {
  const status = userSituation?.relationshipStatus ?? null;
  return template
    .replace('{age}', hintForAge(cycle.startAge))
    .replace('{relationship}', status ? RELATIONSHIP_TITLE_HINT[status] : '관계 챙기는 분');
}

function buildChapterTitleText(
  cycle: SajuMajorLuckCycle,
  isCurrent: boolean,
  isFirstCycle: boolean,
  context: { supportElements: Element[]; dominant: Element; weakest: Element },
  userSituation: UserSituation | null
): string {
  const pattern = selectChapterPattern(cycle, isCurrent, isFirstCycle, context, userSituation);
  const candidates = CHAPTER_PATTERN_TEMPLATES[pattern];
  const seed = ganziSeed(cycle.ganzi) + (isCurrent ? 7 : 0);
  const template = pickFromSeed(candidates, seed);
  return fillTitleTemplate(template, cycle, userSituation);
}

function buildClosingNoteText(
  cycle: SajuMajorLuckCycle,
  context: { supportElements: Element[]; dominant: Element; weakest: Element },
  isCurrent: boolean
): string {
  const supportLabel = formatElementName(context.supportElements[0] ?? context.weakest);
  const head = isCurrent
    ? `${cycle.ganzi} 대운이 진행 중인 지금, `
    : `${cycle.ganzi} 대운이 다가오면, `;
  return `${head}절대 무리해서 한 번에 결정하지 마세요. 반드시 ${supportLabel} 결을 생활 루틴에 두고, 10년이라는 호흡을 길게 가져가면 이 흐름이 본인의 편이 됩니다.`;
}

function buildMajorLuckCycles(
  cycles: SajuMajorLuckCycle[] | null | undefined,
  currentMajorLuckGanzi: string | null,
  context: {
    supportElements: Element[];
    dominant: Element;
    weakest: Element;
  },
  // 2026-05-15 PR 2: 사용자 현재 상황 — 8단 sub-section 의 hook/relationship/wealthCareer 분기에 사용.
  userSituation: UserSituation | null = null
): LifetimeMajorLuckCycleRow[] {
  if (!cycles || cycles.length === 0) {
    return [
      {
        ganzi: '대운 미산정',
        ageLabel: '정보 부족',
        phase: '전환기',
        summary: '성별 또는 생시 정보가 부족해 대운 시작 시점을 세밀하게 산정하지 못했습니다.',
        task: '생시와 출생지를 보완하면 10년 흐름 지도를 더 선명하게 다시 볼 수 있습니다.',
        isCurrent: false,
      },
    ];
  }

  return cycles.slice(0, 10).map((cycle, index) => {
    const isCurrent = currentMajorLuckGanzi === cycle.ganzi;
    const isFirstCycle = index === 0;
    const note = cycle.notes.slice(0, 2).join(' ') || '이 시기의 10년 흐름입니다.';
    const reading = buildMajorLuckReading(cycle, isCurrent, context);

    return {
      ganzi: cycle.ganzi,
      ageLabel: formatLuckRange(cycle),
      phase: reading.phase,
      summary: `${note} ${reading.summary}`,
      task: reading.task,
      isCurrent,
      // 2026-05-15 PR 2 — 8 sub-section. PR 3 에서 chapterTitle 10 패턴 적용.
      hook: buildHookSentence(cycle, isCurrent, context, userSituation),
      chapterTitle: buildChapterTitleText(cycle, isCurrent, isFirstCycle, context, userSituation),
      chapterBody: buildChapterBodyText(cycle, reading, context),
      mental: buildMentalText(cycle, context),
      relationship: buildRelationshipText(cycle, context, userSituation),
      wealthCareer: buildWealthCareerText(cycle, context, userSituation),
      practicalActions: buildPracticalActions(cycle, context),
      closingNote: buildClosingNoteText(cycle, context, isCurrent),
    };
  });
}

export function buildLifetimeReport(
  input: BirthInput,
  sajuData: SajuDataV1,
  targetYear = getCurrentKoreaYear(),
  // 2026-05-15 PR 2: 사용자 현재 상황 (PR 1 으로 personalizationContext 에 흐름 확보됨).
  // 대운 cycle 8단 sub-section 의 hook/relationship/wealthCareer 분기에 사용.
  userSituation: UserSituation | null = null
): SajuLifetimeReport {
  const todayReport = buildSajuReport(input, sajuData, 'today');
  const loveReport = buildSajuReport(input, sajuData, 'love');
  const wealthReport = buildSajuReport(input, sajuData, 'wealth');
  const careerReport = buildSajuReport(input, sajuData, 'career');
  const relationshipReport = buildSajuReport(input, sajuData, 'relationship');
  const yearlyReport = buildYearlyReport(input, sajuData, targetYear);
  const evidenceByKey = Object.fromEntries(
    todayReport.evidenceCards.map((card) => [card.key, card])
  );

  const dominant = formatElementName(sajuData.fiveElements.dominant);
  const weakest = formatElementName(sajuData.fiveElements.weakest);
  const supportElementKeys = getLuckyElementsFromSajuData(sajuData);
  const supportElements = supportElementKeys.map(formatElementName);
  const supportLabels = supportElements.join(' · ') || dominant;
  const personality = getPersonalityFromSajuData(sajuData);
  const pillars = {
    year: sajuData.pillars.year.ganzi,
    month: sajuData.pillars.month.ganzi,
    day: sajuData.pillars.day.ganzi,
    hour: sajuData.pillars.hour?.ganzi ?? null,
  };
  const strength = evidenceByKey.strength;
  const pattern = evidenceByKey.pattern;
  const yongsin = evidenceByKey.yongsin;
  const relations = evidenceByKey.relations;
  const gongmang = evidenceByKey.gongmang;
  const specialSals = evidenceByKey.specialSals;
  const yongsinLabels = sajuData.yongsin
    ? formatSymbolList([sajuData.yongsin.primary, ...sajuData.yongsin.secondary])
    : yongsin?.title ?? supportLabels;
  const kiyshinLabels =
    sajuData.yongsin && sajuData.yongsin.kiyshin.length > 0
      ? formatSymbolList(sajuData.yongsin.kiyshin)
      : weakest;
  const currentMajorLuck = sajuData.currentLuck?.currentMajorLuck ?? null;
  const todayTimeline = todayReport.timeline.find((item) => item.label === '오늘') ?? null;
  const monthTimeline = todayReport.timeline.find((item) => item.label === '이번 달') ?? null;
  const majorTimeline = todayReport.timeline.find((item) => item.label === '대운 흐름') ?? null;
  const majorLuckCycles = buildMajorLuckCycles(
    sajuData.majorLuck,
    currentMajorLuck?.ganzi ?? null,
    {
      supportElements: supportElementKeys,
      dominant: sajuData.fiveElements.dominant,
      weakest: sajuData.fiveElements.weakest,
    },
    userSituation
  );
  const firstCurrentCycle = majorLuckCycles.find((cycle) => cycle.isCurrent) ?? majorLuckCycles[0];
  const elementHighlights = Object.entries(sajuData.fiveElements.byElement).map(
    ([element, value]) =>
      `${formatElementName(element as Element)} ${value.percentage}% · ${value.state} · ${value.score}점`
  );
  const rememberRules = [
    `강한 ${dominant} 기운은 무리하게 쓰기보다 방향을 정하고 쓸 때 오래 갑니다.`,
    `${supportLabels} 기운을 생활 루틴으로 만들수록 명식의 장점이 안정적으로 살아납니다.`,
    `${weakest} 축이 약해지는 날에는 속도보다 리듬을 먼저 바로잡는 편이 좋습니다.`,
    '관계와 일에서 서운함이나 조급함을 결론처럼 말하기보다, 사실과 기준을 먼저 정리해야 합니다.',
    `지금의 ${currentMajorLuck?.ganzi ?? '대운'}은 단기 반응보다 장기 기준을 바로 세울수록 힘을 실어줍니다.`,
  ];

  return {
    targetYear,
    pillars,
    cover: {
      headline: `${sajuData.pillars.day.ganzi} 일주 기준 깊은 사주풀이`,
      oneLineSummary: `이 사주는 ${supportLabels} 기운을 삶의 기준으로 들일 때 실력이 가장 안정적으로 오래 갑니다.`,
      keywords: buildKeywords({
        dayMasterStem: sajuData.dayMaster.stem,
        dayMasterMetaphor: sajuData.dayMaster.metaphor,
        dominant,
        weakest,
        supportLabels,
        currentMajorLuck: currentMajorLuck?.ganzi ?? null,
      }),
      lifetimeRule: `${sajuData.dayMaster.stem} 일간의 추진력과 ${dominant} 기운의 장점은 이미 충분합니다. 평생 운을 살리는 기준은 더 세게 몰아가는 것이 아니라, ${supportLabels} 보완 축을 반복 가능한 습관과 선택 기준으로 만드는 데 있습니다.`,
      basis: compactStrings([
        `원국: ${[pillars.year, pillars.month, pillars.day, pillars.hour ?? '시주 미입력'].join(' · ')}`,
        strength?.title ? `강약 기준: ${strength.title}` : null,
        pattern?.title ? `격국 기준: ${pattern.title}` : null,
        yongsin?.title ? `용신 기준: ${yongsin.title}` : null,
      ]),
    },
    coreIdentity: {
      headline: '원국의 본질',
      summary: `${personality} ${todayReport.summaryHighlights[0] ?? ''}`.trim(),
      reactionStyle:
        todayReport.dayMasterSummary ||
        `${sajuData.dayMaster.stem} 일간은 반응이 빠른 편이며, 한 번 기준이 잡히면 스스로 방향을 만들려는 힘이 강합니다.`,
      bestEnvironment: `${supportLabels} 기운이 살아나는 구조, 즉 속도만 빠른 자리보다 기준과 리듬이 함께 있는 환경에서 강점이 가장 크게 드러납니다.`,
      weakPattern: `${weakest} 축이 비거나 ${dominant} 기운이 과속할 때, 장점이 곧 피로와 고집으로 바뀌기 쉽습니다. 특히 서둘러 결론을 내리거나 감정을 바로 행동으로 옮길 때 무너지기 쉽습니다.`,
      basis: compactStrings([
        todayReport.headline,
        personality,
        todayReport.summaryHighlights[0],
        todayReport.summaryHighlights[1],
      ]),
    },
    strengthBalance: {
      headline: '강약 / 오행 균형',
      summary:
        strength?.body ??
        `${dominant} 기운이 앞에 서고 ${weakest} 기운은 의식적으로 보완해야 하는 구조입니다.`,
      strongAxis: `${dominant} 기운은 타고난 장점이자 즉시 반응하는 힘입니다. 이 축이 살아나면 추진력, 존재감, 판단 속도가 자연스럽게 드러납니다.`,
      weakAxis: `${weakest} 기운은 몸과 마음의 균형을 잡는 약한 축입니다. 방치하면 피로가 누적되고, 감정이나 재정, 생활 리듬에서 빈틈이 생기기 쉽습니다.`,
      energyDrain:
        todayReport.cautionAction.description ||
        `${dominant} 기운만 앞세우면 오래 버티는 힘보다 단기 반응이 앞서서 에너지가 쉽게 샙니다.`,
      recovery:
        todayReport.primaryAction.description ||
        `${supportLabels} 기운을 살리는 루틴을 만들수록 회복 속도가 빨라지고, 강한 축도 안정적으로 오래 갑니다.`,
      balanceGuide: [
        ...(strength?.practicalActions ?? []),
        ...(yongsin?.practicalActions ?? []),
      ].slice(0, 5),
      elementHighlights,
      basis: compactStrings([
        strength?.title ? `강약 기준: ${strength.title}` : null,
        `강한 오행: ${dominant}`,
        `약한 오행: ${weakest}`,
      ]),
    },
    patternAndYongsin: {
      headline: '격국 / 용신',
      summary:
        yongsin?.body ??
        `이 명식은 ${yongsinLabels} 기운을 보완 축으로 쓰는 것이 평생 선택의 기준입니다.`,
      patternRole:
        pattern?.body ??
        '격국은 이 사람이 어떤 역할 구조에서 실력이 붙는지, 어디에서 책임과 반응이 반복되는지를 읽는 기준입니다.',
      yongsinDirection:
        yongsin?.body ??
        `${yongsinLabels} 기운을 꾸준히 들이면 명식의 장점이 균형 있게 살아납니다.`,
      choiceRule: `${supportLabels} 보완 축이 살아나는 선택은 길게 보면 명식을 살리고, ${kiyshinLabels} 기운이 과해지는 선택은 짧게는 편해도 오래 가면 균형을 흐릴 가능성이 큽니다.`,
      supportSymbols: compactStrings([
        yongsinLabels,
        supportLabels,
      ]),
      cautionSymbols: compactStrings([
        kiyshinLabels,
        weakest,
      ]),
      practicalActions: [
        ...(yongsin?.practicalActions ?? []),
        ...(pattern?.practicalActions ?? []),
      ].slice(0, 5),
      detailLines: compactStrings([
        ...(yongsin?.details ?? []).slice(0, 4),
        ...(pattern?.details ?? []).slice(0, 2),
      ]),
      basis: compactStrings([
        pattern?.title ? `격국: ${pattern.title}` : null,
        yongsin?.title ? `용신: ${yongsin.title}` : null,
        yongsin?.details.find((detail) => detail.includes('후보')),
      ]),
    },
    relationshipPattern: {
      headline: '관계 패턴',
      summary:
        relationshipReport.summaryHighlights[0] ??
        '관계는 친밀감 자체보다 거리감 조절 방식에서 성패가 갈리는 명식입니다.',
      distanceStyle:
        relationshipReport.primaryAction.description ||
        '가까운 사람일수록 한 번에 결론을 내리기보다, 말의 속도와 순서를 조절하는 편이 좋습니다.',
      expressionStyle:
        loveReport.primaryAction.description ||
        '감정은 깊어도 표현은 늦게 나올 수 있어, 짧고 분명한 확인이 관계를 오래 가게 합니다.',
      conflictTriggers:
        relationshipReport.cautionAction.description ||
        '서운함을 판단처럼 말하거나, 상대의 반응을 기다리기 전에 먼저 마음이 닫히는 방식이 갈등의 시작점이 되기 쉽습니다.',
      longevityGuide:
        loveReport.summaryHighlights[1] ??
        '관계를 오래 가게 하는 힘은 큰 이벤트보다, 확인과 감사, 거리감 조절 같은 작은 루틴에 있습니다.',
      basis: compactStrings([
        relationshipReport.headline,
        relationshipReport.summary,
        loveReport.summary,
        relations?.title ? `합충 기준: ${relations.title}` : relations?.body,
      ]),
    },
    wealthStyle: {
      headline: '재물 감각',
      summary:
        wealthReport.summaryHighlights[0] ??
        '재물운은 한 번의 대박보다 돈을 다루는 구조와 판단 습관을 읽는 편이 더 정확합니다.',
      earningStyle:
        wealthReport.primaryAction.description ||
        '돈을 버는 방식은 흐름을 읽고 정리하는 쪽에서 힘이 납니다.',
      keepingStyle:
        wealthReport.summaryHighlights[1] ??
        '벌어들이는 힘 못지않게, 약속된 금액과 반복 지출을 점검하는 습관이 재물운을 지켜줍니다.',
      spendingMistakes:
        wealthReport.cautionAction.description ||
        '감정이 올라온 날의 결제, 지인 말만 믿고 움직이는 지출, 비교 없이 서두르는 선택이 재물 피로를 키우기 쉽습니다.',
      operatingStyle:
        wealthReport.summary ||
        `${supportLabels} 기운이 살아나는 방식, 즉 자료 확인과 기준 정리, 반복 가능한 운영 습관이 맞는 재물 체질입니다.`,
      basis: compactStrings([
        wealthReport.headline,
        formatSymbolList(sajuData.yongsin ? [sajuData.yongsin.primary, ...sajuData.yongsin.secondary] : []),
        strength?.title ? `강약 기준: ${strength.title}` : null,
      ]),
    },
    careerDirection: {
      headline: '직업 방향',
      summary:
        careerReport.summaryHighlights[0] ??
        '직업운은 당장 붙는 자리보다 오래 버틸 수 있는 역할 구조를 봐야 정확합니다.',
      fitStructure:
        careerReport.primaryAction.description ||
        '기준과 책임선이 분명한 구조에서 실력이 붙기 쉽습니다.',
      endureVsShine:
        careerReport.summaryHighlights[1] ??
        '버티는 일과 빛나는 일의 차이는 속도보다 역할의 적합도에서 갈립니다.',
      independenceStyle:
        pattern?.body ??
        '독립과 조직 중 무엇이 맞느냐보다, 기준을 스스로 세울 수 있는 권한이 있는지가 더 중요합니다.',
      recognitionStyle:
        careerReport.cautionAction.description ||
        '인정은 한 번의 강한 인상보다, 반복되는 신뢰와 기준 있는 결과물로 쌓이는 명식입니다.',
      basis: compactStrings([
        careerReport.headline,
        careerReport.summary,
        pattern?.title ? `격국 기준: ${pattern.title}` : null,
      ]),
    },
    healthRhythm: {
      headline: '건강 리듬',
      summary: `${weakest} 축의 리듬이 흐트러지면 몸이 먼저 무너진다기보다 생활 전체의 템포가 어긋나기 쉬운 명식입니다.`,
      warningSignals:
        monthTimeline?.body ??
        '수면, 식사, 회복 순서가 깨질 때 작은 피로가 오래 남고 예민함이 커지기 쉽습니다.',
      recoveryRoutine:
        todayReport.primaryAction.description ||
        `${supportLabels} 기운이 살아나는 생활 루틴, 특히 휴식과 정리, 속도 조절이 회복의 핵심입니다.`,
      habitPoints: [
        ...(strength?.practicalActions ?? []),
        ...(gongmang?.practicalActions ?? []),
      ].slice(0, 4),
      basis: compactStrings([
        strength?.title ? `강약 기준: ${strength.title}` : null,
        gongmang?.title ? `공망 기준: ${gongmang.title}` : gongmang?.body,
        monthTimeline?.headline,
      ]),
    },
    majorLuckTimeline: {
      headline: '대운 10년 흐름 지도',
      summary:
        majorTimeline?.body ??
        '대운은 사건 하나를 맞히는 표가 아니라, 어느 시기에 확장·정리·전환 과제가 커지는지 읽는 장기 지도입니다.',
      currentMeaning: firstCurrentCycle
        ? `${firstCurrentCycle.ganzi} 대운은 지금 ${firstCurrentCycle.phase}의 과제가 커지는 구간입니다. ${firstCurrentCycle.summary}`
        : '현재 대운의 의미를 읽을 수 있는 데이터가 아직 부족합니다.',
      cycles: majorLuckCycles,
      basis: compactStrings([
        currentMajorLuck ? `현재 대운: ${currentMajorLuck.ganzi}` : null,
        ...(currentMajorLuck?.notes ?? []).slice(0, 2),
        majorTimeline?.headline,
      ]),
    },
    lifetimeStrategy: {
      headline: '평생 활용 전략',
      summary: `이 사주는 성향 해설보다 사용법이 더 중요합니다. ${supportLabels} 기운을 언제 살리고, ${weakest} 축이 흔들릴 때 무엇을 먼저 지킬지 아는 사람이 결국 흐름을 안정적으로 씁니다.`,
      useWhenStrong: compactStrings([
        todayReport.primaryAction.description,
        wealthReport.primaryAction.description,
        careerReport.primaryAction.description,
      ]).slice(0, 4),
      defendWhenShaken: compactStrings([
        todayReport.cautionAction.description,
        relationshipReport.cautionAction.description,
        wealthReport.cautionAction.description,
      ]).slice(0, 4),
      rememberRules,
      basis: compactStrings([
        specialSals?.title ? `신살 기준: ${specialSals.title}` : specialSals?.body,
        relations?.title ? `합충 기준: ${relations.title}` : relations?.body,
        majorTimeline?.body,
      ]),
    },
    yearlyAppendix: {
      year: targetYear,
      yearLabel: yearlyReport.yearLabel,
      yearGanji: yearlyReport.annualContext.yearGanji,
      headline: yearlyReport.overview.headline,
      oneLineSummary: yearlyReport.oneLineSummary,
      firstHalf: yearlyReport.firstHalf.summary,
      secondHalf: yearlyReport.secondHalf.summary,
      goodPeriods: yearlyReport.goodPeriods.map(
        (window) => `${window.months.map((month) => `${month}월`).join(', ')} · ${window.reason}`
      ),
      cautionPeriods: yearlyReport.cautionPeriods.map(
        (window) => `${window.months.map((month) => `${month}월`).join(', ')} · ${window.reason}`
      ),
      actionAdvice: [
        ...yearlyReport.actionGuide.useWhenStrong,
        ...yearlyReport.actionGuide.defendWhenWeak,
      ].slice(0, 4),
      ctaLabel: `${targetYear} 올해 전략서 전체 보기`,
      ctaAnchor: '#yearly-report',
      basis: compactStrings([
        yearlyReport.overview.summary,
        yearlyReport.firstHalf.opportunity,
        yearlyReport.secondHalf.caution,
      ]),
    },
    evidenceCards: todayReport.evidenceCards,
  };
}
