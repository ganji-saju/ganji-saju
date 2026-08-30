'use client';

import { useEffect, useState } from 'react';
import {
  getTarotCardOptimizedSources,
  getTarotCardVisualTone,
} from '@/lib/tarot-card-assets';
import { cn } from '@/lib/utils';

interface TarotCardArtworkProps {
  cardId: string;
  shortName: string;
  displayName: string;
  cardMarker: string;
  arcanaLabel: string;
  className?: string;
  priority?: boolean;
}

export function TarotCardArtwork({
  cardId,
  shortName,
  displayName,
  cardMarker,
  arcanaLabel,
  className,
  priority = false,
}: TarotCardArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sources = getTarotCardOptimizedSources(cardId);
  const tone = getTarotCardVisualTone(cardId);

  useEffect(() => {
    setImageFailed(false);
  }, [sources.webp]);

  return (
    <figure
      className={cn(
        // 2:3 = 원본 아트 비율 — 민화 덱은 그림 안에 이중 괘선 테두리가 있어 크롭하면 테가 잘린다
        'relative mx-auto aspect-[2/3] w-[min(14rem,76vw)] overflow-hidden rounded-[1.15rem] border-2 shadow-[0_18px_54px_rgba(142,42,32,0.2)]',
        tone.borderClassName,
        tone.backgroundClassName,
        className
      )}
    >
      {!imageFailed ? (
        // 민화 덱은 그림 자체가 완성된 카드(괘선 테두리·낙관 포함) — 로드되면 아트만 보여준다.
        // 카드명·아르카나 라벨은 양쪽 사용처(spread·result) 모두 카드 옆 텍스트 컬럼이 이미 표시한다.
        <picture>
          <source srcSet={sources.avif} type="image/avif" />
          {/* eslint-disable-next-line @next/next/no-img-element -- 사전 인코딩 정적 AVIF/WebP 직접 서빙(런타임 옵티마이저 우회) */}
          <img
            src={sources.webp}
            alt={displayName}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
      ) : (
        <div className="absolute inset-0 z-10 p-5">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-between gap-3">
              <span className={cn(' text-sm tracking-[0.22em]', tone.accentClassName)}>
                {shortName}
              </span>
              <span className="text-[11.5px] tracking-[0.18em] text-[var(--app-copy-soft)]">
                {tone.label}
              </span>
            </div>

            <div className="grid place-items-center">
              <div
                className={cn(
                  'grid h-28 w-28 place-items-center rounded-full border backdrop-blur-sm',
                  tone.motifClassName
                )}
              >
                <div className={cn(' text-6xl', tone.accentClassName)}>
                  {cardMarker || tone.marker}
                </div>
              </div>
            </div>

            <div>
              <figcaption className="mt-2 line-clamp-2 text-2xl leading-tight text-[var(--app-ivory)]">
                {displayName}
              </figcaption>
              <div className="mt-2 text-sm text-[var(--app-copy-soft)]">{arcanaLabel}</div>
              <div className="mt-2 rounded-[12px] border border-[var(--app-line)] bg-[rgba(251,247,238,0.86)] px-3 py-2 text-center text-[11.5px] tracking-[0.16em] text-[var(--app-copy-soft)] backdrop-blur">
                이미지 로드 실패
              </div>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
