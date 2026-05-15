// 2026-05-15 — 가중치 학습 클라이언트 컴포넌트.
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WeightDiff, WeightLearningResult } from '@/lib/admin/weight-learning';

interface PreviewResponse {
  ok: boolean;
  preview: WeightLearningResult | null;
  diffs?: WeightDiff[];
  sampleSize?: number;
  reason?: string;
  windowStart: string;
  windowEnd: string;
  error?: string;
}

interface VersionRow {
  id: string;
  learned_at: string;
  window_start: string;
  window_end: string;
  sample_size: number;
  lambda: number;
  mse: number;
  r_squared: number | null;
  status: 'draft' | 'active' | 'archived';
  note: string | null;
  weights: Record<string, number>;
}

interface ListResponse {
  ok: boolean;
  versions: VersionRow[];
  error?: string;
}

const WINDOW_OPTIONS = [
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
  { value: 180, label: '180일' },
  { value: 365, label: '1년' },
];

const LAMBDA_OPTIONS = [
  { value: 0.1, label: 'λ=0.1 (약한 정규화)' },
  { value: 1, label: 'λ=1 (균형)' },
  { value: 5, label: 'λ=5 (강한 정규화)' },
];

const REC_STYLES: Record<WeightDiff['recommendation'], { label: string; bg: string; border: string; color: string }> = {
  'flip-sign': {
    label: '⚠ 부호 반대',
    bg: 'rgba(220,79,79,0.08)',
    border: 'rgba(220,79,79,0.3)',
    color: 'var(--app-coral)',
  },
  'major-revise': {
    label: '🔄 큰 폭 조정',
    bg: '#fff7e6',
    border: 'rgba(212,148,38,0.32)',
    color: 'var(--app-amber)',
  },
  add: {
    label: '➕ 추가 검토',
    bg: 'rgba(45,135,88,0.08)',
    border: 'rgba(45,135,88,0.3)',
    color: 'var(--app-jade)',
  },
  'slight-tweak': {
    label: '〰 소폭 조정',
    bg: 'rgba(0,0,0,0.04)',
    border: 'var(--app-line)',
    color: 'var(--app-copy-muted)',
  },
  keep: {
    label: '✓ 유지',
    bg: 'rgba(45,135,88,0.05)',
    border: 'rgba(45,135,88,0.18)',
    color: 'var(--app-jade)',
  },
  remove: {
    label: '— 표본 부족',
    bg: 'rgba(0,0,0,0.02)',
    border: 'var(--app-line)',
    color: 'var(--app-copy-soft)',
  },
};

function formatSigned(n: number): string {
  if (n > 0) return `+${n.toFixed(2)}`;
  return n.toFixed(2);
}

export function WeightTuningDashboard() {
  const [windowDays, setWindowDays] = useState(180);
  const [lambda, setLambda] = useState(1);
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const fetchPreview = useCallback(
    async (controller?: AbortController) => {
      setState('loading');
      try {
        const res = await fetch(
          `/api/admin/weight-learning?days=${windowDays}&lambda=${lambda}`,
          { signal: controller?.signal }
        );
        if (res.status === 401) {
          setPreview({
            ok: false,
            preview: null,
            windowStart: '',
            windowEnd: '',
            error: '로그인이 필요합니다.',
          });
          setState('error');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const payload = (await res.json()) as PreviewResponse;
        setPreview(payload);
        setState(payload.ok ? 'success' : 'error');
      } catch (err: unknown) {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setState('error');
      }
    },
    [windowDays, lambda]
  );

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/weight-learning?list=1');
      if (!res.ok) return;
      const payload = (await res.json()) as ListResponse;
      if (payload.ok) setVersions(payload.versions);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPreview(controller);
    return () => controller.abort();
  }, [fetchPreview]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleSaveDraft = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch('/api/admin/weight-learning', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ days: windowDays, lambda, note: note.trim() || undefined }),
      });
      const payload = await res.json();
      if (payload.ok) {
        setSavedMsg('Draft 로 저장되었습니다.');
        setNote('');
        fetchVersions();
      } else {
        setSavedMsg(payload.error ?? '저장 실패');
      }
    } catch {
      setSavedMsg('네트워크 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm('이 버전을 active 로 활성화하시겠습니까?\n(기존 active 는 archived 로 이동)')) return;
    try {
      const res = await fetch(`/api/admin/weight-learning?activate=${id}`, { method: 'POST' });
      const payload = await res.json();
      if (payload.ok) {
        fetchVersions();
        return;
      }
      // PR #153 (D2) — R² 임계값 미달 시 403 + 사용자에게 force 옵션 제안.
      if (payload.error === 'r_squared_below_threshold') {
        const forceOk = confirm(
          `${payload.message}\n\n그래도 강제로 활성화하시겠습니까?\n(모델 품질이 낮을 가능성이 큽니다.)`
        );
        if (forceOk) {
          const forceRes = await fetch(
            `/api/admin/weight-learning?activate=${id}&force=1`,
            { method: 'POST' }
          );
          const forcePayload = await forceRes.json();
          if (forcePayload.ok) {
            fetchVersions();
          } else {
            alert(`강제 활성화 실패: ${forcePayload.error ?? 'unknown'}`);
          }
        }
        return;
      }
      alert(`활성화 실패: ${payload.error ?? 'unknown'}`);
    } catch {
      alert('네트워크 오류');
    }
  };

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
          🤖 ML 가중치 학습
        </div>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-[var(--app-ink)]">
          데이터로 가중치 자동 조정
        </h1>
        <p
          className="mt-2 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          today_fortune_feedback 의 overall_rating (-1/0/+1) 을 종속변수, 발동된 신살을
          이진 feature 로 둔 릿지 회귀로 신살별 최적 가중치 산출. L2 정규화로 다중공선성 대응.
        </p>
      </article>

      {/* §컨트롤 */}
      <section
        className="rounded-[16px] border bg-white p-4 space-y-3"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            윈도우
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
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
        </div>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            정규화 강도
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LAMBDA_OPTIONS.map((opt) => {
              const isActive = opt.value === lambda;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLambda(opt.value)}
                  className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-transform active:scale-95"
                  style={{
                    background: isActive ? 'var(--app-jade)' : 'white',
                    color: isActive ? 'white' : 'var(--app-copy-muted)',
                    borderColor: isActive ? 'var(--app-jade)' : 'var(--app-line)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {state === 'loading' ? (
        <article
          className="rounded-[16px] border bg-white p-8 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="motion-spinner-inline mx-auto" aria-hidden="true" />
          <p className="mt-3 text-[13px] text-[var(--app-copy-muted)]">학습 중...</p>
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
            {preview?.error ?? '학습 실패'}
          </p>
        </article>
      ) : preview?.ok && preview.preview ? (
        <>
          {/* §학습 결과 요약 */}
          <section
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              📊 학습 결과
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-ink)]">
                  {preview.preview.sampleSize.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">학습 표본</div>
              </div>
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {preview.preview.features.length}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">분석 신살</div>
              </div>
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-jade)]">
                  {preview.preview.rSquared === null ? '—' : preview.preview.rSquared.toFixed(3)}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">R² (설명력)</div>
              </div>
              <div>
                <div className="text-[18px] font-extrabold tabular-nums text-[var(--app-amber)]">
                  {preview.preview.mse.toFixed(3)}
                </div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">MSE</div>
              </div>
            </div>
            <div className="mt-2.5 text-[10.5px] text-[var(--app-copy-soft)]">
              intercept = {formatSigned(preview.preview.intercept)} · λ = {preview.preview.lambda}
            </div>
          </section>

          {/* §변경 권고 (diffs) */}
          {preview.diffs && preview.diffs.length > 0 ? (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                현재 vs 학습 — 변경 권고 순
              </h2>
              <div className="mt-2 grid gap-2">
                {preview.diffs.map((d) => {
                  const rec = REC_STYLES[d.recommendation];
                  return (
                    <article
                      key={d.name}
                      className="rounded-[14px] border bg-white p-3.5"
                      style={{ borderColor: 'var(--app-line)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-extrabold text-[var(--app-ink)]">
                            {d.name}
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-[var(--app-copy-soft)]">
                            발동 {d.triggered.toLocaleString()}건 · 평균 rating{' '}
                            {formatSigned(d.meanRating)}
                          </div>
                        </div>
                        <span
                          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold"
                          style={{ background: rec.bg, borderColor: rec.border, color: rec.color }}
                          title={d.hint}
                        >
                          {rec.label}
                        </span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 items-center gap-2 text-center">
                        <div>
                          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                            현재
                          </div>
                          <div className="mt-0.5 text-[14px] font-extrabold tabular-nums text-[var(--app-ink)]">
                            {formatSigned(d.current)}
                          </div>
                        </div>
                        <div className="text-[16px] text-[var(--app-copy-soft)]">→</div>
                        <div>
                          <div className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                            학습
                          </div>
                          <div
                            className="mt-0.5 text-[14px] font-extrabold tabular-nums"
                            style={{
                              color:
                                d.learned > 0
                                  ? 'var(--app-jade)'
                                  : d.learned < 0
                                    ? 'var(--app-coral)'
                                    : 'var(--app-copy-soft)',
                            }}
                          >
                            {formatSigned(d.learned)}
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-2 text-[10.5px] leading-[1.5] text-[var(--app-copy-muted)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        Δ = {formatSigned(d.delta)} · {d.hint}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* §저장 */}
          <section
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              💾 결과 저장 (draft)
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모 (선택) — 예: 봄 시즌 데이터, lambda 비교 등"
              className="mt-2 w-full rounded-[10px] border bg-white px-3 py-2 text-[12px] leading-[1.5] text-[var(--app-ink)] focus:outline-none"
              style={{ borderColor: 'var(--app-line)' }}
              rows={2}
            />
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="mt-2 w-full rounded-full border px-4 py-2.5 text-[13px] font-extrabold transition-transform active:scale-95 disabled:opacity-50"
              style={{
                background: 'var(--app-ink)',
                color: 'white',
                borderColor: 'var(--app-ink)',
              }}
            >
              {saving ? '저장 중...' : '학습 결과를 draft 로 저장'}
            </button>
            {savedMsg ? (
              <p className="mt-2 text-[11px] text-[var(--app-copy-muted)]">{savedMsg}</p>
            ) : null}
          </section>
        </>
      ) : (
        <article
          className="rounded-[18px] border bg-white p-5 text-center"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[32px]">📉</div>
          <p className="mt-2 text-[13px] font-bold text-[var(--app-ink)]">학습 가능한 표본 부족</p>
          <p className="mt-1 text-[11.5px] text-[var(--app-copy-muted)]">
            {preview?.reason ?? '데이터가 더 누적되면 자동으로 학습됩니다.'} (현재 표본{' '}
            {preview?.sampleSize ?? 0}건)
          </p>
        </article>
      )}

      {/* §저장된 버전 목록 */}
      {versions.length > 0 ? (
        <section>
          <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
            🗂 저장된 버전 ({versions.length})
          </h2>
          <div className="mt-2 grid gap-2">
            {versions.map((v) => {
              const isActive = v.status === 'active';
              // PR #153 (D2) — R² 0.05 미만은 품질 경고.
              const R2_THRESHOLD = 0.05;
              const isLowQuality =
                v.r_squared === null || v.r_squared < R2_THRESHOLD;
              const tone =
                v.status === 'active'
                  ? { bg: 'rgba(45,135,88,0.08)', color: 'var(--app-jade)', label: '✓ active' }
                  : v.status === 'archived'
                    ? { bg: 'rgba(0,0,0,0.03)', color: 'var(--app-copy-soft)', label: 'archived' }
                    : { bg: 'var(--app-pink-soft)', color: 'var(--app-pink-strong)', label: 'draft' };
              return (
                <article
                  key={v.id}
                  className="rounded-[14px] border bg-white p-3.5"
                  style={{
                    borderColor: isLowQuality && !isActive ? 'rgba(212,148,38,0.32)' : 'var(--app-line)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-extrabold text-[var(--app-ink)]">
                        {v.learned_at.slice(0, 16).replace('T', ' ')}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-[var(--app-copy-soft)]">
                        표본 {v.sample_size.toLocaleString()}건 · MSE {v.mse.toFixed(3)} · R²{' '}
                        <span
                          className="font-extrabold"
                          style={{
                            color: isLowQuality
                              ? 'var(--app-amber)'
                              : 'var(--app-jade)',
                          }}
                        >
                          {v.r_squared === null ? '—' : v.r_squared.toFixed(3)}
                        </span>{' '}
                        · λ {v.lambda}
                      </div>
                      {isLowQuality ? (
                        <div
                          className="mt-1.5 rounded-[8px] px-2 py-1 text-[10.5px] font-bold"
                          style={{
                            background: 'rgba(212,148,38,0.08)',
                            color: 'var(--app-amber)',
                            border: '1px solid rgba(212,148,38,0.28)',
                          }}
                        >
                          ⚠ R² &lt; {R2_THRESHOLD} — 모델 설명력 낮음. 활성화 시 품질 경고 발생.
                        </div>
                      ) : null}
                      {v.note ? (
                        <div
                          className="mt-1 text-[11px] text-[var(--app-copy-muted)]"
                          style={{ wordBreak: 'keep-all' }}
                        >
                          {v.note}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      style={{ background: tone.bg, color: tone.color }}
                    >
                      {tone.label}
                    </span>
                  </div>
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={() => handleActivate(v.id)}
                      className="mt-2.5 w-full rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-transform active:scale-95"
                      style={{
                        background: 'white',
                        color: 'var(--app-jade)',
                        borderColor: 'var(--app-jade)',
                      }}
                    >
                      활성화 (active 로 승격)
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

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
          <li>• 모델: y(overall_rating) = α + Σ w_j × x_j (x_j = 신살 j 발동 indicator)</li>
          <li>• 학습: 정규방정식 w = (X^T X + λI)^-1 X^T y · 가우스 소거법</li>
          <li>• L2 정규화 (λ): 다중공선성 (백호살+양인살 동시 발동 등) 대응</li>
          <li>• 발동 5건 미만 신살은 feature 에서 제외</li>
          <li>• 운영 스케일 변환: raw coef × 15 (현재 운영 -15~+15 범위와 맞춤)</li>
          <li>• active 버전은 1개만 — 새 활성화 시 기존은 archived 로 이동</li>
          <li>• 현재는 분석용 — 운영 점수 산출은 여전히 sinsal-comprehensive.ts 하드코딩</li>
        </ul>
      </article>
    </section>
  );
}
