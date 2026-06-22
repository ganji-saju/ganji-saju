// Redesign 2026-05-13 (Claude Design / screens-a.jsx §4 ScreenToday — 4-card grid):
// 라벨 + 점수 + 막대 + 1줄 요약. 2 컬럼 그리드.
// 데이터(scores) 무수정 — overall 은 제외하고 5축까지 표시.
import type { TodayFortuneFreeResult, TodayScoreItem } from '@/lib/today-fortune/types';

const TONE_COLOR: Record<TodayScoreItem['key'], string> = {
  overall: 'var(--app-pink-strong)',
  love: 'var(--app-coral)',
  wealth: 'var(--app-amber)',
  career: 'var(--app-jade)',
  relationship: 'var(--app-sky)',
  condition: 'var(--app-plum)',
};

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 70;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function TodayFortuneScoreGrid({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  // mockup: overall 은 banner 에서 이미 보여줬으므로 grid 에서는 제외
  const cells = result.scores.filter((item) => item.key !== 'overall');

  return (
    <section aria-label="6축 점수" className="px-0">
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map((score) => {
          const value = clampScore(score.score);
          const color = TONE_COLOR[score.key] ?? 'var(--app-pink-strong)';
          return (
            <article
              key={score.key}
              className="rounded-[18px] border border-[var(--app-line)] bg-white p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[var(--app-ink)]">
                  {score.label}
                </span>
                <span
                  className="text-[16px] font-extrabold"
                  style={{ color }}
                >
                  {value}
                </span>
              </div>
              <div
                className="relative mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--app-line)' }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${value}%`, background: color }}
                />
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--app-copy-muted)]">
                {score.summary}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
