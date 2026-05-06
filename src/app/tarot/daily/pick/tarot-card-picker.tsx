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
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [drawDeck, setDrawDeck] = useState<TarotPickerCardDraw[]>(() =>
    createRandomTarotDrawDeck(cards)
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const activeCard = drawDeck[activeIndex] ?? drawDeck[0] ?? null;
  const activeHref = activeCard ? buildResultHref(question, activeCard) : '/tarot/daily';

  const reshuffleDeck = useCallback(() => {
    setActiveIndex(0);
    setSelectedCardId(null);
    setDrawDeck(createRandomTarotDrawDeck(cards));
    railRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [cards]);

  const scrollToCard = useCallback((nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, drawDeck.length - 1));
    setActiveIndex(boundedIndex);
    cardRefs.current[boundedIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [drawDeck.length]);

  const moveCard = useCallback((direction: -1 | 1) => {
    scrollToCard(activeIndex + direction);
  }, [activeIndex, scrollToCard]);

  const updateActiveFromScroll = useMemo(() => {
    let frame = 0;

    return () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rail = railRef.current;
        if (!rail) return;

        const railBox = rail.getBoundingClientRect();
        const railCenter = railBox.left + railBox.width / 2;
        let closestIndex = activeIndex;
        let closestDistance = Number.POSITIVE_INFINITY;

        cardRefs.current.forEach((card, index) => {
          if (!card) return;
          const box = card.getBoundingClientRect();
          const cardCenter = box.left + box.width / 2;
          const distance = Math.abs(cardCenter - railCenter);

          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        setActiveIndex(closestIndex);
      });
    };
  }, [activeIndex]);

  return (
    <article className="gangi-tarot-stage" aria-label="타로 카드 78장 선택">
      <div className="gangi-tarot-carousel-head">
        <div>
          <p>78장 중 마음이 닿는 한 장</p>
          <strong>{activeIndex + 1} / {drawDeck.length}</strong>
        </div>
        <div className="gangi-tarot-carousel-controls" aria-label="카드 넘기기">
          <button
            type="button"
            onClick={() => moveCard(-1)}
            disabled={activeIndex === 0}
            aria-label="이전 카드"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => moveCard(1)}
            disabled={activeIndex >= drawDeck.length - 1}
            aria-label="다음 카드"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="gangi-tarot-carousel"
        aria-label="좌우로 넘기며 타로 카드 선택"
        onScroll={updateActiveFromScroll}
      >
        {drawDeck.map((card, index) => {
          const selected = selectedCardId === card.cardId;
          const active = activeIndex === index;
          const tone = CARD_BACK_TONES[card.backTone];

          return (
            <Link
              key={`${card.slot}-${card.cardId}-${card.orientation}`}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              href={buildResultHref(question, card)}
              aria-label={`${card.slot}번째 카드 선택`}
              onClick={() => setSelectedCardId(card.cardId)}
              style={getCardBackStyle(card, selected || active)}
              className={cn(
                'gangi-tarot-carousel-card group relative flex aspect-[7/10] shrink-0 flex-col justify-between overflow-hidden border p-2 text-left transition-[filter,transform,border-color] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-pink)]/75',
                active && 'is-active',
                selected && 'brightness-110'
              )}
            >
              <Image
                src={getTarotCardBackImagePath()}
                alt={`${card.slot}번째 타로 카드`}
                fill
                sizes="(max-width: 640px) 56vw, (max-width: 1024px) 32vw, 18vw"
                quality={70}
                priority={card.slot <= 5}
                className="object-cover"
              />
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,18,0.04),rgba(8,10,18,0.02)_24%,rgba(8,10,18,0.38))]" />
              <span
                className="absolute inset-0 opacity-12"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg,transparent 0 42%,rgba(255,255,255,0.08) 43% 44%,transparent 45% 100%)',
                }}
              />
              <span
                className="absolute left-1/2 top-[18%] h-14 w-14 -translate-x-1/2 rounded-full blur-2xl"
                style={{ backgroundColor: tone.light, opacity: 0.22 + card.backGlow * 0.06 }}
              />
              <span
                className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2"
                style={{ backgroundColor: tone.light }}
              />
              <span
                className="relative z-10 self-end text-[10px] tracking-[0.2em]"
                style={{ color: tone.accent }}
              >
                {card.slot}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href={activeHref}
        onClick={() => activeCard ? setSelectedCardId(activeCard.cardId) : undefined}
        className="gangi-tarot-pick-button"
        aria-disabled={!activeCard}
      >
        이 카드로 보기
      </Link>

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
  selected: boolean
): CSSProperties {
  const tone = CARD_BACK_TONES[card.backTone];

  return {
    background: tone.background,
    borderColor: selected ? 'rgba(210,176,114,0.82)' : tone.border,
    boxShadow: `0 12px 34px rgba(0,0,0,0.18), 0 0 ${10 + card.backGlow * 5}px ${tone.light}`,
    transform: `translateY(${selected ? '-0.35rem' : `${card.lift * 0.04}rem`}) rotate(${card.tilt * 0.4}deg)`,
  };
}

function buildResultHref(question: string, card: TarotPickerCardDraw) {
  const params = new URLSearchParams({
    question,
    cardId: card.cardId,
    orientation: card.orientation,
  });

  return `/tarot/daily/result?${params.toString()}`;
}
