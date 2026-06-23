// 2026-05-16 PR #146 — Push CTR 클라이언트 컴포넌트.
'use client';

import { useCallback, useEffect, useState } from 'react';

interface CtrRow {
  slot: string;
  variant: 'A' | 'B' | 'C' | null;
  sent: number;
  clicked: number;
  ctr: number;
}

interface CtrResponse {
  ok: boolean;
  windowDays: number;
  totalSent: number;
  totalClicked: number;
  rows: CtrRow[];
  error?: string;
}

interface VariantStat {
  variant: 'A' | 'B' | 'C';
  sent: number;
  clicked: number;
  ctr: number;
}

interface PolicyResponse {
  ok: boolean;
  selection: {
    winner: 'A' | 'B' | 'C' | null;
    stats: VariantStat[];
    sampleEnough: boolean;
    marginPp: number;
    computedAt: string;
  } | null;
  refreshed: boolean;
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 7, label: '7일' },
  { value: 14, label: '14일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
];

const VARIANT_LABEL: Record<'A' | 'B' | 'C', string> = {
  A: 'A · 점수+highlight',
  B: 'B · 부스터',
  C: 'C · 럭키',
};

const VARIANT_COLOR: Record<'A' | 'B' | 'C', string> = {
  A: 'var(--app-pink-strong)',
  B: 'var(--app-amber)',
  C: 'var(--app-jade)',
};

const SLOT_LABEL: Record<string, string> = {
  'today-star-sign': '오늘의 별자리',
  'today-fortune': '오늘의 운세',
  'today-tarot': '오늘의 타로',
  'today-zodiac': '오늘의 띠운세',
  'subscription-expiring': '멤버십 만료 임박',
  'comeback-reminder': '컴백 알림',
};

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function PushCtrDashboard() {
  const [windowDays, setWindowDays] = useState(30);
  const [ctrState, setCtrState] = useState<'loading' | 'success' | 'error'>('loading');
  const [ctrData, setCtrData] = useState<CtrResponse | null>(null);
  const [policy, setPolicy] = useState<PolicyResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCtr = useCallback(async (controller?: AbortController) => {
    setCtrState('loading');
    try {
      const res = await fetch(`/api/admin/push-ctr?days=${windowDays}`, {
        signal: controller?.signal,
      });
      if (res.status === 401 || res.status === 403) {
        setCtrState('error');
        setCtrData({
          ok: false,
          windowDays,
          totalSent: 0,
          totalClicked: 0,
          rows: [],
          error: res.status === 401 ? '로그인이 필요합니다.' : '권한이 없습니다.',
        });
        return;
      }
      if (!res.ok) {
        setCtrState('error');
        return;
      }
      const payload = (await res.json()) as CtrResponse;
      setCtrData(payload);
      setCtrState(payload.ok ? 'success' : 'error');
    } catch (err: unknown) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return;
      setCtrState('error');
    }
  }, [windowDays]);

  const fetchPolicy = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(
        `/api/admin/push-ab-policy${refresh ? '?refresh=1' : ''}`
      );
      if (!res.ok) return;
      const payload = (await res.json()) as PolicyResponse;
      setPolicy(payload);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCtr(controller);
    return () => controller.abort();
  }, [fetchCtr]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleForceRefresh = async () => {
    setRefreshing(true);
    await fetchPolicy(true);
    await fetchCtr();
    setRefreshing(false);
  };

  // slot 별로 그룹화.
  const rowsBySlot = (() => {
    if (!ctrData?.rows) return {} as Record<string, CtrRow[]>;
    const map: Record<string, CtrRow[]> = {};
    for (const row of ctrData.rows) {
      if (!map[row.slot]) map[row.slot] = [];
      map[row.slot].push(row);
    }
    return map;
  })();

  const totalCtr =
    ctrData && ctrData.totalSent > 0
      ? ctrData.totalClicked / ctrData.totalSent
      : 0;

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
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          📈 Push CTR 분석
        </div>
        <h1 className="mt-1.5 text-[23px] font-extrabold leading-snug text-[var(--app-ink)]">
          variant A/B/C 클릭률 + 현재 winner
        </h1>
        <p
          className="mt-2 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          PR #136 의 3 variant 본문(A 점수, B 부스터, C 럭키) 별 발송 + 클릭 통계.
          per-variant 50건+ 표본 + 1%p 이상 margin 이면 winner 결정 → 90% exploit.
        </p>
      </article>

      {/* §Window selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        {WINDOW_OPTIONS.map((opt) => {
          const isActive = opt.value === windowDays;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWindowDays(opt.value)}
              className="rounded-full border px-3 py-1.5 text-[13.8px] font-bold transition-transform active:scale-95"
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
        <button
          type="button"
          onClick={handleForceRefresh}
          disabled={refreshing}
          className="ml-auto rounded-full border bg-white px-3 py-1.5 text-[13.8px] font-bold text-[var(--app-jade)] disabled:opacity-60"
          style={{ borderColor: 'rgba(45,135,88,0.3)' }}
        >
          {refreshing ? '재계산 중...' : '🔄 winner 재계산'}
        </button>
      </div>

      {/* §A/B winner policy 카드 */}
      {policy?.ok && policy.selection ? (
        <article
          className="rounded-[16px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            🎯 현재 정책 (today-star-sign)
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[11.5px] font-bold uppercase text-[var(--app-copy-soft)]">
              winner
            </span>
            {policy.selection.winner ? (
              <span
                className="text-[23px] font-extrabold"
                style={{ color: VARIANT_COLOR[policy.selection.winner] }}
              >
                {policy.selection.winner}
              </span>
            ) : (
              <span className="text-[16.1px] font-bold text-[var(--app-copy-soft)]">
                결정 안됨 (균등 분배 중)
              </span>
            )}
            {policy.selection.winner ? (
              <span className="text-[12.1px] text-[var(--app-copy-soft)]">
                margin {policy.selection.marginPp}%p · 90% exploit / 10% explore
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {policy.selection.stats.map((s) => (
              <div
                key={s.variant}
                className="rounded-[10px] border p-2.5 text-center"
                style={{
                  borderColor:
                    policy.selection!.winner === s.variant
                      ? VARIANT_COLOR[s.variant]
                      : 'var(--app-line)',
                  borderWidth: policy.selection!.winner === s.variant ? 1.5 : 1,
                  background:
                    policy.selection!.winner === s.variant
                      ? 'var(--app-pink-soft)'
                      : 'white',
                }}
              >
                <div
                  className="text-[12.1px] font-bold"
                  style={{ color: VARIANT_COLOR[s.variant] }}
                >
                  {VARIANT_LABEL[s.variant]}
                </div>
                <div className="mt-1 text-[18.4px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {formatPct(s.ctr)}
                </div>
                <div className="text-[11.5px] text-[var(--app-copy-soft)]">
                  {s.clicked.toLocaleString()} / {s.sent.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          {!policy.selection.sampleEnough ? (
            <p className="mt-2 text-[12.6px] text-[var(--app-amber)]">
              ⚠ per-variant 표본 50건 미만 — winner 미확정 (균등 분배 유지)
            </p>
          ) : null}
          <p className="mt-1.5 text-[12.1px] text-[var(--app-copy-soft)]">
            계산: {policy.selection.computedAt.slice(0, 16).replace('T', ' ')}
          </p>
        </article>
      ) : null}

      {ctrState === 'loading' ? (
        <article
          className="rounded-[16px] border bg-white p-8 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="motion-spinner-inline mx-auto" aria-hidden="true" />
          <p className="mt-3 text-[15px] text-[var(--app-copy-muted)]">집계 중...</p>
        </article>
      ) : ctrState === 'error' ? (
        <article
          className="rounded-[16px] border p-5"
          style={{
            background: 'rgba(220,79,79,0.05)',
            borderColor: 'rgba(220,79,79,0.28)',
          }}
        >
          <p className="text-[15px] text-[var(--app-coral)]">
            {ctrData?.error ?? '데이터를 불러오지 못했습니다.'}
          </p>
        </article>
      ) : ctrData?.ok ? (
        <>
          {/* §전체 요약 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              지난 {ctrData.windowDays}일 전체
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <div className="text-[12.1px] text-[var(--app-copy-soft)]">발송</div>
                <div className="text-[20.7px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {ctrData.totalSent.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[12.1px] text-[var(--app-copy-soft)]">클릭</div>
                <div className="text-[20.7px] font-extrabold tabular-nums text-[var(--app-jade)]">
                  {ctrData.totalClicked.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[12.1px] text-[var(--app-copy-soft)]">전체 CTR</div>
                <div className="text-[20.7px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {formatPct(totalCtr)}
                </div>
              </div>
            </div>
          </article>

          {/* §Slot 별 상세 */}
          {Object.entries(rowsBySlot).length === 0 ? (
            <article
              className="rounded-[16px] border bg-white p-5 text-center"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[36.8px]">📭</div>
              <p className="mt-2 text-[15px] font-bold text-[var(--app-ink)]">
                아직 push 발송 기록이 없습니다
              </p>
            </article>
          ) : (
            <section className="grid gap-3">
              {Object.entries(rowsBySlot).map(([slot, rows]) => {
                const slotTotal = rows.reduce((s, r) => s + r.sent, 0);
                const slotClicked = rows.reduce((s, r) => s + r.clicked, 0);
                const slotCtr = slotTotal > 0 ? slotClicked / slotTotal : 0;
                return (
                  <article
                    key={slot}
                    className="rounded-[16px] border bg-white p-4"
                    style={{ borderColor: 'var(--app-line)' }}
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="text-[15px] font-extrabold text-[var(--app-ink)]">
                        {SLOT_LABEL[slot] ?? slot}
                      </div>
                      <div className="text-[15.5px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                        {formatPct(slotCtr)}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[12.1px] text-[var(--app-copy-soft)]">
                      {slotClicked.toLocaleString()} 클릭 / {slotTotal.toLocaleString()} 발송
                    </div>
                    {/* variant 별 (별자리 슬롯만 보통 있음) */}
                    <div className="mt-3 grid gap-1.5">
                      {rows
                        .sort((a, b) =>
                          (a.variant ?? '').localeCompare(b.variant ?? '')
                        )
                        .map((row, idx) => {
                          const variantHue = row.variant
                            ? VARIANT_COLOR[row.variant]
                            : 'var(--app-copy-soft)';
                          const barPct = Math.min(100, row.ctr * 100 * 5); // CTR 20% = full bar
                          return (
                            <div key={idx} className="grid grid-cols-[100px_1fr_56px] items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: variantHue }}
                                  aria-hidden="true"
                                />
                                <span className="text-[12.6px] font-bold text-[var(--app-copy-muted)]">
                                  {row.variant
                                    ? VARIANT_LABEL[row.variant].slice(0, 12)
                                    : '— variant 없음'}
                                </span>
                              </div>
                              <div
                                className="relative h-2 overflow-hidden rounded-full"
                                style={{ background: 'rgba(0,0,0,0.06)' }}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full"
                                  style={{
                                    width: `${barPct}%`,
                                    background: variantHue,
                                  }}
                                />
                              </div>
                              <span
                                className="text-right text-[12.6px] font-extrabold tabular-nums"
                                style={{ color: variantHue }}
                              >
                                {formatPct(row.ctr)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      ) : null}

      {/* §Methodology */}
      <article
        className="rounded-[14px] border bg-white p-4"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
          📚 산출 방식
        </div>
        <ul
          className="mt-1.5 grid gap-1 text-[12.6px] leading-[1.65] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          <li>• 데이터: notification_delivery_logs.status=&apos;sent&apos; + clicked_at IS NOT NULL</li>
          <li>• CTR = clicked / sent (per slot, per variant)</li>
          <li>• Winner: per-variant 50건+ 표본 AND 1등-2등 margin ≥ 1.0%p</li>
          <li>• 분포: 90% winner exploit + 10% 균등 explore (ε-greedy)</li>
          <li>• cache TTL 1시간 — winner 재계산 버튼으로 강제 갱신 가능</li>
        </ul>
      </article>
    </section>
  );
}
