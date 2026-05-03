import type { TodayFortunePremiumResult } from '@/lib/today-fortune/types';

export function TodayPremiumPanel({
  result,
}: {
  result: TodayFortunePremiumResult;
}) {
  return (
    <section className="space-y-5 rounded-[1.8rem] border border-[var(--app-pink-line)] bg-white p-6 shadow-[0_18px_46px_rgba(236,72,153,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="app-caption text-[var(--app-pink)]">오늘 자세히 보기</div>
          <h3 className="mt-3 text-2xl font-semibold text-[var(--app-ink)]">시간대와 선택 시나리오까지 열렸습니다</h3>
        </div>
        <span className="rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-pink)]">
          550원 풀이
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-5">
          <div className="app-caption text-[var(--app-jade)]">시간대별 유리 행동</div>
          <div className="mt-4 space-y-3">
            {result.favorableWindows.map((item) => (
              <div key={`${item.range}-${item.title}`} className="rounded-[1rem] border border-emerald-200 bg-white p-4">
                <div className="text-xs tracking-[0.18em] text-[var(--app-jade)]">{item.range}</div>
                <div className="mt-2 text-base font-semibold text-[var(--app-ink)]">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{item.body}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-5">
          <div className="app-caption text-[var(--app-coral)]">시간대별 주의 행동</div>
          <div className="mt-4 space-y-3">
            {result.cautionWindows.map((item) => (
              <div key={`${item.range}-${item.title}`} className="rounded-[1rem] border border-rose-200 bg-white p-4">
                <div className="text-xs tracking-[0.18em] text-[var(--app-coral)]">{item.range}</div>
                <div className="mt-2 text-base font-semibold text-[var(--app-ink)]">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{item.body}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
          <div className="app-caption">추천 행동 3가지</div>
          <div className="mt-4 space-y-3">
            {result.recommendedActions.map((item) => (
              <div key={item} className="rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
                {item}
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
          <div className="app-caption">피해야 할 행동 3가지</div>
          <div className="mt-4 space-y-3">
            {result.avoidActions.map((item) => (
              <div key={item} className="rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
                {item}
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
        <div className="app-caption">선택 시나리오 비교</div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {result.scenarios.map((scenario) => (
            <section key={scenario.title} className="rounded-[1rem] border border-[var(--app-line)] bg-white p-4">
              <div className="text-base font-semibold text-[var(--app-ink)]">{scenario.title}</div>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{scenario.better}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--app-copy-soft)]">{scenario.watch}</p>
            </section>
          ))}
        </div>
      </article>

      <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
        <div className="app-caption">풀이에 참고한 단서</div>
        <div className="mt-2 text-xs font-semibold text-[var(--app-pink)]">
          오늘 흐름 · {result.groundingSummary.primaryConcept}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.groundingSummary.factLines.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1 text-xs leading-6 text-[var(--app-copy-soft)]"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {result.groundingSummary.evidenceLines.map((item) => (
            <div key={item} className="rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
              {item}
            </div>
          ))}
          {result.evidenceLines.map((item) => (
            <div key={item} className="rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
              {item}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-6 text-[var(--app-copy-soft)]">{result.groundingSummary.kasi.summary}</p>
        <p className="mt-3 text-xs leading-6 text-[var(--app-copy-soft)]">{result.safetyNote}</p>
      </article>
    </section>
  );
}
