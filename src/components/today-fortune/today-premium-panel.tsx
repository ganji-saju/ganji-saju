import type { TodayFortunePremiumResult } from '@/lib/today-fortune/types';

function trimEasySentence(value: string) {
  const cleaned = value
    .replace(/시간대별/g, '')
    .replace(/선택 시나리오/g, '고민되는 상황')
    .replace(/시나리오/g, '상황')
    .replace(/유리/g, '좋은')
    .replace(/주의/g, '조심')
    .replace(/권장/g, '추천')
    .replace(/흐름/g, '분위기')
    .replace(/기준/g, '생각할 점')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const firstSentence = cleaned.split(/(?<=[.!?。])\s+/u)[0]?.trim() ?? cleaned;
  return firstSentence.length > 64 ? `${firstSentence.slice(0, 64).trim()}...` : firstSentence;
}

export function TodayPremiumPanel({
  result,
}: {
  result: TodayFortunePremiumResult;
}) {
  const favorableWindows = result.favorableWindows.slice(0, 2);
  const cautionWindows = result.cautionWindows.slice(0, 1);
  const recommendedActions = result.recommendedActions.slice(0, 3).map(trimEasySentence);
  const avoidActions = result.avoidActions.slice(0, 3).map(trimEasySentence);
  const scenarios = result.scenarios.slice(0, 2);

  return (
    <section className="space-y-5 rounded-[1.8rem] border border-[var(--app-pink-line)] bg-white p-6 shadow-[0_18px_46px_rgba(236,72,153,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="app-caption text-[var(--app-pink)]">오늘 자세히 보기</div>
          <h3 className="mt-3 text-2xl font-semibold leading-8 text-[var(--app-ink)]">오늘은 이렇게 움직이면 좋아요</h3>
        </div>
        <span className="rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-pink)]">
          550원 풀이
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-sm font-semibold text-[var(--app-jade)]">좋은 시간</div>
          <div className="mt-4 space-y-3">
            {favorableWindows.map((item) => (
              <div key={`${item.range}-${item.title}`} className="rounded-[1rem] border border-emerald-200 bg-white p-4">
                <div className="text-xs font-semibold text-[var(--app-jade)]">{item.range}</div>
                <div className="mt-2 text-base font-semibold text-[var(--app-ink)]">{trimEasySentence(item.title)}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--app-copy)]">{trimEasySentence(item.body)}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.35rem] border border-rose-200 bg-rose-50 p-5">
          <div className="text-sm font-semibold text-[var(--app-coral)]">조심할 시간</div>
          <div className="mt-4 space-y-3">
            {cautionWindows.map((item) => (
              <div key={`${item.range}-${item.title}`} className="rounded-[1rem] border border-rose-200 bg-white p-4">
                <div className="text-xs font-semibold text-[var(--app-coral)]">{item.range}</div>
                <div className="mt-2 text-base font-semibold text-[var(--app-ink)]">{trimEasySentence(item.title)}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--app-copy)]">{trimEasySentence(item.body)}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
          <div className="text-sm font-semibold text-[var(--app-ink)]">오늘 해볼 것</div>
          <div className="mt-4 space-y-3">
            {recommendedActions.map((item) => (
              <div key={item} className="rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
                {item}
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
          <div className="text-sm font-semibold text-[var(--app-ink)]">오늘 줄일 것</div>
          <div className="mt-4 space-y-3">
            {avoidActions.map((item) => (
              <div key={item} className="rounded-[1rem] border border-[var(--app-line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--app-copy)]">
                {item}
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-[1.35rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
        <div className="text-sm font-semibold text-[var(--app-ink)]">고민될 때</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <section key={scenario.title} className="rounded-[1rem] border border-[var(--app-line)] bg-white p-4">
              <div className="text-base font-semibold text-[var(--app-ink)]">{trimEasySentence(scenario.title)}</div>
              <p className="mt-3 text-sm leading-6 text-[var(--app-copy)]">
                <span className="font-semibold text-[var(--app-pink-strong)]">이렇게 해보세요. </span>
                {trimEasySentence(scenario.better)}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--app-copy-soft)]">
                <span className="font-semibold text-[var(--app-ink)]">이건 줄여요. </span>
                {trimEasySentence(scenario.watch)}
              </p>
            </section>
          ))}
        </div>
      </article>

      <details className="rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--app-copy)]">풀이 기준 보기</summary>
        <div className="mt-4 space-y-2 text-xs leading-6 text-[var(--app-copy-soft)]">
          <p>오늘 분위기와 입력 정보를 함께 참고해 정리했습니다.</p>
          <p>{result.safetyNote}</p>
        </div>
      </details>
    </section>
  );
}
