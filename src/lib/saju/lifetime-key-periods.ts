// 2026-10-10 — 인생 주요 시기 요약(점검 B #4). 0~100세 연도표(101행)는 있었지만 "언제가 중요한가"를 한눈에 볼 곳이 없었다.
//   해마다 그해 기운(세운)을 신년운세와 같은 규칙(analyzeLuckGanji)으로 읽어 좋은 시기·조심할 시기를 고르고,
//   앞으로의 대운 전환 해를 더한다. 결정론 — 사건을 예고하지 않고 "조건이 맞물리는 해"로만 쓴다.
import { Solar } from 'lunar-typescript';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { analyzeLuckGanji, type BranchRelationKind } from '@/domain/saju/report/monthly-signals';
import { koreanizeGanzi } from '@/lib/saju/terminology';

export interface LifetimeKeyPeriod {
  year: number;
  age: number;
  kind: '좋은 시기' | '조심할 시기' | '전환기';
  reason: string;
}

const JOIN: BranchRelationKind[] = ['육합', '삼합', '방합'];
const CLASH: BranchRelationKind[] = ['충'];
const FRICTION: BranchRelationKind[] = ['형', '원진'];
const FIT_SCORE = { support: 2, mixed: 0, neutral: 0, burden: -1 } as const;
const FIT_TEXT = { support: '필요한 기운이 들어오는 해', mixed: '필요한 기운과 부담이 함께 오는 해', neutral: '균형을 크게 흔들지 않는 해', burden: '이미 넘치는 기운이 더해지는 해' } as const;

export function buildLifetimeKeyPeriods(
  sajuData: SajuDataV1 | SajuDataV2,
  birthYear: number,
  currentYear: number,
): LifetimeKeyPeriod[] {
  // 2026-10-11 사용자 피드백 — 지나온 해는 다루지 않는다(올해부터 앞으로).
  const from = Math.max(birthYear, currentYear);
  const to = birthYear + 85;
  const scored: Array<LifetimeKeyPeriod & { score: number }> = [];
  for (let year = from; year <= to; year += 1) {
    let ganji: string;
    try {
      ganji = Solar.fromYmd(year, 6, 15).getLunar().getYearInGanZhi();
    } catch {
      continue;
    }
    const analysis = analyzeLuckGanji({ ganji, dayMasterStem: sajuData.dayMaster.stem, pillars: sajuData.pillars, yongsin: sajuData.yongsin });
    const day = analysis.natalRelations.find((r) => r.pillar === 'day');
    const other = analysis.natalRelations.find((r) => r.pillar !== 'day');
    let score = FIT_SCORE[analysis.yongsinFit];
    if (day && JOIN.includes(day.kind)) score += 2;
    if (day && CLASH.includes(day.kind)) score -= 2;
    if (day && FRICTION.includes(day.kind)) score -= 1;
    if (other && CLASH.includes(other.kind)) score -= 1;
    const relation = day ?? other;
    const reason = [
      `${koreanizeGanzi(ganji)}년 — ${FIT_TEXT[analysis.yongsinFit]}`,
      relation ? `${relation.palace} 자리와 ${JOIN.includes(relation.kind) ? '맞물림' : CLASH.includes(relation.kind) ? '부딪힘' : '긴장'}(${relation.kind})` : null,
    ].filter(Boolean).join(', ');
    scored.push({ year, age: year - birthYear, kind: score >= 0 ? '좋은 시기' : '조심할 시기', reason, score });
  }

  const good = scored.filter((s) => s.score >= 3).sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 3);
  const caution = scored.filter((s) => s.score <= -2).sort((a, b) => a.score - b.score || a.year - b.year).slice(0, 2);
  const transitions = (sajuData.majorLuck ?? [])
    .filter((cycle) => cycle.startAge !== null && birthYear + cycle.startAge! > currentYear)
    .slice(0, 2)
    .map((cycle) => ({
      year: birthYear + cycle.startAge!,
      age: cycle.startAge!,
      kind: '전환기' as const,
      reason: `${koreanizeGanzi(cycle.ganzi)} 대운이 시작되는 해 — 10년 단위의 큰 흐름이 바뀌어, 앞뒤 1~2년은 생활 기준을 다시 세우기 좋습니다`,
    }));

  return [...good, ...caution, ...transitions]
    .map(({ year, age, kind, reason }) => ({ year, age, kind, reason }))
    .sort((a, b) => a.year - b.year);
}
