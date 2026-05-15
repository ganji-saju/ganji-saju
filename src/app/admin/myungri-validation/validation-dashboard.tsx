// 2026-05-15 — 신살 룰 검증 클라이언트 컴포넌트.
'use client';

import { useEffect, useState } from 'react';
import type { DatasetSummary, SinsalStats } from '@/lib/admin/sinsal-validation';

interface ApiResponse {
  ok: boolean;
  windowDays?: number;
  summary?: DatasetSummary;
  stats?: SinsalStats[];
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 30, label: '최근 30일' },
  { value: 90, label: '최근 90일' },
  { value: 180, label: '최근 180일' },
  { value: 365, label: '최근 1년' },
];

const SIG_STYLES: Record<SinsalStats['significance'], { label: string; tone: string }> = {
  strong: { label: 'p < 0.01 ⭐⭐⭐', tone: 'var(--app-jade)' },
  moderate: { label: 'p < 0.05 ⭐⭐', tone: 'var(--app-jade)' },
  weak: { label: 'p < 0.10 ⭐', tone: 'var(--app-amber)' },
  none: { label: '유의차 없음', tone: 'var(--app-copy-soft)' },
};

const VERDICT_STYLES: Record<SinsalStats['verdict'], { label: string; bg: string; border: string; color: string }> = {
  confirmed: {
    label: '✓ 검증됨',
    bg: 'rgba(45,135,88,0.10)',
    border: 'rgba(45,135,88,0.28)',
    color: 'var(--app-jade)',
  },
  partial: {
    label: '△ 부분 검증',
    bg: '#fff7e6',
    border: 'rgba(212,148,38,0.28)',
    color: 'var(--app-amber)',
  },
  'no-effect': {
    label: '— 효과 없음',
    bg: 'rgba(0,0,0,0.03)',
    border: 'var(--app-line)',
    color: 'var(--app-copy-muted)',
  },
  reverse: {
    label: '⚠ 반대 효과',
    bg: 'rgba(220,79,79,0.08)',
    border: 'rgba(220,79,79,0.28)',
    color: 'var(--app-coral)',
  },
  'low-data': {
    label: '? 표본 부족',
    bg: 'rgba(0,0,0,0.02)',
    border: 'var(--app-line)',
    color: 'var(--app-copy-soft)',
  },
};

const CATEGORY_LABEL: Record<SinsalStats['category'], string> = {
  길신: '🟢 길신',
  흉신: '🔴 흉신',
  양날의검: '🟡 양날',
  unknown: '⚪ 기타',
};

function formatSigned(n: number): string {
  if (n > 0) return `+${n.toFixed(3)}`;
  return n.toFixed(3);
}

export function ValidationDashboard() {
  const [windowDays, setWindowDays] = useState(180);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch(`/api/admin/sinsal-validation?days=${windowDays}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setState('error');
          setData({ ok: false, error: '로그인이 필요합니다.' });
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((payload: ApiResponse | null) => {
        if (payload === null) {
          if (state !== 'error') setState('error');
          return;
        }
        setData(payload);
        setState(payload.ok ? 'success' : 'error');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setState('error');
      });
    return () => controller.abort();
  }, [windowDays]);

  return (
    <section className="space-y-5 px-1">
      {/* §Hero */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          🔬 신살 룰 검증
        </div>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-[var(--app-ink)]">
          데이터로 본 명리 효과
        </h1>
        <p
          className="mt-2 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          사용자 피드백 (overall_rating: -1/0/+1) 을 신살 발동 vs 미발동 두 그룹으로
          나눠 Welch&apos;s t-test 로 평균 차이의 통계적 유의성 검증.
        </p>
      </article>

      {/* §Window selector */}
      <div className="flex flex-wrap gap-1.5">
        {WINDOW_OPTIONS.map((opt) => {
          const isActive = opt.value === windowDays;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWindowDays(opt.value)}
              className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-transform active:scale-95"
              style={{
                background: isActive ? 'var(--app-pink)' : 'white',
                color: isActive ? 'white' : 'var(--app-copy-muted)',
                borderColor: isActive ? 'var(--app-pink)' : 'var(--app-line)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {state === 'loading' ? (
        <article
          className="rounded-[16px] border bg-white p-8 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="motion-spinner-inline mx-auto" aria-hidden="true" />
          <p className="mt-3 text-[13px] text-[var(--app-copy-muted)]">통계 분석 중...</p>
        </article>
      ) : state === 'error' ? (
        <article
          className="rounded-[16px] border p-5"
          style={{
            background: 'rgba(220,79,79,0.05)',
            borderColor: 'rgba(220,79,79,0.28)',
          }}
        >
          <p className="text-[13px] text-[var(--app-coral)]">
            {data?.error ?? '데이터를 불러오지 못했습니다.'}
          </p>
        </article>
      ) : data?.ok && data.summary && data.stats ? (
        <>
          {/* §Summary */}
          <section
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              데이터셋 ({data.windowDays}일 윈도우)
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-3">
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {data.summary.totalFeedback.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">총 피드백</div>
              </div>
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {data.summary.feedbackWithSinsals.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">신살 발동 있음</div>
              </div>
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-jade)]">
                  {data.summary.uniqueSinsals}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">분석 신살 종</div>
              </div>
            </div>
            {data.summary.oldestDate && data.summary.newestDate ? (
              <div className="mt-2 text-[10.5px] text-[var(--app-copy-soft)]">
                범위 {data.summary.oldestDate.slice(0, 10)} ~ {data.summary.newestDate.slice(0, 10)}
              </div>
            ) : null}
          </section>

          {/* §Stats list */}
          {data.stats.length === 0 ? (
            <article
              className="rounded-[18px] border bg-white p-5 text-center"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[32px]">📊</div>
              <p className="mt-2 text-[13px] font-bold text-[var(--app-ink)]">
                아직 분석할 신살 데이터가 없습니다
              </p>
              <p className="mt-1 text-[11.5px] text-[var(--app-copy-muted)]">
                사용자 피드백이 누적되면 자동으로 통계가 산출됩니다.
              </p>
            </article>
          ) : (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                효과 크기 절댓값 순 — {data.stats.length}개
              </h2>
              <div className="mt-2 grid gap-2.5">
                {data.stats.map((s) => {
                  const sig = SIG_STYLES[s.significance];
                  const verdict = VERDICT_STYLES[s.verdict];
                  return (
                    <article
                      key={s.name}
                      className="rounded-[16px] border bg-white p-4"
                      style={{ borderColor: 'var(--app-line)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[15px] font-extrabold text-[var(--app-ink)]">
                              {s.name}
                            </span>
                            <span className="text-[11px] font-bold text-[var(--app-copy-soft)]">
                              {CATEGORY_LABEL[s.category]}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                            발동 {s.triggeredCount.toLocaleString()}건 · 미발동{' '}
                            {s.notTriggeredCount.toLocaleString()}건
                          </div>
                        </div>
                        <span
                          className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold"
                          style={{
                            background: verdict.bg,
                            borderColor: verdict.border,
                            color: verdict.color,
                          }}
                          title={s.verdictHint}
                        >
                          {verdict.label}
                        </span>
                      </div>

                      {/* 평균 비교 */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div
                          className="rounded-[12px] border p-2.5"
                          style={{
                            background: 'rgba(45,135,88,0.05)',
                            borderColor: 'rgba(45,135,88,0.18)',
                          }}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                            발동 시 평균
                          </div>
                          <div className="mt-1 text-[15px] font-extrabold tabular-nums text-[var(--app-ink)]">
                            {formatSigned(s.meanWhenTriggered)}
                          </div>
                        </div>
                        <div
                          className="rounded-[12px] border p-2.5"
                          style={{
                            background: 'rgba(0,0,0,0.03)',
                            borderColor: 'var(--app-line)',
                          }}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                            미발동 평균
                          </div>
                          <div className="mt-1 text-[15px] font-extrabold tabular-nums text-[var(--app-ink)]">
                            {formatSigned(s.meanWhenNotTriggered)}
                          </div>
                        </div>
                      </div>

                      {/* 효과 + 유의성 */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[10.5px] font-bold text-[var(--app-copy-soft)]">
                            차이
                          </span>
                          <span
                            className="ml-1.5 text-[14px] font-extrabold tabular-nums"
                            style={{
                              color:
                                s.effectSize > 0
                                  ? 'var(--app-jade)'
                                  : s.effectSize < 0
                                    ? 'var(--app-coral)'
                                    : 'var(--app-copy-soft)',
                            }}
                          >
                            {formatSigned(s.effectSize)}
                          </span>
                          <span className="ml-2 text-[10.5px] font-bold text-[var(--app-copy-soft)]">
                            t = {s.tStatistic.toFixed(2)}
                          </span>
                        </div>
                        <span
                          className="text-[10.5px] font-extrabold"
                          style={{ color: sig.tone }}
                        >
                          {sig.label}
                        </span>
                      </div>

                      {/* 예상 vs 실제 */}
                      <div
                        className="mt-2.5 rounded-[10px] px-3 py-2 text-[11px] leading-[1.5] text-[var(--app-copy)]"
                        style={{ background: 'rgba(0,0,0,0.025)', wordBreak: 'keep-all' }}
                      >
                        <strong className="text-[var(--app-pink-strong)]">현재 가중치:</strong>{' '}
                        {s.expectedScore > 0 ? '+' : ''}
                        {s.expectedScore}점 · {s.verdictHint}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* §Methodology */}
          <article
            className="rounded-[14px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              📚 방법론
            </div>
            <ul
              className="mt-1.5 grid gap-1 text-[11px] leading-[1.65] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <li>• 각 신살별로 발동 일 vs 미발동 일의 overall_rating 평균 비교</li>
              <li>• Welch&apos;s t-test (분산 다른 표본 허용) → t-statistic</li>
              <li>• |t| &gt; 2.58 강한 유의 / &gt; 1.96 유의 / &gt; 1.645 약한 유의</li>
              <li>• 표본 30+ 이상에서 정규 분포 근사 충분 (NIST 1.3.5.3)</li>
              <li>• 검증됨: 예상 방향 + 유의성, 반대: 부호 반대, 효과없음: 무의차</li>
            </ul>
          </article>
        </>
      ) : null}
    </section>
  );
}
