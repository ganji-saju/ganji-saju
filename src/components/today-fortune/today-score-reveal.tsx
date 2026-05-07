'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { TodayFortuneFreeResult, TodayScoreItem } from '@/lib/today-fortune/types';

const SCORE_TONES: Record<TodayScoreItem['key'], string> = {
  overall: 'gold',
  love: 'pink',
  wealth: 'green',
  career: 'blue',
  relationship: 'coral',
  condition: 'violet',
};

const FLOAT_POSITIONS = [
  { x: '-92px', y: '-48px', rotate: '-5deg' },
  { x: '94px', y: '-42px', rotate: '4deg' },
  { x: '-112px', y: '34px', rotate: '6deg' },
  { x: '112px', y: '38px', rotate: '-6deg' },
  { x: '-42px', y: '78px', rotate: '-3deg' },
  { x: '44px', y: '82px', rotate: '5deg' },
] as const;

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
  if (score >= 82) return '흐름이 가볍게 열리는 날';
  if (score >= 68) return '균형을 잡으면 좋아지는 날';
  if (score >= 54) return '천천히 확인하면 풀리는 날';
  return '무리보다 정리가 필요한 날';
}

export function TodayScoreReveal({ result }: { result: TodayFortuneFreeResult }) {
  const targetScore = useMemo(() => getOverallScore(result), [result]);
  const [visibleScore, setVisibleScore] = useState(0);

  const pieces = useMemo(
    () =>
      result.scores.slice(0, 6).map((score, index) => ({
        ...score,
        tone: SCORE_TONES[score.key] ?? 'pink',
        delay: `${index * 110}ms`,
        x: `${index % 2 === 0 ? -1 : 1}${36 + index * 9}px`,
        y: `${index < 3 ? 1 : -1}${18 + index * 5}px`,
        floatX: FLOAT_POSITIONS[index % FLOAT_POSITIONS.length].x,
        floatY: FLOAT_POSITIONS[index % FLOAT_POSITIONS.length].y,
        rotate: FLOAT_POSITIONS[index % FLOAT_POSITIONS.length].rotate,
      })),
    [result.scores]
  );

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

  return (
    <section className="today-score-reveal" aria-label="오늘운세 점수">
      <div className="today-score-reveal-copy">
        <span>오늘의 운세 점수</span>
        <h1>{getScoreMessage(targetScore)}</h1>
        <p>{result.oneLine.body}</p>
      </div>

      <div className="today-score-stage" aria-live="polite">
        {pieces.map((piece) => (
          <span
            key={piece.key}
            className="today-score-piece"
            data-tone={piece.tone}
            style={{
              '--score-piece-delay': piece.delay,
              '--score-piece-x': piece.x,
              '--score-piece-y': piece.y,
              '--score-piece-float-x': piece.floatX,
              '--score-piece-float-y': piece.floatY,
              '--score-piece-rotate': piece.rotate,
            } as CSSProperties}
          >
            <span className="today-score-piece-float">{piece.label}</span>
          </span>
        ))}

        <div className="today-score-orb">
          <span className="today-score-number">{visibleScore}</span>
          <span className="today-score-unit">점</span>
        </div>
      </div>
    </section>
  );
}
