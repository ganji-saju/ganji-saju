import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

export function SajuReasonSnippet({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  return (
    <section className="rounded-[1.45rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] p-5">
      <div className="app-caption text-[var(--app-pink-strong)]">왜 이렇게 보이나요?</div>
      <p className="mt-3 text-[17.3px] leading-8 text-[var(--app-copy)]">{result.reasonSnippet.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.groundingSummary.factLines.slice(0, 3).map((line) => (
          <span
            key={line}
            className="rounded-[12px] border border-white/70 bg-white/80 px-3 py-1 text-sm leading-6 text-[var(--app-copy-muted)]"
          >
            {line}
          </span>
        ))}
      </div>
    </section>
  );
}
