'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getTarotCardBackImagePath,
} from '@/lib/tarot-card-assets';
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

const CARDS_PER_SPREAD = 18;

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

export function TarotCardPicker({ cards, question }: TarotCardPickerProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const spreadRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [drawDeck, setDrawDeck] = useState<TarotPickerCardDraw[]>(() =>
    createRandomTarotDrawDeck(cards)
  );
  const spreads = useMemo(() => chunkDeck(drawDeck, CARDS_PER_SPREAD), [drawDeck]);
  const [activeSpreadIndex, setActiveSpreadIndex] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const currentSpread = spreads[activeSpreadIndex] ?? spreads[0] ?? [];
  const visibleStart = activeSpreadIndex * CARDS_PER_SPREAD + 1;
  const visibleEnd = Math.min(visibleStart + currentSpread.length - 1, drawDeck.length);

  const reshuffleDeck = useCallback(() => {
    setActiveSpreadIndex(0);
    setSelectedCardId(null);
    setDrawDeck(createRandomTarotDrawDeck(cards));
    railRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [cards]);

  const scrollToSpread = useCallback((nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, spreads.length - 1));
    setActiveSpreadIndex(boundedIndex);
    spreadRefs.current[boundedIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }, [spreads.length]);

  const moveSpread = useCallback((direction: -1 | 1) => {
    scrollToSpread(activeSpreadIndex + direction);
  }, [activeSpreadIndex, scrollToSpread]);

  const updateActiveSpreadFromScroll = useMemo(() => {
    let frame = 0;

    return () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rail = railRef.current;
        if (!rail) return;

        const railBox = rail.getBoundingClientRect();
        const railCenter = railBox.left + railBox.width / 2;
        let closestIndex = activeSpreadIndex;
        let closestDistance = Number.POSITIVE_INFINITY;

        spreadRefs.current.forEach((spread, index) => {
          if (!spread) return;
          const box = spread.getBoundingClientRect();
          const spreadCenter = box.left + box.width / 2;
          const distance = Math.abs(spreadCenter - railCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        setActiveSpreadIndex(closestIndex);
      });
    };
  }, [activeSpreadIndex]);

  return (
    <article className="gangi-tarot-stage" aria-label="타로 카드 78장 선택">
      <div className="gangi-tarot-carousel-head">
        <div>
          <p>펼쳐진 카드 중 마음이 가는 한 장</p>
          <strong>{visibleStart}-{visibleEnd} / {drawDeck.length}</strong>
        </div>
        <div className="gangi-tarot-carousel-controls" aria-label="카드 넘기기">
          <button
            type="button"
            onClick={() => moveSpread(-1)}
            disabled={activeSpreadIndex === 0}
            aria-label="이전 카드 묶음"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => moveSpread(1)}
            disabled={activeSpreadIndex >= spreads.length - 1}
            aria-label="다음 카드 묶음"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="gangi-tarot-carousel"
        aria-label="좌우로 넘기며 펼쳐진 타로 카드 선택"
        onScroll={updateActiveSpreadFromScroll}
      >
        {spreads.map((spread, spreadIndex) => (
          <div
            key={`spread-${spreadIndex}`}
            ref={(element) => {
              spreadRefs.current[spreadIndex] = element;
            }}
            className="gangi-tarot-spread-page"
            aria-label={`${spreadIndex + 1}번째 카드 묶음`}
          >
            {spread.map((card, cardIndex) => {
              const selected = selectedCardId === card.cardId;
              const tone = CARD_BACK_TONES[card.backTone];

              return (
                <Link
                  key={`${card.slot}-${card.cardId}-${card.orientation}`}
                  href={buildResultHref(question, card)}
                  aria-label={`${card.slot}번째 카드 선택`}
                  onClick={() => setSelectedCardId(card.cardId)}
                  style={getCardBackStyle(card, selected, cardIndex, spread.length)}
                  className={cn(
                    'gangi-tarot-spread-card group flex aspect-[7/10] flex-col justify-between overflow-hidden border p-1.5 text-left transition-[filter,transform,border-color] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-pink)]/75',
                    selected && 'is-selected'
                  )}
                >
                  <Image
                    src={getTarotCardBackImagePath()}
                    alt={`${card.slot}번째 타로 카드`}
                    fill
                    sizes="(max-width: 640px) 22vw, (max-width: 1024px) 14vw, 9vw"
                    quality={70}
                    priority={card.slot <= CARDS_PER_SPREAD}
                    className="object-cover"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,18,0.02),rgba(8,10,18,0.16))]" />
                  <span
                    className="absolute left-1/2 top-[20%] h-8 w-8 -translate-x-1/2 rounded-full blur-xl"
                    style={{ backgroundColor: tone.light, opacity: 0.18 + card.backGlow * 0.04 }}
                  />
                  <span
                    className="relative z-10 self-end text-[9px] font-bold tracking-[0.12em]"
                    style={{ color: tone.accent }}
                  >
                    {card.slot}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
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

function getCardBackStyle(
  card: TarotPickerCardDraw,
  selected: boolean,
  index: number,
  total: number
): CSSProperties {
  const tone = CARD_BACK_TONES[card.backTone];
  const center = (total - 1) / 2;
  const fanOffset = index - center;
  const normalizedDistance = Math.abs(fanOffset) / Math.max(1, center);
  const angle = fanOffset * 4.95 + card.tilt * 0.18;
  const lift = selected ? -1.15 : normalizedDistance * 1.65 + card.lift * 0.018;
  const depth = selected ? 1.08 : 1 - normalizedDistance * 0.08;
  const zIndex = selected ? 40 : index + 1;

  return {
    '--fan-offset': fanOffset,
    '--fan-angle': `${angle}deg`,
    '--fan-lift': `${lift}rem`,
    '--fan-depth': depth,
    background: tone.background,
    borderColor: selected ? 'rgba(255,79,154,0.92)' : 'rgba(255,79,154,0.72)',
    boxShadow: selected
      ? `0 18px 42px rgba(216,27,114,0.24), 0 0 ${14 + card.backGlow * 5}px ${tone.light}`
      : `0 14px 34px rgba(17,17,20,0.18), 0 0 ${10 + card.backGlow * 5}px ${tone.light}`,
    zIndex,
  } as CSSProperties;
}

function chunkDeck<T>(deck: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < deck.length; index += size) {
    chunks.push(deck.slice(index, index + size));
  }

  return chunks;
}

function buildResultHref(question: string, card: TarotPickerCardDraw) {
  const params = new URLSearchParams({
    question,
    cardId: card.cardId,
    orientation: card.orientation,
  });

  return `/tarot/daily/result?${params.toString()}`;
}
