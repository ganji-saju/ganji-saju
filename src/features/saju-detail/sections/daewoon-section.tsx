// 2026-08-25 전면 개편 — 사주 결과 단일 페이지화. 구 /saju/[slug]/deep(대운 탭) 본문 이동:
//   현재 대운 안내 + 타임라인 스트립 + 시기별 8단 풀이(접이식 카드).
//   구 페이지의 평생리포트 업셀은 결과 페이지의 결제 동선(9,900 단일 오퍼 원칙)으로 이관.

import type { LifetimeMajorLuckCycle } from '@/domain/saju/report/lifetime-types';
import { DaewoonTimelineStrip } from '@/features/saju-detail/daewoon-timeline-strip';
import { ganziForBody } from '@/lib/saju/terminology';

// 한자 ganzi → 한글 발음. "丁酉" → "정유".

function CycleCard({ cycle, defaultOpen }: { cycle: LifetimeMajorLuckCycle; defaultOpen: boolean }) {
  const ganziLabel = ganziForBody(cycle.ganzi);
  const phaseColor =
    cycle.phase === '성장기'
      ? 'var(--app-jade)'
      : cycle.phase === '전달기'
        ? 'var(--app-pink-strong)'
        : cycle.phase === '결정기'
          ? 'var(--app-amber)'
          : cycle.phase === '기반기'
            ? 'var(--app-indigo)'
            : cycle.phase === '준비기'
              ? 'var(--app-plum)'
              : 'var(--app-copy-muted)';
  const transitionChip =
    cycle.transitionPhase === 'entering'
      ? '교운기 진입'
      : cycle.transitionPhase === 'leaving'
        ? '교운기 마무리'
        : null;

  return (
    <details
      className="group rounded-[16px] border bg-white"
      style={{
        borderColor: cycle.isCurrent ? 'var(--app-pink-line)' : 'var(--app-line)',
        background: cycle.isCurrent ? 'var(--app-pink-soft)' : 'white',
      }}
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5"
        style={{ outline: 'none' }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-[12px] px-2 py-0.5 text-[12.1px] font-extrabold uppercase tracking-[0.04em] text-white"
              style={{ background: phaseColor }}
            >
              {cycle.phase}
            </span>
            {cycle.isCurrent ? (
              <span
                className="rounded-[12px] px-2 py-0.5 text-[12.1px] font-extrabold uppercase tracking-[0.04em] text-white"
                style={{ background: 'var(--app-pink)' }}
              >
                지금
              </span>
            ) : null}
            {transitionChip ? (
              <span
                className="rounded-[12px] border px-2 py-0.5 text-[12.1px] font-bold"
                style={{
                  background: '#fff7e6',
                  borderColor: 'rgba(212,148,38,0.32)',
                  color: 'var(--app-amber)',
                }}
              >
                {transitionChip}
              </span>
            ) : null}
            {cycle.twelveStage ? (
              <span
                className="rounded-[12px] border px-2 py-0.5 text-[12.1px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {cycle.twelveStage}지
              </span>
            ) : null}
            {cycle.wonjinWith && cycle.wonjinWith.length > 0 ? (
              <span
                className="rounded-[12px] border px-2 py-0.5 text-[12.1px] font-bold text-[var(--app-coral)]"
                style={{ borderColor: 'rgba(220,79,79,0.22)' }}
              >
                원진 · {cycle.wonjinWith.join(', ')}
              </span>
            ) : null}
          </div>
          <div
            className="mt-1.5 text-[17.3px] font-extrabold leading-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {cycle.chapterTitle ?? `${ganziLabel} · ${cycle.ageLabel}`}
          </div>
          <div className="mt-0.5 text-[12.6px] font-bold text-[var(--app-copy-soft)]">
            {ganziLabel} · {cycle.ageLabel}
          </div>
        </div>
        <span
          className="text-[var(--app-copy-soft)] transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--app-line)] px-4 py-4">
        {cycle.hook ? (
          <p
            className="rounded-[12px] bg-white p-3 text-[15px] font-medium leading-[1.65] text-[var(--app-ink)]"
            style={{
              border: '1px solid var(--app-pink-line)',
              background: 'var(--app-pink-soft)',
              wordBreak: 'keep-all',
            }}
          >
            {cycle.hook}
          </p>
        ) : null}

        {cycle.chapterBody ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              본문
            </div>
            <p
              className="mt-1.5 text-[15.5px] leading-[1.75] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.chapterBody}
            </p>
          </section>
        ) : null}

        {cycle.mental ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-indigo)]">
              멘탈 · 내면
            </div>
            <p
              className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.mental}
            </p>
          </section>
        ) : null}

        {cycle.relationship ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
              관계
            </div>
            <p
              className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.relationship}
            </p>
          </section>
        ) : null}

        {cycle.wealthCareer ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber)]">
              돈 · 커리어
            </div>
            <p
              className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.wealthCareer}
            </p>
          </section>
        ) : null}

        {cycle.practicalActions && cycle.practicalActions.length > 0 ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
              실천 4단 · 왜 / 무엇을 / 어떻게
            </div>
            <ul className="mt-2 grid gap-2">
              {cycle.practicalActions.map((action, idx) => (
                <li
                  key={idx}
                  className="rounded-[12px] border border-[var(--app-line)] bg-white p-3"
                >
                  <div
                    className="text-[13.8px] font-extrabold leading-tight text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {idx + 1}. {action.what}
                  </div>
                  <div
                    className="mt-1 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    <strong className="text-[var(--app-copy)]">왜 ·</strong> {action.reason}
                  </div>
                  <div
                    className="mt-0.5 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    <strong className="text-[var(--app-copy)]">어떻게 ·</strong> {action.how}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {cycle.closingNote ? (
          <p
            className="rounded-[12px] p-3 text-[14.4px] leading-[1.7] text-[var(--app-ink)]"
            style={{
              background: 'rgba(28,26,23,0.04)',
              border: '1px solid var(--app-line)',
              wordBreak: 'keep-all',
            }}
          >
            <strong className="text-[var(--app-pink-strong)]">마무리 ·</strong> {cycle.closingNote}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function DaewoonSection({ cycles }: { cycles: LifetimeMajorLuckCycle[] }) {
  if (cycles.length === 0) return null;

  const currentCycleIndex = cycles.findIndex((cycle) => cycle.isCurrent);
  const currentCycle = currentCycleIndex >= 0 ? cycles[currentCycleIndex] : null;

  return (
    <div className="space-y-5">
      {currentCycle ? (
        <p
          className="rounded-[12px] p-3 text-[14.4px] leading-[1.65] text-[var(--app-copy)]"
          style={{
            border: '1px solid var(--app-pink-line)',
            background: 'var(--app-pink-soft)',
            wordBreak: 'keep-all',
          }}
        >
          지금은{' '}
          <strong className="text-[var(--app-pink-strong)]">
            {ganziForBody(currentCycle.ganzi)} 대운
          </strong>{' '}
          · {currentCycle.ageLabel} · <strong>{currentCycle.phase}</strong> 구간을 지나고 있어요.
        </p>
      ) : null}

      {/* 대운 timeline strip — client 측 mount 시 active 카드 중앙 정렬. */}
      <section>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          大運 · 대운 흐름
        </div>
        <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
          내 인생의 10년 단위 챕터
        </h2>
        <DaewoonTimelineStrip cycles={cycles} />
      </section>

      {/* cycle 8단 풀이 — 현재 cycle 은 펼친 상태, 나머지는 접힌 카드 */}
      <section>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          시기별 8단 풀이
        </div>
        <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
          각 대운에서 일어나는 변화
        </h2>
        <p
          className="mt-1.5 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          대운마다 8가지 시각 — 호명 · 챕터 제목 · 본문 · 멘탈 · 관계 · 돈/커리어 · 실천 4단 ·
          마무리 — 으로 풀었습니다. 카드를 눌러 펼쳐보세요.
        </p>
        <div className="mt-3 grid gap-2.5">
          {cycles.map((cycle, idx) => (
            <CycleCard
              key={`${cycle.ganzi}-${cycle.ageLabel}-${idx}`}
              cycle={cycle}
              defaultOpen={cycle.isCurrent || (currentCycleIndex < 0 && idx === 0)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
