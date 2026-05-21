// 2026-05-21 — 오행 균형 막대(Phase 3). 다섯 기운 분포(0~8) + 부족/과다 칩.
//   chart.colors/labels 는 visual-tokens(OHAENG_TOKENS) 파생. getBarFillPercent 재사용. 서버 컴포넌트.
import type { OhaengChartData, Ohaeng } from '@/lib/saju-score';
import { getBarFillPercent } from '@/lib/saju-score';
import { cn } from '@/lib/utils';

interface Props {
  chart: OhaengChartData;
  className?: string;
}

const ELEMENTS: Ohaeng[] = ['목', '화', '토', '금', '수'];

export function SajuOhaengBalance({ chart, className }: Props) {
  const maxCount = Math.max(1, ...ELEMENTS.map((el) => chart.counts[el]));

  return (
    <div className={cn('grid gap-2.5', className)}>
      {ELEMENTS.map((el) => {
        const count = chart.counts[el];
        const hex = chart.colors[el];
        const pct = getBarFillPercent(count, maxCount);
        return (
          <div key={el} className="flex items-center gap-3">
            <span className="w-[44px] shrink-0 text-[12px] font-bold text-[var(--app-ink)]">
              {chart.labels[el]}
            </span>
            <div
              className="relative h-2 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--app-line)' }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: hex }}
              />
            </div>
            <span className="w-[18px] shrink-0 text-right text-[12px] font-bold tabular-nums" style={{ color: hex }}>
              {count}
            </span>
          </div>
        );
      })}

      {(chart.lack.length > 0 || chart.excess.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {chart.lack.map((el) => (
            <span
              key={`lack-${el}`}
              className="rounded-full bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-copy)]"
            >
              {chart.labels[el]} 부족
            </span>
          ))}
          {chart.excess.map((el) => (
            <span
              key={`excess-${el}`}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: chart.colors[el] }}
            >
              {chart.labels[el]} 과다
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
