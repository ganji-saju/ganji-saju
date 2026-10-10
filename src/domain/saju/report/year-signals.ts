// 2026-10-10 — 신년 총론 근거 팩(점검 C #1·#3). 세운을 5갈래 관계로만 압축해 "열 사람 중 아홉에게 같은 말"이 됐다.
//   세운 십성·원국 합충·용신 적합(월운과 같은 규칙) + 대운과의 관계 + 삼재 + 천을귀인 달 + 행운 색·숫자·방향.
//   결정론 — LLM 비용 없음. 삼재·행운은 "참고용"으로만 쓰고 불행·행운을 단정하지 않는다.
import type { SajuPillars, SajuYongsin, TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import { ELEMENT_COLORS_MAIN, ELEMENT_DIRECTIONS, ELEMENT_NUMBERS } from '@/lib/today-fortune/lucky-package';
import { CHEONEUL_GWIIN, SAMJAE } from '@/lib/today-fortune/sinsal-comprehensive';
import type { Branch, Element, Stem } from '@/lib/saju/types';
import { koreanizeGanzi } from '@/lib/saju/terminology';
import { analyzeLuckGanji, describeMonthSignals, type BranchRelationKind, type LuckGanjiAnalysis } from './monthly-signals';
import { isBranchChung, isSamhap, isYukhap, isBranchHyung } from '@/lib/today-fortune/iljin-rules';

export type SamjaeStage = '들삼재' | '눌삼재' | '날삼재';

export interface YearSignals extends LuckGanjiAnalysis {
  yearGanji: string;
  /** 지금 대운과 올해의 관계. */
  majorLuck: { ganji: string; stemTenGod: TenGodCode | null; relation: BranchRelationKind | null } | null;
  /** 띠(태어난 해 지지) 기준 삼재. 아니면 null. */
  samjae: { stage: SamjaeStage; branches: string } | null;
  /** 올해 지지가 천을귀인인지(귀인이 드는 해). */
  gwiinYear: boolean;
  /** 월운 지지가 천을귀인인 달. */
  gwiinMonths: number[];
  /** 용신 기준 행운 색·숫자·방향(참고용). */
  lucky: { element: Element; colors: string[]; numbers: number[]; directions: string[] } | null;
  /** 쉬운 문장 요약 — AI 입력·화면·기본 문구 공용. */
  summary: string[];
}

const SAMJAE_STAGE: SamjaeStage[] = ['들삼재', '눌삼재', '날삼재'];
const SAMJAE_PLAIN: Record<SamjaeStage, string> = {
  들삼재: '삼재가 시작되는 해(들삼재)라, 새 일을 크게 벌이기보다 기반을 점검하며 들어가는 편이 마음이 편합니다.',
  눌삼재: '삼재의 가운데 해(눌삼재)라, 무리한 확장보다 지금 가진 것을 지키는 쪽에 힘을 두는 편이 좋습니다.',
  날삼재: '삼재가 끝나 가는 해(날삼재)라, 지난 2년 동안 미뤄 둔 정리를 마무리하며 다음 흐름을 준비하기 좋습니다.',
};

function relationOf(a: string, b: string): BranchRelationKind | null {
  if (isBranchChung(a, b)) return '충';
  if (isSamhap(a, b)) return '삼합';
  if (isYukhap(a, b)) return '육합';
  if (isBranchHyung(a, b)) return '형';
  return null;
}

export function computeYearSignals(input: {
  yearGanji: string;
  majorLuckGanji: string | null;
  dayMasterStem: Stem;
  pillars: SajuPillars;
  yongsin: SajuYongsin | null | undefined;
  luckyElements: Element[];
  monthlyGanji: Array<{ month: number; ganji: string | null }>;
}): YearSignals {
  const analysis = analyzeLuckGanji({ ganji: input.yearGanji, dayMasterStem: input.dayMasterStem, pillars: input.pillars, yongsin: input.yongsin });
  const yearBranch = Array.from(input.yearGanji)[1] as Branch | undefined;

  const luckChars = Array.from(input.majorLuckGanji ?? '');
  const majorLuck = luckChars.length === 2 && yearBranch
    ? {
      ganji: input.majorLuckGanji!,
      stemTenGod: analyzeLuckGanji({ ganji: input.majorLuckGanji, dayMasterStem: input.dayMasterStem, pillars: input.pillars, yongsin: input.yongsin }).stemTenGod,
      relation: relationOf(luckChars[1], yearBranch),
    }
    : null;

  const birthBranch = input.pillars.year.branch;
  const samjaeIndex = yearBranch ? (SAMJAE[birthBranch] ?? []).indexOf(yearBranch) : -1;
  const samjae = samjaeIndex >= 0
    ? { stage: SAMJAE_STAGE[samjaeIndex], branches: (SAMJAE[birthBranch] ?? []).map((b) => koreanizeGanzi(b)).join('·') }
    : null;

  const gwiin = CHEONEUL_GWIIN[input.dayMasterStem] ?? [];
  const gwiinYear = !!yearBranch && gwiin.includes(yearBranch);
  const gwiinMonths = input.monthlyGanji
    .filter(({ ganji }) => ganji && gwiin.includes(Array.from(ganji)[1] as Branch))
    .map(({ month }) => month);

  const element = input.luckyElements[0];
  const lucky = element
    ? { element, colors: ELEMENT_COLORS_MAIN[element], numbers: ELEMENT_NUMBERS[element], directions: ELEMENT_DIRECTIONS[element] }
    : null;

  const yearLabel = koreanizeGanzi(input.yearGanji);
  const summary = [
    ...describeMonthSignals(analysis, yearLabel, '해'),
    majorLuck
      ? `지금 지나고 있는 ${koreanizeGanzi(majorLuck.ganji)} 대운(10년 단위의 큰 흐름)${majorLuck.stemTenGod ? `은 나에게 ${majorLuck.stemTenGod} 자리이고` : '과'}, ${
        majorLuck.relation ? `올해 기운과 ${majorLuck.relation === '충' ? '부딪히는' : majorLuck.relation === '형' ? '긴장하는' : '맞물리는'} 관계(${majorLuck.relation})라 큰 흐름과 올해 흐름이 ${majorLuck.relation === '충' || majorLuck.relation === '형' ? '엇갈리는 지점을 조율해야 합니다' : '같은 방향으로 힘을 보탭니다'}.` : '올해 기운과 크게 부딪히지 않아 큰 흐름 위에서 올해를 차분히 쓰기 좋습니다.'
      }`
      : null,
    samjae ? `띠 기준으로 ${SAMJAE_PLAIN[samjae.stage]} 삼재는 조심할 때를 알려 주는 옛 풍습이지, 나쁜 일이 생긴다는 뜻은 아닙니다.` : null,
    gwiinYear
      ? '올해는 나를 도와주는 귀인(천을귀인)의 기운이 드는 해라, 도움을 청하거나 사람을 소개받기 좋습니다.'
      : gwiinMonths.length
        ? `${gwiinMonths.join('·')}월은 나를 도와주는 귀인(천을귀인)의 기운이 드는 달이라, 부탁·상담·소개를 이때 잡아 보세요.`
        : null,
  ].filter((line): line is string => !!line);

  return { ...analysis, yearGanji: input.yearGanji, majorLuck, samjae, gwiinYear, gwiinMonths, lucky, summary };
}
