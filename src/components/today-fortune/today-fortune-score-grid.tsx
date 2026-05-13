import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

const TONES: Record<string, string> = {
  overall: 'border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  love: 'border-[var(--app-plum)]/24 bg-[var(--app-plum)]/10 text-[var(--app-plum-text)]',
  wealth: 'border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10 text-[var(--app-jade)]',
  career: 'border-[var(--app-sky)]/24 bg-[var(--app-sky)]/10 text-[var(--app-sky-text)]',
  relationship: 'border-[var(--app-coral)]/24 bg-[var(--app-coral)]/10 text-[var(--app-coral-text)]',
  condition: 'border-[var(--app-gold)]/20 bg-[rgba(255,255,255,0.03)] text-[var(--app-copy)]',
};

export function TodayFortuneScoreGrid({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  return (
    <section className="app-panel p-6">
      <div className="app-caption">6축 점수</div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {result.scores.map((score) => (
          <article
            key={score.key}
            className={`rounded-[1.2rem] border px-4 py-4 ${TONES[score.key] ?? TONES.condition}`}
          >
            <div className="text-xs tracking-[0.18em]">{score.label}</div>
            <div className="mt-3 text-3xl font-semibold">
              {score.score}
            </div>
            <p className="mt-2 text-xs leading-6 opacity-90">{score.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
