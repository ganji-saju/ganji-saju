'use client';

import Link from 'next/link';
import { Shuffle } from 'lucide-react';
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
  const [drawDeck, setDrawDeck] = useState<TarotPickerCardDraw[]>(() =>
    createRandomTarotDrawDeck(cards)
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const reshuffleDeck = useCallback(() => {
    setSelectedCardId(null);
    setDrawDeck(createRandomTarotDrawDeck(cards));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [cards]);

  return (
    <article className="gangi-tarot-stage" aria-label="타로 카드 한 장 선택">
      <div
        className="gangi-tarot-grid"
        role="list"
        aria-label={`펼쳐진 타로 카드 ${drawDeck.length}장`}
      >
        {drawDeck.map((card) => {
          const selected = selectedCardId === card.cardId;
          const tone = CARD_BACK_TONES[card.backTone];

          return (
            <Link
              key={`${card.slot}-${card.cardId}-${card.orientation}`}
              role="listitem"
              href={buildResultHref(question, card)}
              aria-label={`${card.slot}번째 카드 선택`}
              onClick={() => setSelectedCardId(card.cardId)}
              style={getCardBackStyle(card, selected)}
              className={cn('gangi-tarot-grid-card', selected && 'is-selected')}
            >
              <span className="gangi-tarot-card-glow" aria-hidden="true" />
              <MandalaBack />
              <span className="gangi-tarot-card-shimmer" aria-hidden="true" />
              <span className="gangi-tarot-card-slot" style={{ color: tone.accent }}>
                {card.slot}
              </span>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={reshuffleDeck}
        disabled={cards.length === 0}
        className="gangi-tarot-shuffle"
      >
        <Shuffle className="h-5 w-5" aria-hidden="true" />
        다시 섞기
      </button>
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

function buildResultHref(question: string, card: TarotPickerCardDraw) {
  const params = new URLSearchParams({
    question,
    cardId: card.cardId,
    orientation: card.orientation,
  });

  return `/tarot/daily/result?${params.toString()}`;
}
