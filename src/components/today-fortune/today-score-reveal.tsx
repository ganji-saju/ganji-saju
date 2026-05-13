// Redesign 2026-05-13 (Claude Design / screens-a.jsx §4 ScreenToday — Big card):
// 핑크 banner + 86px 원형 점수 + 시그널 eyebrow + headline + body.
// 점수 카운트업 애니메이션은 보존, float pieces 는 제거.
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

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

function getScoreMessage(score: number) {
  if (score >= 82) return '부드럽게 올라오는\n흐름의 날';
  if (score >= 68) return '균형을 잡으면\n좋아지는 날';
  if (score >= 54) return '천천히 확인하면\n풀리는 날';
  return '무리보다 정리가\n필요한 날';
}

export function TodayScoreReveal({ result }: { result: TodayFortuneFreeResult }) {
  const targetScore = useMemo(() => getOverallScore(result), [result]);
  const [visibleScore, setVisibleScore] = useState(0);

  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const totalFrames = 48;

    const tick = () => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVisibleScore(Math.round(targetScore * eased));

      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    setVisibleScore(0);
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [targetScore]);

  const signalLines = getScoreMessage(targetScore).split('\n');

  return (
    <section
      aria-label="오늘운세 점수"
      className="relative overflow-hidden rounded-[22px] text-white"
      style={{
        background:
          'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
        boxShadow: '0 18px 40px rgba(216,27,114,0.28)',
        padding: 22,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full opacity-25"
        style={{ background: 'rgba(255,255,255,0.35)' }}
      />

      <div className="relative flex items-center gap-3.5">
        <div
          className="grid h-[86px] w-[86px] place-items-center rounded-full text-[36px] font-extrabold tracking-tighter"
          style={{ border: '3px solid rgba(255,255,255,0.4)' }}
          aria-live="polite"
        >
          {visibleScore}
        </div>
        <div>
          <div
            className="text-[11.5px] font-extrabold uppercase tracking-[0.04em]"
            style={{ opacity: 0.85 }}
          >
            오늘의 시그널
          </div>
          <div className="mt-1 text-[16px] font-extrabold leading-snug">
            {signalLines.map((line, idx) => (
              <span key={idx}>
                {line}
                {idx < signalLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p
        className="relative mt-4 text-[13.5px] leading-relaxed"
        style={{ opacity: 0.94 }}
      >
        {result.oneLine.body}
      </p>
    </section>
  );
}
