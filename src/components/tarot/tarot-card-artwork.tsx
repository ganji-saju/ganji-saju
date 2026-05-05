'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  getTarotCardImagePath,
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
  const imagePath = getTarotCardImagePath(cardId);
  const tone = getTarotCardVisualTone(cardId);

  useEffect(() => {
    setImageFailed(false);
  }, [imagePath]);

  return (
    <figure
      className={cn(
        'relative mx-auto aspect-[7/10] w-[min(14rem,76vw)] overflow-hidden rounded-[1.15rem] border-2 shadow-[0_24px_70px_rgba(0,0,0,0.34)]',
        tone.borderClassName,
        tone.backgroundClassName,
        className
      )}
    >
      {!imageFailed ? (
        <Image
          src={imagePath}
          alt={displayName}
          fill
          sizes="(max-width: 640px) 76vw, 14rem"
          priority={priority}
          quality={82}
          onError={() => setImageFailed(true)}
          className="object-cover"
        />
      ) : null}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,18,0.26),rgba(8,10,18,0.08)_34%,rgba(8,10,18,0.58))]" />

      <div className="absolute inset-0 z-10 p-5">
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(' text-xs tracking-[0.22em]', tone.accentClassName)}
            >
              {shortName}
            </span>
            <span className="text-[10px] tracking-[0.18em] text-[var(--app-copy-soft)]">
              {tone.label}
            </span>
          </div>

          {imageFailed ? (
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
          ) : (
            <div className="flex justify-center">
              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-[10px] tracking-[0.22em] backdrop-blur-sm',
                  tone.borderClassName,
                  tone.accentClassName
                )}
              >
                {tone.label}
              </span>
            </div>
          )}

          <div>
            <figcaption className="mt-2 line-clamp-2 text-xl leading-tight text-[var(--app-ivory)]">
              {displayName}
            </figcaption>
            <div className="mt-2 text-xs text-[var(--app-copy-soft)]">{arcanaLabel}</div>
          </div>
        </div>
      </div>

      {imageFailed ? (
        <div className="absolute inset-x-4 bottom-4 z-20 rounded-full border border-[var(--app-line)] bg-[rgba(8,10,18,0.7)] px-3 py-2 text-center text-[10px] tracking-[0.16em] text-[var(--app-copy-soft)] backdrop-blur">
          이미지 로드 실패
        </div>
      ) : null}
    </figure>
  );
}
