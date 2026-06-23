// 2026-05-15 PR 9 — 03 ML 가중치 학습 §3-1 UI 패턴 적용.
//
// 사용자에게 오늘 운세의 정확도를 묻는 카드. 결과 페이지 진입 후 일정 시간 + 사용자가
// 결과를 충분히 읽은 후에 노출하면 응답률이 높다.
//
// 데이터:
//   - 3단계 정확도 (😊 정확 / 🤷 보통 / 😞 안 맞음) — 필수
//   - 5영역 별점 (재물/애정/직장/건강/관계) — 선택, 1~5
//   - 자유 코멘트 — 선택
//
// 노이즈 방지:
//   - 결과 페이지 진입 후 최소 30초 dwell 후에만 노출
//   - 3일 간격 cooldown (DB UNIQUE 제약과 별개로 로컬 ux)
//   - 너무 빠른 클릭 (<3초) 은 server side 에서 거부
'use client';

import { useEffect, useState } from 'react';
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

interface Props {
  result: TodayFortuneFreeResult;
  /** dwell 시작 timestamp (ms). 결과 페이지 mount 시점. */
  enterAt: number;
  /** 노출 최소 dwell (초). 기본 30. */
  minDwellSeconds?: number;
}

type AccuracyLabel = 'correct' | 'partial' | 'miss';

const ACCURACY_OPTIONS: Array<{ key: AccuracyLabel; emoji: string; label: string; rating: -1 | 0 | 1 }> = [
  { key: 'correct', emoji: '😊', label: '정확했어요', rating: 1 },
  { key: 'partial', emoji: '🤷', label: '보통이에요', rating: 0 },
  { key: 'miss', emoji: '😞', label: '안 맞아요', rating: -1 },
];

const AREA_LABELS: Array<{ key: string; icon: string; label: string }> = [
  { key: 'wealth', icon: '💰', label: '재물' },
  { key: 'love', icon: '💞', label: '애정' },
  { key: 'career', icon: '💼', label: '직장' },
  { key: 'health', icon: '🏥', label: '건강' },
  { key: 'relationship', icon: '👥', label: '관계' },
];

export function TodayFeedbackCard({ result, enterAt, minDwellSeconds = 30 }: Props) {
  const [accuracy, setAccuracy] = useState<AccuracyLabel | null>(null);
  const [areaRatings, setAreaRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [showAreas, setShowAreas] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [visible, setVisible] = useState(false);

  // dwell 후 노출.
  useEffect(() => {
    const elapsed = Math.floor((Date.now() - enterAt) / 1000);
    if (elapsed >= minDwellSeconds) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), (minDwellSeconds - elapsed) * 1000);
    return () => window.clearTimeout(timer);
  }, [enterAt, minDwellSeconds]);

  async function submit() {
    if (!accuracy) return;
    setState('submitting');
    setErrorMsg('');

    const overallRating = ACCURACY_OPTIONS.find((o) => o.key === accuracy)!.rating;
    const timeToFeedback = Math.floor((Date.now() - enterAt) / 1000);

    try {
      const res = await fetch('/api/today-fortune/ml-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSessionId: result.sourceSessionId,
          fortuneDate: result.dateKey,
          predictedTotalScore: result.iljinScore?.totalScore ?? 50,
          predictedBreakdown: result.iljinScore?.breakdown,
          overallRating,
          wealthRating: areaRatings.wealth ?? null,
          loveRating: areaRatings.love ?? null,
          careerRating: areaRatings.career ?? null,
          healthRating: areaRatings.health ?? null,
          relationshipRating: areaRatings.relationship ?? null,
          userComment: comment.trim() || null,
          timeToFeedbackSeconds: timeToFeedback,
          triggeredCases: result.iljinMessages?.caseIds ?? null,
          detectedSinsals: result.sajuChart?.detectedSinsals ?? null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error ?? '피드백 전송 실패');
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setErrorMsg('네트워크 오류');
      setState('error');
    }
  }

  if (!visible) return null;
  if (state === 'success') {
    return (
      <section
        className="rounded-[18px] border bg-white p-4 text-center"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[27.6px]">🙏</div>
        <p className="mt-1 text-[15.5px] font-extrabold text-[var(--app-ink)]">
          소중한 피드백 감사합니다
        </p>
        <p className="mt-1 text-[15px] text-[var(--app-copy-muted)]">
          더 정확한 풀이를 만드는 데 사용됩니다.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-pink-line)', background: 'var(--app-pink-soft)' }}
    >
      <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        💬 피드백
      </div>
      <h3 className="mt-0.5 text-[16.7px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
        오늘 운세가 얼마나 맞았나요?
      </h3>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {ACCURACY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setAccuracy(opt.key)}
            className="rounded-[14px] border bg-white p-3 text-center transition-transform active:scale-95"
            style={{
              borderColor: accuracy === opt.key ? 'var(--app-pink-strong)' : 'var(--app-line)',
              background: accuracy === opt.key ? 'var(--app-pink-soft)' : 'white',
              boxShadow: accuracy === opt.key ? '0 4px 12px rgba(216,27,114,0.18)' : 'none',
            }}
          >
            <div className="text-[27.6px] leading-none">{opt.emoji}</div>
            <div className="mt-1 text-[15px] font-bold text-[var(--app-ink)]">{opt.label}</div>
          </button>
        ))}
      </div>

      {accuracy ? (
        <>
          <button
            type="button"
            onClick={() => setShowAreas((v) => !v)}
            className="mt-3 text-[15px] font-bold text-[var(--app-pink-strong)]"
          >
            {showAreas ? '— 영역별 별점 접기' : '+ 영역별 정확도 (선택)'}
          </button>

          {showAreas ? (
            <div className="mt-2 grid gap-1.5 rounded-[12px] border border-[var(--app-line)] bg-white p-3">
              {AREA_LABELS.map((area) => (
                <div key={area.key} className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[var(--app-ink)]">
                    {area.icon} {area.label}
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setAreaRatings((prev) => ({ ...prev, [area.key]: n }))
                        }
                        className="text-[18.4px] leading-none"
                        style={{
                          opacity: (areaRatings[area.key] ?? 0) >= n ? 1 : 0.25,
                        }}
                        aria-label={`${area.label} ${n}점`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="자유 코멘트 (선택)"
                maxLength={300}
                className="mt-2 w-full rounded-[10px] border border-[var(--app-line)] bg-white px-3 py-2 text-[15px] text-[var(--app-ink)] outline-none focus:border-[var(--app-pink-strong)]"
                rows={2}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={state === 'submitting'}
            className="mt-3 w-full rounded-full bg-[var(--app-pink)] px-5 py-2.5 text-[15px] font-extrabold text-white disabled:opacity-60"
          >
            {state === 'submitting' ? '전송 중…' : '피드백 보내기'}
          </button>
          {errorMsg ? (
            <p className="mt-1.5 text-center text-[15px] text-[var(--app-coral)]">{errorMsg}</p>
          ) : null}
        </>
      ) : null}

      <p className="mt-2 text-[15px] leading-[1.5] text-[var(--app-copy-soft)]">
        * 모든 피드백은 익명으로 처리되며, 더 정확한 풀이 학습에만 사용됩니다.
      </p>
    </section>
  );
}
