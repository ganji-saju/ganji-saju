// 2026-05-22 — Phase 2+3 스펙 §7: 큰 원형 점수 카드 + 카운트업.
//   (이전 composite 버전 대체 — 스펙 모델은 SajuScoreCard/ScoreBreakdownCard/OhaengChart/Carousel 분리 배치)
'use client';

import { useEffect, useState } from 'react';
import type { SajuScore } from '@/lib/saju-score';
import { getScoreColorClasses, SCORE_DISCLAIMER } from '@/lib/saju-score';
import { cn } from '@/lib/utils';

interface SajuScoreCardProps {
  score: SajuScore;
  animateOnMount?: boolean;
  className?: string;
}

function useCountUp(target: number, animate: boolean, duration = 1000): number {
  const [value, setValue] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOut
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animate, duration]);
  return value;
}

export function SajuScoreCard({ score, animateOnMount = true, className = '' }: SajuScoreCardProps) {
  const display = useCountUp(score.total, animateOnMount);
  const colors = getScoreColorClasses(score.label.level);

  return (
    <div className={cn('rounded-2xl p-5', colors.bgSoft, className)}>
      <div className="flex flex-col items-center py-4">
        <div className={cn('relative flex h-40 w-40 items-center justify-center rounded-full ring-4 sm:h-48 sm:w-48', colors.ring)}>
          <div className={cn('flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-full sm:h-40 sm:w-40', colors.bgSoft)}>
            <span className={cn('text-5xl font-bold tabular-nums', colors.text)} aria-label={`${score.total}점`}>
              {display}
            </span>
            <span className={cn('px-2 text-center text-sm font-semibold leading-tight', colors.text)}>
              {score.label.title}
            </span>
          </div>
        </div>
        <p className="mt-3 text-center text-sm leading-relaxed text-gray-600" style={{ wordBreak: 'keep-all' }}>
          {score.label.subtitle}
        </p>
      </div>

      <div className="mt-1 border-t border-gray-200/60 pt-3">
        <p className="text-center text-[13px] leading-relaxed text-gray-400">{SCORE_DISCLAIMER}</p>
      </div>
    </div>
  );
}
