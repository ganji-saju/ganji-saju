'use client';

import { useRouter } from 'next/navigation';
import { RotateCcw, Shuffle } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useState } from 'react';
import {
  createRandomTarotDrawDeck,
  type TarotCardBackTone,
  type TarotPickerCardDraw,
  type TarotPickerCardInput,
} from '@/lib/tarot-picker-random';
import { cn } from '@/lib/utils';

interface TarotCardPickerProps {
  cards: TarotPickerCardInput[];
  question: string;
}

const SPREAD_SIZE = 3;
const SPREAD_POSITION_LABELS = ['현재 흐름', '숨은 원인', '오늘의 조언'] as const;

const CARD_BACK_TONES: Record<
  TarotCardBackTone,
  {
    accent: string;
    border: string;
    background: string;
    light: string;
  }
> = {
  plum: {
    accent: 'rgba(210,176,114,0.78)',
    border: 'rgba(166,124,181,0.46)',
    background:
      'linear-gradient(160deg,rgba(166,124,181,0.92),rgba(31,29,57,0.96) 56%,rgba(11,14,29,0.98))',
    light: 'rgba(166,124,181,0.18)',
  },
  indigo: {
    accent: 'rgba(210,176,114,0.74)',
    border: 'rgba(99,123,188,0.42)',
    background:
      'linear-gradient(160deg,rgba(73,86,151,0.9),rgba(24,31,72,0.96) 58%,rgba(9,14,32,0.98))',
    light: 'rgba(99,123,188,0.18)',
  },
  jade: {
    accent: 'rgba(210,176,114,0.76)',
    border: 'rgba(121,178,139,0.4)',
    background:
      'linear-gradient(160deg,rgba(65,115,94,0.88),rgba(23,57,57,0.96) 58%,rgba(9,22,30,0.98))',
    light: 'rgba(121,178,139,0.16)',
  },
  gold: {
    accent: 'rgba(245,216,149,0.82)',
    border: 'rgba(210,176,114,0.48)',
    background:
      'linear-gradient(160deg,rgba(150,111,59,0.86),rgba(60,46,50,0.96) 56%,rgba(18,17,27,0.98))',
    light: 'rgba(210,176,114,0.17)',
  },
  rose: {
    accent: 'rgba(241,191,172,0.78)',
    border: 'rgba(211,129,103,0.42)',
    background:
      'linear-gradient(160deg,rgba(141,75,83,0.88),rgba(61,30,55,0.96) 58%,rgba(20,13,30,0.98))',
    light: 'rgba(211,129,103,0.16)',
  },
};

// 신비 기하 만다라 — 동심원 + 8각성 + 8방 스포크. 인라인 SVG(이미지 0바이트), 색만 currentColor.
const MANDALA_SPOKES = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4;
  return {
    x: Number((Math.cos(angle) * 15).toFixed(1)),
    y: Number((Math.sin(angle) * 15).toFixed(1)),
  };
});

function MandalaBack() {
  return (
    <svg
      className="gangi-tarot-card-motif"
      viewBox="0 0 48 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.9}
      aria-hidden="true"
    >
      <g transform="translate(24,32)">
        <circle r="15" strokeOpacity="0.5" />
        <circle r="10.5" />
        <circle r="5.5" strokeOpacity="0.7" />
        {MANDALA_SPOKES.map((spoke, index) => (
          <line key={index} x1="0" y1="0" x2={spoke.x} y2={spoke.y} strokeOpacity="0.3" />
        ))}
        <rect x="-7.5" y="-7.5" width="15" height="15" strokeOpacity="0.8" />
        <rect x="-7.5" y="-7.5" width="15" height="15" transform="rotate(45)" strokeOpacity="0.8" />
        <circle r="1.6" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function TarotCardPicker({ cards, question }: TarotCardPickerProps) {
  const router = useRouter();
  const [drawDeck, setDrawDeck] = useState<TarotPickerCardDraw[]>(() =>
    createRandomTarotDrawDeck(cards)
  );
  // 고른 순서대로 누적되는 3장. 카드 정체는 결과 전까지 가린 채 순번만 표시.
  const [picks, setPicks] = useState<TarotPickerCardDraw[]>([]);
  const [navigating, setNavigating] = useState(false);

  const reshuffleDeck = useCallback(() => {
    setPicks([]);
    setNavigating(false);
    setDrawDeck(createRandomTarotDrawDeck(cards));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [cards]);

  const undoLastPick = useCallback(() => {
    setPicks((current) => current.slice(0, -1));
  }, []);

  const handlePick = useCallback(
    (card: TarotPickerCardDraw) => {
      if (navigating) return;
      setPicks((current) => {
        if (current.length >= SPREAD_SIZE) return current;
        if (current.some((entry) => entry.cardId === card.cardId)) return current;

        const next = [...current, card];
        if (next.length === SPREAD_SIZE) {
          setNavigating(true);
          // 2026-07-18 — 뽑기 확정 = 오늘 1회 소비. 서버에 기록만 남기고(카드 내용 미전송)
          //   결과 이동은 기다리지 않는다 — 기록 실패로 결과를 못 보는 일이 없게 비차단.
          void fetch('/api/tarot/daily-draw', { method: 'POST', keepalive: true }).catch(
            () => {}
          );
          router.push(buildSpreadHref(question, next));
        }
        return next;
      });
    },
    [navigating, question, router]
  );

  const remaining = SPREAD_SIZE - picks.length;

  return (
    <article className="gangi-tarot-stage" aria-label="타로 카드 세 장 선택">
      <div className="gangi-tarot-pick-progress" aria-live="polite">
        {SPREAD_POSITION_LABELS.map((label, index) => {
          const filled = index < picks.length;
          return (
            <span
              key={label}
              className={cn('gangi-tarot-pick-step', filled && 'is-filled')}
            >
              <strong>{index + 1}</strong>
              {label}
            </span>
          );
        })}
      </div>

      <p className="gangi-tarot-pick-hint">
        {navigating
          ? '세 장의 풀이를 펼치는 중…'
          : remaining > 0
            ? `마음이 가는 카드를 ${remaining}장 더 골라요`
            : '세 장을 모두 골랐어요'}
      </p>

      <div
        className="gangi-tarot-grid"
        role="list"
        aria-label={`펼쳐진 타로 카드 ${drawDeck.length}장`}
      >
        {drawDeck.map((card) => {
          const pickIndex = picks.findIndex((entry) => entry.cardId === card.cardId);
          const selected = pickIndex >= 0;
          const tone = CARD_BACK_TONES[card.backTone];

          return (
            <button
              key={`${card.slot}-${card.cardId}-${card.orientation}`}
              type="button"
              role="listitem"
              aria-label={`${card.slot}번째 카드 선택`}
              aria-pressed={selected}
              disabled={navigating || (!selected && picks.length >= SPREAD_SIZE)}
              onClick={() => handlePick(card)}
              style={getCardBackStyle(card, selected)}
              className={cn('gangi-tarot-grid-card', selected && 'is-selected')}
            >
              <span className="gangi-tarot-card-glow" aria-hidden="true" />
              <MandalaBack />
              <span className="gangi-tarot-card-shimmer" aria-hidden="true" />
              {selected ? (
                <span className="gangi-tarot-card-pick-badge">{pickIndex + 1}</span>
              ) : (
                <span className="gangi-tarot-card-slot" style={{ color: tone.accent }}>
                  {card.slot}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="gangi-tarot-pick-actions">
        {picks.length > 0 && !navigating ? (
          <button type="button" onClick={undoLastPick} className="gangi-tarot-shuffle">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            한 장 취소
          </button>
        ) : null}
        <button
          type="button"
          onClick={reshuffleDeck}
          disabled={cards.length === 0 || navigating}
          className="gangi-tarot-shuffle"
        >
          <Shuffle className="h-5 w-5" aria-hidden="true" />
          다시 섞기
        </button>
      </div>
    </article>
  );
}

function getCardBackStyle(card: TarotPickerCardDraw, selected: boolean): CSSProperties {
  const tone = CARD_BACK_TONES[card.backTone];

  return {
    // 틸트는 ±4° 원본을 ±2.4°로 완화(가로 overflow 방지, 부채 느낌만 유지)
    '--card-tilt': `${(card.tilt * 0.6).toFixed(2)}deg`,
    '--card-glow': tone.light,
    '--card-glow-strength': (0.4 + card.backGlow * 0.12).toFixed(2),
    background: tone.background,
    borderColor: selected ? 'rgba(255,79,154,0.95)' : 'rgba(255,79,154,0.6)',
    zIndex: selected ? 30 : undefined,
  } as CSSProperties;
}

function buildSpreadHref(question: string, picks: TarotPickerCardDraw[]) {
  const params = new URLSearchParams({
    question,
    cards: picks.map((card) => card.cardId).join(','),
    // u/r 약어로 URL 길이 절약 (스프레드 페이지에서 복원).
    orientations: picks.map((card) => (card.orientation === 'reversed' ? 'r' : 'u')).join(','),
  });

  return `/tarot/daily/spread?${params.toString()}`;
}
