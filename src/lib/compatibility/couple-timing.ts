// 2026-08-27 — 궁합 유료 풀이에 **시간축**을 붙인다.
//
//   🔴 사용자 제보: "이 궁합으로 사람들이 알고 싶은 건 진짜 잘 어울리는지, 같이 뭘 해도 되는지,
//   언제 어떻게 하면 좋을지, 좋은 해·달은 언제고 안 좋은 해·달은 언제인지인데 그런 설명이
//   하나도 없다." 맞다 — 기존 유료 §8 은 4축(갈등·대화·돈·거리) 실천 조언뿐이라
//   **'언제' 에 대한 답이 한 줄도 없었다.**
//
//   없는 걸 새로 만들지 않는다. buildYearlyReport 가 이미 한 사람의 12개월 momentum
//   (rise/steady/caution)을 낸다 → **두 사람 것을 겹치면** 커플 공통 시간축이 나온다.
//   결정론이라 LLM 비용 0이고, 같은 커플이면 항상 같은 답이다.
//
//   ⚠️ 무게: buildYearlyReport 는 1인 ~160ms(12개월 각각 명식 계산), 두 사람이면 ~320ms.
//      그래서 **월 단위는 올해 1년만** 돌린다. 연 단위 비교는 세운 간지 × 각자 일주로
//      따로 가볍게 계산한다 — 해마다 리포트를 돌리면 초 단위가 된다.
//
//   ⚠️ 정직성: 타이밍은 단정하지 않는다. "~편입니다 / ~수 있습니다" 로만 쓴다.
//      좋은 달을 "성공하는 달" 로 쓰면 그건 예언이지 풀이가 아니다.
import { buildYearlyReport } from '@/domain/saju/report/build-yearly-report';
import type { YearlyMomentum, YearlyMonthFlow } from '@/domain/saju/report/yearly-types';
import type { SajuDataV1, SajuDataV2 } from '@/domain/saju/engine';
import {
  summarizeBranchInteraction,
  summarizeStemInteraction,
} from '@/lib/compatibility';
import { branchCharToKorean, stemCharToKorean } from '@/lib/saju/ganzi-korean';
import { yearToGanji } from '@/lib/saju/year-ganji';
import type { BirthInput, Branch, Stem } from '@/lib/saju/types';

export type CoupleMonthVerdict = 'both_good' | 'both_caution' | 'mixed' | 'quiet';

export interface CoupleMonth {
  month: number;
  label: string;
  verdict: CoupleMonthVerdict;
  /** 커플 합산 점수(0~100). 순위 판정의 근거. */
  score: number;
  /** 두 사람 점수 차 — 클수록 '한 사람만 순풍'인 달. */
  gap: number;
  /** 엇갈리는 달에서 순풍인 쪽. mixed 가 아니면 null. */
  favors: 'self' | 'partner' | null;
  title: string;
  body: string;
}

export interface CoupleYearOutlook {
  year: number;
  /** '2026년 병오년' — 본문 한자 0개 정책(naming-policy §5). */
  label: string;
  score: number;
  verdict: string;
  body: string;
}

export interface CoupleTimingReport {
  year: number;
  months: CoupleMonth[];
  /** 둘 다 순풍인 달(최대 3). */
  bestMonths: CoupleMonth[];
  /** 둘 다 조심할 달(최대 2). */
  cautionMonths: CoupleMonth[];
  /** 한쪽만 순풍인 달(최대 2). */
  mixedMonths: CoupleMonth[];
  years: CoupleYearOutlook[];
}

export interface CoupleTimingPerson {
  name: string;
  birthInput: BirthInput;
  data: SajuDataV1 | SajuDataV2;
}

/** 한국어 첫 문장만. 월 카드가 문단이 되면 아무도 안 읽는다. */
function firstSentence(text: string): string {
  const trimmed = (text ?? '').trim();
  const idx = trimmed.indexOf('다.');
  return idx >= 0 ? trimmed.slice(0, idx + 2) : trimmed;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// 2026-08-27 실측 교정 — 처음엔 momentum(rise/steady/caution) 교집합으로 판정했는데
//   12개월 중 both_good 이 **8개** 나왔다. "언제가 좋냐"에 여덟 달을 답하면 답이 아니다.
//   rise 는 애초에 흔한 신호라 교집합이 넓다. 그래서 **연 전망과 같은 방식**(간지 × 각자 일주)
//   으로 달도 점수화해 **순위**로 뽑는다 — 상위 3 · 하위 2 가 항상 나오고 변별력이 생긴다.
//   momentum 은 판정에서 빼고, 본문(기회/주의 문장)의 재료로만 계속 쓴다.
function scoreMonth(
  flow: YearlyMonthFlow,
  self: CoupleTimingPerson,
  partner: CoupleTimingPerson
): { score: number; gap: number; selfRaw: number; partnerRaw: number } | null {
  const ganji = flow.monthlyGanji;
  // 절입 계산이 안 된 달은 점수를 지어내지 않는다 — 순위에서 빠지고 '평소 리듬' 으로 남는다.
  if (!ganji || ganji.length < 2) return null;
  const stem = ganji[0] as Stem;
  const branch = ganji[1] as Branch;
  const selfRaw = scoreYearForPerson(stem, branch, self.data);
  const partnerRaw = scoreYearForPerson(stem, branch, partner.data);
  return {
    score: clampScore(70 + selfRaw + partnerRaw),
    gap: Math.abs(selfRaw - partnerRaw),
    selfRaw,
    partnerRaw,
  };
}

function buildMonth(
  selfName: string,
  partnerName: string,
  selfFlow: YearlyMonthFlow,
  partnerFlow: YearlyMonthFlow,
  verdict: CoupleMonthVerdict,
  metrics: { score: number; gap: number; selfRaw: number; partnerRaw: number } | null
): CoupleMonth {
  const favors: 'self' | 'partner' | null =
    verdict === 'mixed'
      ? (metrics ? (metrics.selfRaw >= metrics.partnerRaw ? 'self' : 'partner') : 'self')
      : null;
  const base = {
    month: selfFlow.month,
    label: selfFlow.label,
    verdict,
    score: metrics?.score ?? 70,
    gap: metrics?.gap ?? 0,
    favors,
  };

  if (verdict === 'both_good') {
    // 기회 문장은 그 달 흐름이 열린 쪽에서 가져온다 — 둘 다 steady 여도 순위로 뽑힐 수 있다.
    const source = selfFlow.momentum === 'rise' ? selfFlow : partnerFlow;
    return {
      ...base,
      title: '함께 움직이기 좋은 달',
      body: `${selfName}님과 ${partnerName}님 두 분 명식에 이 달 기운이 비교적 순하게 들어옵니다. 미뤄 둔 이야기를 꺼내거나 함께 결정할 일을 이때로 모으면 수월한 편입니다. ${firstSentence(source.opportunity)}`,
    };
  }

  if (verdict === 'both_caution') {
    const source = selfFlow.momentum === 'caution' ? selfFlow : partnerFlow;
    return {
      ...base,
      title: '무리하지 않는 편이 나은 달',
      body: `이 달 기운은 두 분 모두에게 부담으로 걸리기 쉽습니다. 큰 결정을 이때로 잡기보다 한 달 미루는 편이 낫습니다. ${firstSentence(source.caution)}`,
    };
  }

  if (verdict === 'mixed') {
    const upName = favors === 'self' ? selfName : partnerName;
    const downName = favors === 'self' ? partnerName : selfName;
    const downFlow = favors === 'self' ? partnerFlow : selfFlow;
    return {
      ...base,
      title: '한 사람이 끌어야 하는 달',
      body: `${upName}님 쪽은 흐름이 받쳐 주는데 ${downName}님 쪽은 눌리기 쉬운 달입니다. 이런 달엔 ${upName}님이 일정과 결정을 맡고 ${downName}님은 속도를 늦추는 쪽이 서로 편합니다. ${firstSentence(downFlow.caution)}`,
    };
  }

  return {
    ...base,
    title: '평소 리듬을 지키는 달',
    body: '크게 밀어붙일 일도, 특별히 조심할 일도 두드러지지 않는 달입니다. 평소 하던 리듬을 유지하는 편이 좋습니다.',
  };
}

/**
 * 세운 간지 하나가 한 사람에게 어떻게 들어오는지 — **점수만** 쓴다.
 * ⚠️ summarize*Interaction 의 body/title 은 사람 대 사람 어투라 여기서 재사용하면 비문이 된다.
 */
function scoreYearForPerson(
  yearStem: Stem,
  yearBranch: Branch,
  data: SajuDataV1 | SajuDataV2
): number {
  const stem = summarizeStemInteraction(data.dayMaster.stem as Stem, yearStem).score;
  const branch = summarizeBranchInteraction(
    data.pillars.day.branch as Branch,
    yearBranch
  ).totalScore;
  return stem + branch;
}

function buildYearOutlook(
  year: number,
  self: CoupleTimingPerson,
  partner: CoupleTimingPerson
): CoupleYearOutlook {
  const ganji = yearToGanji(year);
  const yearStem = ganji[0] as Stem;
  const yearBranch = ganji[1] as Branch;
  const ganjiKo = `${stemCharToKorean(yearStem)}${branchCharToKorean(yearBranch)}`;

  const selfScore = scoreYearForPerson(yearStem, yearBranch, self.data);
  const partnerScore = scoreYearForPerson(yearStem, yearBranch, partner.data);
  const score = clampScore(70 + selfScore + partnerScore);

  // 한쪽만 크게 눌리는 해는 "둘 다 좋다/나쁘다" 로 뭉뚱그리면 거짓말이 된다.
  const gap = Math.abs(selfScore - partnerScore);
  const lower = selfScore <= partnerScore ? self.name : partner.name;

  if (score >= 80) {
    return {
      year,
      label: `${year}년 ${ganjiKo}년`,
      score,
      verdict: '함께 벌이기 좋은 해',
      body: `${ganjiKo} 세운이 두 분 명식에 비교적 순하게 들어오는 해라, 함께 시작하거나 크게 움직이는 일을 이 해에 맞추면 힘이 덜 드는 편입니다.`,
    };
  }
  if (score <= 62) {
    return {
      year,
      label: `${year}년 ${ganjiKo}년`,
      score,
      verdict: '무리하지 않는 편이 나은 해',
      body: `${ganjiKo} 세운이 두 분 모두에게 부담으로 걸리는 해라, 새로 벌이기보다 이미 있는 것을 지키는 쪽이 안전한 편입니다.`,
    };
  }
  if (gap >= 10) {
    return {
      year,
      label: `${year}년 ${ganjiKo}년`,
      score,
      verdict: '한 사람 사정을 먼저 보는 해',
      body: `${ganjiKo} 세운이 두 분에게 다르게 들어오는 해입니다. ${lower}님 쪽이 더 눌리기 쉬우니, 일정과 부담을 그쪽 사정에 맞춰 조절하는 편이 좋습니다.`,
    };
  }
  return {
    year,
    label: `${year}년 ${ganjiKo}년`,
    score,
    verdict: '흐름을 지키는 해',
    body: `${ganjiKo} 세운은 크게 밀어주지도 막지도 않는 편입니다. 큰 결정은 아래 달 흐름을 보고 시점을 고르는 쪽이 낫습니다.`,
  };
}

/**
 * 순위 배정 — 절대 임계값이 아니라 **그 커플의 12개월 안에서** 상대적으로 고른다.
 *   임계값을 쓰면 어떤 커플은 좋은 달이 0개, 어떤 커플은 8개가 되어 답이 안 된다.
 *   상위 3 = 함께 움직이기 좋은 달 / 하위 2 = 무리하지 않는 달 /
 *   나머지 중 두 사람 격차가 큰 2개 = 한 사람이 끌어야 하는 달.
 */
function assignVerdicts(
  metrics: Array<{ month: number; score: number; gap: number } | null>
): Map<number, CoupleMonthVerdict> {
  const scored = metrics.filter((m): m is { month: number; score: number; gap: number } => m !== null);
  const verdicts = new Map<number, CoupleMonthVerdict>();

  const byScore = [...scored].sort((a, b) => b.score - a.score || a.month - b.month);
  byScore.slice(0, 3).forEach((m) => verdicts.set(m.month, 'both_good'));
  [...byScore]
    .reverse()
    .filter((m) => !verdicts.has(m.month))
    .slice(0, 2)
    .forEach((m) => verdicts.set(m.month, 'both_caution'));

  scored
    .filter((m) => !verdicts.has(m.month))
    .sort((a, b) => b.gap - a.gap || a.month - b.month)
    .slice(0, 2)
    // 격차가 0 이면 '엇갈린다' 는 말이 거짓이 된다 — 그런 달은 평소 리듬으로 둔다.
    .filter((m) => m.gap > 0)
    .forEach((m) => verdicts.set(m.month, 'mixed'));

  return verdicts;
}

/** 다가오는 달을 먼저 본다 — 목록은 달 순서로 되돌린다. */
function pick(months: CoupleMonth[], verdict: CoupleMonthVerdict): CoupleMonth[] {
  return months.filter((m) => m.verdict === verdict);
}

export function buildCoupleTimingReport(input: {
  self: CoupleTimingPerson;
  partner: CoupleTimingPerson;
  now?: Date;
  /** 연 전망 개수(올해 포함). 기본 3 — 세운 계산은 가벼워 늘려도 부담 없다. */
  yearCount?: number;
}): CoupleTimingReport {
  const now = input.now ?? new Date();
  const year = now.getFullYear();

  const selfYearly = buildYearlyReport(input.self.birthInput, input.self.data, year);
  const partnerYearly = buildYearlyReport(input.partner.birthInput, input.partner.data, year);

  const metrics = selfYearly.monthlyFlows.map((flow) =>
    scoreMonth(flow, input.self, input.partner)
  );
  const verdicts = assignVerdicts(
    selfYearly.monthlyFlows.map((flow, index) => {
      const m = metrics[index];
      return m ? { month: flow.month, score: m.score, gap: m.gap } : null;
    })
  );

  const months = selfYearly.monthlyFlows.map((selfFlow, index) =>
    buildMonth(
      input.self.name,
      input.partner.name,
      selfFlow,
      partnerYearly.monthlyFlows[index],
      verdicts.get(selfFlow.month) ?? 'quiet',
      metrics[index]
    )
  );

  const yearCount = Math.max(1, input.yearCount ?? 3);
  const years = Array.from({ length: yearCount }, (_, offset) =>
    buildYearOutlook(year + offset, input.self, input.partner)
  );

  return {
    year,
    months,
    bestMonths: pick(months, 'both_good'),
    cautionMonths: pick(months, 'both_caution'),
    mixedMonths: pick(months, 'mixed'),
    years,
  };
}
