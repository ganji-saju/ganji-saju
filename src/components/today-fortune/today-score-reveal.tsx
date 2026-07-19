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

// PR #165 — single source of truth: scores.overall (이제 build 가 iljinScore.totalScore 로 통일).
// 모든 점수 노출 컴포넌트가 같은 숫자를 보여줌.
function getOverallScore(result: TodayFortuneFreeResult) {
  const overall = result.scores.find((score) => score.key === 'overall')?.score;
  if (typeof overall === 'number') return clampScore(overall);
  // fallback — overall 키 없을 때만.
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

// 2026-05-15 PR 1 → PR 3 — 운세톡톡 벤치마크 (일진_점수산출_알고리즘_정교화.md 6-1):
// 7단계 등급으로 확장 (90+ 🌟 / 80+ ✨ / 70+ 😊 / 60+ 🙂 / 45+ 😐 / 30+ 😕 / ⚠️).
function getScoreGrade(score: number): { emoji: string; label: string } {
  if (score >= 90) return { emoji: '🌟', label: '최고의 날' };
  if (score >= 80) return { emoji: '✨', label: '매우 좋은 날' };
  if (score >= 70) return { emoji: '😊', label: '좋은 날' };
  if (score >= 60) return { emoji: '🙂', label: '무난한 날' };
  if (score >= 45) return { emoji: '😐', label: '평범한 날' };
  if (score >= 30) return { emoji: '😕', label: '신중해야 할 날' };
  return { emoji: '⚠️', label: '매우 조심해야 할 날' };
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
  const grade = getScoreGrade(targetScore);

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
        <div className="relative">
          <div
            className="grid h-[86px] w-[86px] place-items-center rounded-full text-[41.4px] font-extrabold tracking-tighter"
            style={{ border: '3px solid rgba(255,255,255,0.4)' }}
            aria-live="polite"
          >
            {visibleScore}
          </div>
          {/* 2026-05-15 PR 1 — 점수 위 등급 이모지 (운세톡톡 벤치마크 4-1). */}
          <div
            className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full text-[20.7px]"
            style={{
              background: 'rgba(255,255,255,0.95)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            }}
            aria-hidden="true"
            title={grade.label}
          >
            {grade.emoji}
          </div>
        </div>
        <div>
          <div
            className="text-[15px] font-extrabold uppercase tracking-[0.04em]"
            style={{ opacity: 0.85 }}
          >
            오늘의 시그널
          </div>
          {/* 2026-05-15 PR 1 — 등급 라벨 노출 ("무난한 날" / "신중해야 할 날" 등). */}
          <div
            className="mt-0.5 inline-flex items-center gap-1 rounded-[12px] px-2 py-0.5 text-[12.6px] font-extrabold"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            <span aria-hidden="true">{grade.emoji}</span>
            <span>{grade.label}</span>
          </div>
          <div className="mt-1.5 text-[18.4px] font-extrabold leading-snug">
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
        className="relative mt-4 text-[15.5px] leading-relaxed"
        style={{ opacity: 0.94 }}
      >
        {result.oneLine.body}
      </p>
    </section>
  );
}
