// Redesign 2026-05-13 (Claude Design / screens-a.jsx §4 ScreenToday):
// 날짜 eyebrow + 헤드라인 (총운 N점 highlight). 데이터 로직 무수정.
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

function formatToday() {
  return DATE_FORMATTER.format(new Date()).replace(/\.$/, '');
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 70;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getOverallScore(result: TodayFortuneFreeResult) {
  const overall = result.scores.find((score) => score.key === 'overall')?.score;
  if (typeof overall === 'number') return clampScore(overall);
  const scores = result.scores.map((item) => item.score).filter(Number.isFinite);
  if (scores.length === 0) return 70;
  return clampScore(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function TodayFortuneSummaryCard({
  result,
}: {
  result: TodayFortuneFreeResult;
}) {
  const overall = getOverallScore(result);
  const todayLabel = formatToday();

  return (
    <section className="px-1">
      <div className="text-[12px] font-bold tracking-[0.04em] text-[var(--app-copy-muted)]">
        {todayLabel}
      </div>
      {/* 2026-05-15 — 사용자 이름 (input.name) 을 무시하고 항상 "달빛이님" 으로 출력하던 회귀 fix.
          빌더가 채워준 result.userName 우선 사용, 없을 때만 "달빛이" fallback. */}
      <h2 className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]">
        {result.userName ?? '달빛이'}님,
        <br />
        <span className="text-[var(--app-pink-strong)]">총운 {overall}점</span>
        으로 시작
      </h2>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-[11px] font-bold text-[var(--app-pink-strong)]">
          {result.oneLine.eyebrow}
        </span>
        <span className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--app-copy-muted)]">
          무료 결과
        </span>
      </div>
    </section>
  );
}
