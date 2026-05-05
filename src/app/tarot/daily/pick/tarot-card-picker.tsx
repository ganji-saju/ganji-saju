'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shuffle } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useState, useTransition } from 'react';
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drawDeck, setDrawDeck] = useState<TarotPickerCardDraw[]>(() =>
    createRandomTarotDrawDeck(cards)
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const fanCards = drawDeck.slice(0, 7);

  const reshuffleDeck = useCallback(() => {
    setSelectedCardId(null);
    setDrawDeck(createRandomTarotDrawDeck(cards));
  }, [cards]);

  const moveToResult = useCallback(
    (card: TarotPickerCardDraw) => {
      setSelectedCardId(card.cardId);

      startTransition(() => {
        router.push(buildResultHref(question, card));
      });
    },
    [question, router]
  );

  return (
    <article className="gangi-tarot-stage">
      <div className="gangi-tarot-fan" aria-label="타로 카드 선택">
        {fanCards.map((card, index) => {
          const selected = selectedCardId === card.cardId;
          const tone = CARD_BACK_TONES[card.backTone];
          const center = (fanCards.length - 1) / 2;
          const offset = index - center;

          return (
            <Link
              key={`${card.slot}-${card.cardId}-${card.orientation}`}
              href={buildResultHref(question, card)}
              aria-label={`${card.slot}번째 카드 뽑기`}
              onClick={() => setSelectedCardId(card.cardId)}
              style={getCardBackStyle(card, selected, offset)}
              className={cn(
                'gangi-tarot-fan-card group relative flex aspect-[7/10] flex-col justify-between overflow-hidden border p-2 text-left transition-[filter,transform,border-color] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-pink)]/75',
                selected && 'brightness-110'
              )}
            >
              <Image
                src={getTarotCardBackImagePath()}
                alt={`${card.slot}번째 타로 카드 뒷면`}
                fill
                sizes="(max-width: 640px) 22vw, (max-width: 1024px) 12vw, 9vw"
                quality={70}
                priority={card.slot <= 20}
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
                CARD
              </span>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={reshuffleDeck}
        disabled={isPending || cards.length === 0}
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
  offset: number
): CSSProperties {
  const tone = CARD_BACK_TONES[card.backTone];
  const angle = offset * 10.5;
  const x = offset * 2.25;
  const y = Math.abs(offset) * 0.55 + (selected ? -0.9 : 0);

  return {
    background: tone.background,
    borderColor: selected ? 'rgba(210,176,114,0.82)' : tone.border,
    boxShadow: `0 12px 34px rgba(0,0,0,0.18), 0 0 ${10 + card.backGlow * 5}px ${tone.light}`,
    transform: `translateX(${x}rem) translateY(${y}rem) rotate(${angle}deg)`,
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
