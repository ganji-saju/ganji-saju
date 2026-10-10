// 2026-10-10 — 월운 근거 확장(사용자 피드백: "월별 풀이가 두 줄뿐, 이렇게 짧으면 돈을 내지 않는다").
//   시중 월운 해석 순서(그 달 기운의 십성 → 용신·기신 → 원국 지지와의 합충 → 세운과의 관계)대로
//   그 사람에게만 해당하는 월별 근거를 계산한다. 결정론 — LLM 비용 없음. 기존 계산 함수만 연결한다.
import { Solar } from 'lunar-typescript';
import { getBranchPrimaryTenGod, getTenGodHangul } from '@/domain/saju/engine/orrery-adapter';
import type { SajuPillars, SajuYongsin, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import {
  BRANCH_TO_ELEMENT,
  isBanghap,
  isBranchChung,
  isBranchHae,
  isBranchHyung,
  isBranchPa,
  isBranchWonjin,
  isSamhap,
  isYukhap,
  STEM_TO_ELEMENT,
} from '@/lib/today-fortune/iljin-rules';
import type { Branch, Element, Stem } from '@/lib/saju/types';
import type { YearlyCategoryKey } from './yearly-types';

export type BranchRelationKind = '육합' | '삼합' | '방합' | '충' | '형' | '해' | '파' | '원진';
export type PillarKey = 'year' | 'month' | 'day' | 'hour';

export interface MonthNatalRelation {
  kind: BranchRelationKind;
  pillar: PillarKey;
  /** 그 기둥(궁)이 뜻하는 생활 영역. */
  palace: string;
}

export interface MonthSignals {
  stemTenGod: TenGodCode | null;
  branchTenGod: TenGodCode | null;
  /** 십성으로 본 그 달에 움직이는 생활 영역(한 문장 재료). */
  tenGodTheme: string | null;
  /** 원국 네 기둥 지지와의 관계(충·합 등). 약한 관계(해·파·원진)는 뒤로. */
  natalRelations: MonthNatalRelation[];
  /** 세운(올해) 지지와의 관계. */
  yearRelation: BranchRelationKind | null;
  /** 월운 천간·지지 오행이 용신/희신/기신 중 무엇에 해당하는지. */
  yongsinFit: 'support' | 'burden' | 'mixed' | 'neutral';
  /** 절기 기준 그 달 월운이 실제로 적용되는 기간("2월 4일~3월 5일"). */
  period: string | null;
  /** 이 근거로 고른, 그 달에 먼저 볼 분야 2개(사람마다 다르다). */
  focusAreas: YearlyCategoryKey[];
}

const PALACE: Record<PillarKey, string> = {
  year: '집안 어른·바깥 사회',
  month: '부모·직장·사회 활동',
  day: '나 자신과 배우자·연인',
  hour: '자녀·아랫사람·앞으로의 계획',
};

const TEN_GOD_THEME: Record<TenGodCode, { theme: string; areas: YearlyCategoryKey[] }> = {
  비견: { theme: '내 힘으로 밀고 나가려는 마음과 동료·경쟁자와의 관계', areas: ['work', 'relationship'] },
  겁재: { theme: '경쟁과 지출, 돈을 둘러싼 사람 사이의 줄다리기', areas: ['wealth', 'relationship'] },
  식신: { theme: '내 실력과 재능을 꺼내 쓰고 생활을 즐기는 일', areas: ['work', 'health'] },
  상관: { theme: '말과 표현, 기존 틀을 바꾸고 싶은 마음', areas: ['work', 'love'] },
  편재: { theme: '크게 움직이는 돈과 새로운 기회, 바깥 활동', areas: ['wealth', 'move'] },
  정재: { theme: '고정 수입과 살림, 꼼꼼한 관리', areas: ['wealth', 'love'] },
  편관: { theme: '갑작스러운 책임과 압박, 버텨야 하는 일', areas: ['work', 'health'] },
  정관: { theme: '직장·평가·규칙, 맡은 자리에서의 인정', areas: ['work', 'relationship'] },
  편인: { theme: '혼자 깊이 파고드는 공부와 생각, 새로운 관심사', areas: ['health', 'move'] },
  정인: { theme: '문서·계약·자격, 나를 돕는 사람과 배움', areas: ['work', 'relationship'] },
};

const RELATION_ORDER: BranchRelationKind[] = ['충', '삼합', '육합', '방합', '형', '원진', '해', '파'];
const RELATION_CHECKS: Array<[BranchRelationKind, (a: string, b: string) => boolean]> = [
  ['충', isBranchChung], ['삼합', isSamhap], ['육합', isYukhap], ['방합', isBanghap],
  ['형', isBranchHyung], ['원진', isBranchWonjin], ['해', isBranchHae], ['파', isBranchPa],
];

function relationOf(a: string, b: string): BranchRelationKind | null {
  return RELATION_CHECKS.find(([, check]) => check(a, b))?.[0] ?? null;
}

function yongsinElements(yongsin: SajuYongsin | null | undefined) {
  const toElement = (ref: { type: string; value: string }): Element | null =>
    ref.type === 'element' ? (ref.value as Element)
      : ref.type === 'stem' ? (STEM_TO_ELEMENT[ref.value as Stem] as Element | undefined) ?? null
        : ref.type === 'branch' ? (BRANCH_TO_ELEMENT[ref.value as Branch] as Element | undefined) ?? null
          : null;
  if (!yongsin) return { good: new Set<Element>(), bad: new Set<Element>() };
  const good = new Set([yongsin.primary, ...yongsin.secondary].map(toElement).filter((e): e is Element => !!e));
  const bad = new Set(yongsin.kiyshin.map(toElement).filter((e): e is Element => !!e && !good.has(e)));
  return { good, bad };
}

/** 절기 기준 월운 기간. month = 양력 월(그 달 15일이 속한 월운). */
export function monthLuckPeriod(year: number, month: number): string | null {
  try {
    const start = Solar.fromYmd(year, month, 15).getLunar().getPrevJie().getSolar();
    const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    const next = Solar.fromYmd(nextMonth.y, nextMonth.m, 15).getLunar().getPrevJie().getSolar().next(-1);
    return `${start.getMonth()}월 ${start.getDay()}일~${next.getMonth()}월 ${next.getDay()}일`;
  } catch {
    return null;
  }
}

export function computeMonthSignals(input: {
  year: number;
  month: number;
  monthlyGanji: string | null;
  yearlyGanji: string | null;
  dayMasterStem: Stem;
  pillars: SajuPillars;
  yongsin: SajuYongsin | null | undefined;
  fallbackAreas: YearlyCategoryKey[];
}): MonthSignals {
  const chars = Array.from(input.monthlyGanji ?? '');
  const stem = chars[0] as Stem | undefined;
  const branch = chars[1] as Branch | undefined;
  const valid = !!stem && !!branch && stem in STEM_TO_ELEMENT && branch in BRANCH_TO_ELEMENT;
  const stemTenGod = valid ? getTenGodHangul(input.dayMasterStem, stem!) : null;
  const branchTenGod = valid ? getBranchPrimaryTenGod(input.dayMasterStem, branch!) : null;

  const natalRelations: MonthNatalRelation[] = [];
  if (valid) {
    for (const pillar of ['year', 'month', 'day', 'hour'] as const) {
      const natal = input.pillars[pillar];
      if (!natal) continue;
      const kind = relationOf(branch!, natal.branch);
      if (kind) natalRelations.push({ kind, pillar, palace: PALACE[pillar] });
    }
    natalRelations.sort((a, b) => RELATION_ORDER.indexOf(a.kind) - RELATION_ORDER.indexOf(b.kind));
  }
  const yearBranch = Array.from(input.yearlyGanji ?? '')[1];
  const yearRelation = valid && yearBranch ? relationOf(branch!, yearBranch) : null;

  const { good, bad } = yongsinElements(input.yongsin);
  const elements = valid ? [STEM_TO_ELEMENT[stem!], BRANCH_TO_ELEMENT[branch!]] as Element[] : [];
  const goodHits = elements.filter((e) => good.has(e)).length;
  const badHits = elements.filter((e) => bad.has(e)).length;
  const yongsinFit = goodHits && badHits ? 'mixed' : goodHits ? 'support' : badHits ? 'burden' : 'neutral';

  // 분야: 천간 십성 → 지지 십성 → 일지(배우자궁) 충·합이면 연애 → 고정표 순으로 채운다.
  const areas: YearlyCategoryKey[] = [];
  const push = (area: YearlyCategoryKey) => { if (!areas.includes(area) && areas.length < 2) areas.push(area); };
  if (natalRelations.some((r) => r.pillar === 'day' && (r.kind === '충' || r.kind === '육합'))) push('love');
  if (stemTenGod) push(TEN_GOD_THEME[stemTenGod].areas[0]);
  if (branchTenGod) push(TEN_GOD_THEME[branchTenGod].areas[0]);
  if (stemTenGod) push(TEN_GOD_THEME[stemTenGod].areas[1]);
  input.fallbackAreas.forEach(push);

  const themes = [stemTenGod, branchTenGod].filter((g): g is TenGodCode => !!g).map((g) => TEN_GOD_THEME[g].theme);
  return {
    stemTenGod,
    branchTenGod,
    tenGodTheme: themes.length ? [...new Set(themes)].join(', 그리고 ') : null,
    natalRelations,
    yearRelation,
    yongsinFit,
    period: monthLuckPeriod(input.year, input.month),
    focusAreas: areas,
  };
}

const RELATION_PLAIN: Record<BranchRelationKind, string> = {
  육합: '맞물려 힘을 보태는',
  삼합: '한 방향으로 크게 뭉치는',
  방합: '같은 계절 기운으로 힘이 모이는',
  충: '정면으로 부딪혀 흔들리는',
  형: '긴장과 마찰이 생기기 쉬운',
  원진: '서운함이 쌓이기 쉬운',
  해: '작게 틀어지기 쉬운',
  파: '계획이 한 번 깨졌다 다시 맞춰지는',
};

const FIT_PLAIN: Record<MonthSignals['yongsinFit'], string> = {
  support: '내 사주에 필요한 기운이 들어오는 달이라 힘을 쓰기 좋습니다.',
  burden: '내 사주에 이미 넘치는 기운이 더해지는 달이라 속도를 조절하는 편이 좋습니다.',
  mixed: '필요한 기운과 부담되는 기운이 함께 들어오는 달이라 일을 골라서 쓰는 편이 좋습니다.',
  neutral: '내 사주의 균형을 크게 흔들지 않는 달이라 하던 흐름을 이어가기 좋습니다.',
};

/** 월운 근거를 쉬운 문장으로(명리 용어는 괄호로 남긴다). 한자 없음 — 간지는 호출부가 한글로 넘긴다. */
export function describeMonthSignals(signals: MonthSignals, ganjiLabel: string | null): string[] {
  const lines: string[] = [];
  if (signals.stemTenGod && signals.tenGodTheme) {
    const gods = [signals.stemTenGod, signals.branchTenGod].filter((g, i, all) => g && all.indexOf(g) === i).join('·');
    lines.push(`${ganjiLabel ? `${ganjiLabel}월은 ` : '이달은 '}나에게 ${gods} 자리의 기운이 들어와 ${signals.tenGodTheme}이 앞에 나옵니다.`);
  }
  const strongest = signals.natalRelations[0];
  if (strongest) {
    lines.push(`그 달 글자가 내 사주의 ${strongest.palace} 자리와 ${RELATION_PLAIN[strongest.kind]} 관계(${strongest.kind})라, 이 영역에서 변화가 먼저 느껴질 수 있습니다.`);
  }
  lines.push(FIT_PLAIN[signals.yongsinFit]);
  return lines;
}
