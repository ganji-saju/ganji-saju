import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

export function SajuReasonSnippet({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  return (
    <section className="rounded-[1.45rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
      <div className="app-caption">오늘 흐름 1줄</div>
      <div className="mt-2 text-xs tracking-[0.18em] text-[var(--app-gold-soft)]">
        핵심 힌트 · {result.groundingSummary.primaryConcept}
      </div>
      <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">{result.reasonSnippet.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.groundingSummary.factLines.slice(0, 4).map((line) => (
          <span
            key={line}
            className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs leading-6 text-[var(--app-copy-soft)]"
          >
            {line}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {result.groundingSummary.evidenceLines.slice(0, 2).map((line) => (
          <div
            key={line}
            className="rounded-[1rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--app-copy)]"
          >
            {line}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-6 text-[var(--app-copy-soft)]">
        {result.groundingSummary.kasi.summary}
      </p>
    </section>
  );
}
