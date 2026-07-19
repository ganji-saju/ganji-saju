// Redesign 2026-05-13 (Claude Design / screens-a.jsx §4 ScreenToday):
// 날짜 eyebrow + 헤드라인 (총운 N점 highlight). 데이터 로직 무수정.
// 2026-05-16 PR #149 (Part C) — userSituation 있으면 "[직장인 · 사업 고민] 관점에서 오늘" 한 줄 추가.
// 2026-06-22 — aiSource 노출 시 AI 생성 고지 배지 추가 (spec §8 safety).
import Link from 'next/link';
import { buildPerspectiveLine } from '@/lib/today-fortune/situation-score-priority';
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';
import { MOONLIGHT_FALLBACK_DISPLAY_NAME } from '@/lib/today-fortune/resolve-display-name';
import { shouldShowAiDisclosure } from './ai-disclosure';

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
  const perspective = buildPerspectiveLine(result.userSituation);
  const showAiDisclosure = shouldShowAiDisclosure(result.aiSource);

  return (
    <section className="px-1">
      <div className="text-[13.8px] font-bold tracking-[0.04em] text-[var(--app-copy-muted)]">
        {todayLabel}
      </div>
      {/* 2026-05-15 — 사용자 이름 (input.name) 을 무시하고 항상 "달빛이님" 으로 출력하던 회귀 fix.
          빌더가 채워준 result.userName 우선 사용, 없을 때만 "달빛이" fallback. */}
      <h2 className="mt-1.5 text-[29.9px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]">
        {result.userName ?? MOONLIGHT_FALLBACK_DISPLAY_NAME}님,
        <br />
        <span className="text-[var(--app-pink-strong)]">총운 {overall}점</span>
        으로 시작
      </h2>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-[12px] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-[12.6px] font-bold text-[var(--app-pink-strong)]">
          {result.oneLine.eyebrow}
        </span>
        <span className="rounded-[12px] border border-[var(--app-line)] bg-white px-3 py-1 text-[12.6px] font-medium text-[var(--app-copy-muted)]">
          무료 결과
        </span>
      </div>
      {/* PR #149 (Part C) — 사용자 상황 있으면 perspective 한 줄 노출. */}
      {perspective ? (
        <p
          className="mt-2 text-[15px] font-bold leading-[1.4] text-[var(--app-pink-strong)]"
          style={{ wordBreak: 'keep-all' }}
        >
          🎯 {perspective} 오늘
        </p>
      ) : null}
      {/* spec §8 safety — AI 생성 시 고지 배지. 결정론(fallback/미설정)은 미노출. */}
      {showAiDisclosure ? (
        <Link
          href="/ai-disclaimer"
          className="mt-2 inline-flex items-center gap-1 rounded-[12px] border border-[var(--app-line)] bg-[var(--app-surface)] px-2.5 py-0.5 text-[12.6px] text-[var(--app-copy-soft)] hover:text-[var(--app-copy-muted)]"
        >
          <span aria-hidden="true">ℹ</span>
          AI 생성 풀이 · 참고용
        </Link>
      ) : null}
    </section>
  );
}
