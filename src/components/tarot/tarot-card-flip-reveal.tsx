// 2026-05-15 handoff PR-E: 53 m-tarot — production 연결.
// `app/tarot/daily/result/page.tsx` 가 server component 라 motion-primitives 의
// `MotionTarotFlip` 을 직접 import 할 수 없음. 이 client wrapper 로 분리하여
// TarotCardArtwork 를 children 으로 받아 flip reveal 효과 적용.
'use client';

import { type ReactNode } from 'react';
import { MotionTarotFlip } from '@/components/motion/motion-primitives';

export function TarotCardFlipReveal({
  children,
  delayMs = 600,
}: {
  /** 실제 타로 카드 컨텐츠 (TarotCardArtwork 등). */
  children: ReactNode;
  delayMs?: number;
}) {
  return (
    <MotionTarotFlip
      active
      delayMs={delayMs}
      back="月"
      ariaLabel="방금 뽑은 타로 카드"
    >
      {children}
    </MotionTarotFlip>
  );
}
