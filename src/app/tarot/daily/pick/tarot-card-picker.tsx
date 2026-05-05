'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shuffle, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useState, useTransition } from 'react';
import {
  getTarotCardBackImagePath,
} from '@/lib/tarot-card-assets';
import {
  createRandomTarotDrawDeck,
  pickRandomTarotCard,
  type TarotCardBackTone,
  type TarotPickerCardDraw,
  type TarotPickerCardInput,
} from '@/lib/tarot-picker-random';
import { cn } from '@/lib/utils';

interface TarotCardPickerProps {
  cards: TarotPickerCardInput[];
  question: string;
  sourceLabel: string;
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

export function TarotCardPicker({ cards, question, sourceLabel }: TarotCardPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drawDeck, setDrawDeck] = useState<TarotPickerCardDraw[]>(() =>
    createRandomTarotDrawDeck(cards)
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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

  const handleRandomDraw = () => {
    const deck = drawDeck;
    const card = pickRandomTarotCard(deck);

    if (card) {
      moveToResult(card);
    }
  };

  return (
    <article className="gangi-card-panel gangi-tarot-picker p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="gangi-sub-eyebrow mb-2">펼쳐진 덱</div>
          <h2 className="text-xl font-black leading-7 text-[var(--app-ink)]">
            마음이 머무는 한 장
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[var(--app-copy-muted)]">
            먼저 눈이 가는 카드가 있으면 그 카드로 충분합니다.
            망설여지면 랜덤으로 맡겨도 괜찮아요.
          </p>
        </div>
        <span className="inline-flex h-6 w-fit items-center justify-center rounded-full bg-[var(--app-pink-soft)] px-3 text-xs font-black text-[var(--app-pink-strong)]">
          {sourceLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-2 rounded-[1rem] border border-[var(--app-line)] bg-[var(--app-pink-soft)] p-3 text-xs font-bold leading-6 text-[var(--app-copy)] sm:grid-cols-3">
        <div>
          <span className="text-[var(--app-pink-strong)]">1.</span> 질문 떠올리기
        </div>
        <div>
          <span className="text-[var(--app-pink-strong)]">2.</span> 끌리는 카드 보기
        </div>
        <div>
          <span className="text-[var(--app-pink-strong)]">3.</span> 망설이면 랜덤
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRandomDraw}
          disabled={isPending || cards.length === 0}
          className="gangi-primary-button"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          랜덤으로 한 장 뽑기
        </button>
        <button
          type="button"
          onClick={reshuffleDeck}
          disabled={isPending || cards.length === 0}
          className="gangi-secondary-button"
        >
          <Shuffle className="h-4 w-4" aria-hidden="true" />
          다시 섞기
        </button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
        {drawDeck.map((card) => {
          const selected = selectedCardId === card.cardId;
          const tone = CARD_BACK_TONES[card.backTone];

          return (
            <Link
              key={`${card.slot}-${card.cardId}-${card.orientation}`}
              href={buildResultHref(question, card)}
              aria-label={`${card.slot}번째 카드 뽑기`}
              onClick={() => setSelectedCardId(card.cardId)}
              style={getCardBackStyle(card, selected)}
              className={cn(
                'group relative flex aspect-[7/10] min-h-[5.75rem] flex-col justify-between overflow-hidden rounded-[0.85rem] border p-2 text-left transition-[filter,transform,border-color] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-pink)]/75',
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
                className="relative z-10 text-[10px] font-semibold tracking-[0.18em]"
                style={{ color: tone.accent }}
              >
                {card.slot.toString().padStart(2, '0')}
              </span>
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

      <p className="mt-5 text-center text-xs font-black text-[var(--app-copy-soft)]">
        카드를 누르면 바로 결과로 이동합니다
      </p>
    </article>
  );
}

function getCardBackStyle(card: TarotPickerCardDraw, selected: boolean): CSSProperties {
  const tone = CARD_BACK_TONES[card.backTone];

  return {
    background: tone.background,
    borderColor: selected ? 'rgba(210,176,114,0.82)' : tone.border,
    boxShadow: `0 12px 34px rgba(0,0,0,0.18), 0 0 ${10 + card.backGlow * 5}px ${tone.light}`,
    transform: `translateY(${card.lift}px) rotate(${card.tilt}deg)`,
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
