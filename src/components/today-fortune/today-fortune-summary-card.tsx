import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

export function TodayFortuneSummaryCard({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  return (
    <section className="dalbit-section p-6 sm:p-7">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-xs font-bold text-[var(--app-pink-strong)]">
            {result.oneLine.eyebrow}
          </span>
          <span className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--app-copy-muted)]">
            무료 결과
          </span>
        </div>
        <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[var(--app-ink)] sm:text-4xl">
          {result.oneLine.headline}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-[var(--app-copy)]">
          {result.oneLine.body}
        </p>
      </div>
    </section>
  );
}
