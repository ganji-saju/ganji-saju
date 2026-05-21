// 2026-05-21 — 점수 내역(F1~F5) 막대(Phase 3). 지표별 라벨·값/만점·fill%.
//   BREAKDOWN_ORDER + getBreakdownFactorMeta + getBarFillPercent 단일 소스. 서버 컴포넌트.
import type { SajuScore } from '@/lib/saju-score';
import { BREAKDOWN_ORDER, getBreakdownFactorMeta, getBarFillPercent } from '@/lib/saju-score';
import { cn } from '@/lib/utils';

interface Props {
  breakdown: SajuScore['breakdown'];
  className?: string;
}

export function SajuScoreBreakdown({ breakdown, className }: Props) {
  return (
    <div className={cn('grid gap-3', className)}>
      {BREAKDOWN_ORDER.map((key) => {
        const meta = getBreakdownFactorMeta(key);
        const value = Math.round(breakdown[key]);
        const pct = getBarFillPercent(value, meta.max);
        return (
          <div key={key}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[var(--app-ink)]">{meta.label}</span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: meta.hex }}>
                {value}
                <span className="text-[var(--app-copy-muted)]">/{meta.max}</span>
              </span>
            </div>
            <div
              className="relative mt-1.5 h-2 overflow-hidden rounded-full"
              style={{ background: 'var(--app-line)' }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: meta.hex }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[var(--app-copy-soft)]">{meta.description}</p>
          </div>
        );
      })}
    </div>
  );
}
