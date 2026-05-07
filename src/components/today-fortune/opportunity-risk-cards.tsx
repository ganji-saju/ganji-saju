import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

export function OpportunityRiskCards({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-[1.45rem] border border-emerald-200 bg-emerald-50/70 p-5">
        <div className="app-caption text-emerald-700">오늘 해볼 일</div>
        <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--app-ink)]">{result.opportunity.title}</h3>
        <p className="mt-3 text-[15px] leading-8 text-[var(--app-copy)]">{result.opportunity.body}</p>
      </article>
      <article className="rounded-[1.45rem] border border-rose-200 bg-rose-50/70 p-5">
        <div className="app-caption text-rose-600">오늘 줄일 일</div>
        <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--app-ink)]">{result.risk.title}</h3>
        <p className="mt-3 text-[15px] leading-8 text-[var(--app-copy)]">{result.risk.body}</p>
      </article>
    </section>
  );
}
