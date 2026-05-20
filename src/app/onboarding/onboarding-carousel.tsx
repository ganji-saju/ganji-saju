// 2026-05-16 — `/onboarding` 첫 방문자 시작가이드 carousel.
// 이전엔 4 슬라이드가 한 화면에 vertical list 로 펼쳐졌음 — mockup `26 _ _ _4 _.html`
// 디자인은 1슬라이드씩 보여주는 carousel + 12간지 wheel hero + 건너뛰기/다음 패턴.
// AppShell/SiteHeader 없이 풀스크린 immersive 레이아웃.
'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import type { ZodiacKey } from '@/components/gangi/zodiac-chip';

interface OnboardingCarouselProps {
  /** Server action — 마지막 슬라이드 CTA. cookie set + /saju/new 로 redirect. */
  finishAction: () => Promise<void>;
  /** Server action — 우상단 건너뛰기. cookie set + / 로 redirect. */
  skipAction: () => Promise<void>;
}

interface Slide {
  hero: string;
  heroAriaLabel: string;
  eyebrow: string;
  title: readonly [string, string];
  body: readonly [string, string];
}

const SLIDES: readonly Slide[] = [
  {
    hero: '運',
    heroAriaLabel: '운(運)',
    eyebrow: '01 · WELCOME',
    title: ['오늘 바로 누르는', '달빛 운세'] as const,
    body: [
      '생년월일만 알면 사주·궁합·오늘운세·타로 모두 시작.',
      '원 작은 풀이부터 가볍게.',
    ] as const,
  },
  {
    hero: '今',
    heroAriaLabel: '금(今) · 오늘',
    eyebrow: '02 · TODAY',
    title: ['오늘 흐름과', '깊은 풀이'] as const,
    body: [
      '오늘운세는 무료, 깊은 풀이는 코인 1회나 멤버십으로.',
      '시간 모르셔도 양·음력 자동 변환·보정합니다.',
    ] as const,
  },
  {
    hero: '話',
    heroAriaLabel: '화(話) · 대화',
    eyebrow: '03 · DIALOGUE',
    title: ['대화로', '더 묻기'] as const,
    body: [
      '풀이 결과를 바탕으로 선생님과 대화하며',
      '다음 행동을 함께 잡아갈 수 있어요.',
    ] as const,
  },
  {
    hero: '始',
    heroAriaLabel: '시(始) · 시작',
    eyebrow: '04 · START',
    title: ['오늘부터', '시작하세요'] as const,
    body: [
      '결과는 항상 보관함에 남고,',
      '알림으로 매일 한 줄씩 받아볼 수 있어요.',
    ] as const,
  },
] as const;

// 12간지 wheel 의 chip 순서 — 子丑寅卯辰巳午未申酉戌亥 시계방향.
const ZODIAC_RING: readonly ZodiacKey[] = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'sheep',
  'monkey',
  'rooster',
  'dog',
  'pig',
] as const;

function ZodiacWheel({ hero, ariaLabel }: { hero: string; ariaLabel: string }) {
  // chip: sm (40px) · 반경 RADIUS · 중앙 CENTER (84px).
  const RADIUS = 88;
  const CHIP = 40;
  const CENTER = 84;
  const SIZE = RADIUS * 2 + CHIP + 8; // padding 여유.
  return (
    <div
      className="relative"
      style={{ height: `${SIZE}px`, width: `${SIZE}px` }}
      role="img"
      aria-label={`12간지 wheel — 중앙 ${ariaLabel}`}
    >
      {ZODIAC_RING.map((kind, i) => {
        // 정상(子) 부터 시계방향 30° 간격. -PI/2 로 위쪽을 0° 로 회전.
        // 2026-05-16: SSR/CSR 모두 동일한 string 으로 직렬화되도록
        // (1) trig 결과를 정수로 반올림 (float 정밀도 hydration mismatch 차단)
        // (2) width/height 를 명시적 px 문자열로 ("40" vs "40px" 직렬화 차이 차단)
        const angle = (i / ZODIAC_RING.length) * 2 * Math.PI - Math.PI / 2;
        const x = Math.round(Math.cos(angle) * RADIUS);
        const y = Math.round(Math.sin(angle) * RADIUS);
        return (
          <div
            key={kind}
            className="absolute"
            style={{
              top: `calc(50% + ${y}px - ${CHIP / 2}px)`,
              left: `calc(50% + ${x}px - ${CHIP / 2}px)`,
              width: `${CHIP}px`,
              height: `${CHIP}px`,
            }}
            aria-hidden="true"
          >
            <ZodiacChip kind={kind} size="sm" />
          </div>
        );
      })}
      <div
        className="absolute grid place-items-center rounded-full text-white"
        style={{
          width: `${CENTER}px`,
          height: `${CENTER}px`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background:
            'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
          boxShadow: '0 18px 40px rgba(216,27,114,0.32)',
        }}
        aria-hidden="true"
      >
        <span
          style={{
            fontFamily: 'var(--font-han, var(--font-dalbit-serif))',
            fontSize: '38px',
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {hero}
        </span>
      </div>
    </div>
  );
}

export function OnboardingCarousel({
  finishAction,
  skipAction,
}: OnboardingCarouselProps) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx]!;
  const isLast = idx === SLIDES.length - 1;
  const headingId = useId();

  // 2026-05-20 — 사용자 보고: 온보딩 페이지 좌우 swipe (모바일 터치 + PC 마우스)
  //   필요. pointer events 로 통합 처리 (touch/mouse/pen 모두 캡처).
  //   drag distance > 40px 시 prev/next 슬라이드 전환.
  const SWIPE_THRESHOLD = 40;
  const dragRef = useRef<{
    pointerId: number | null;
    startX: number;
    deltaX: number;
  }>({ pointerId: null, startX: 0, deltaX: 0 });

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // a/button 등 인터랙티브 요소 안에서는 drag 시작 안 함 (clik 차단 방지).
    const target = event.target as HTMLElement;
    if (target.closest('a, button')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      deltaX: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    drag.deltaX = event.clientX - drag.startX;
  }, []);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const { deltaX } = drag;
    dragRef.current.pointerId = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    setIdx((current) => {
      if (deltaX < 0) {
        // 왼쪽 swipe → 다음 슬라이드
        return Math.min(current + 1, SLIDES.length - 1);
      }
      // 오른쪽 swipe → 이전 슬라이드
      return Math.max(current - 1, 0);
    });
  }, []);

  return (
    <main
      className="flex min-h-screen flex-col bg-white"
      aria-labelledby={headingId}
    >
      {/* 우상단 건너뛰기 — server action 으로 cookie set + redirect */}
      <header className="flex items-center justify-end px-5 pt-6">
        <form action={skipAction}>
          <button
            type="submit"
            className="rounded-full px-2 py-1 text-[12.5px] font-bold text-[var(--app-copy-soft)] transition-colors hover:text-[var(--app-copy)]"
          >
            건너뛰기 →
          </button>
        </form>
      </header>

      {/* 슬라이드 본문 — pointer events 로 좌우 swipe (모바일 터치 + PC 마우스 통합). */}
      <section
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        aria-roledescription="carousel"
        aria-label={`온보딩 슬라이드 ${idx + 1}/${SLIDES.length}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {/* 2026-05-20 — 슬라이드 transition: key={idx} 로 re-mount 시 fade + 미세 lift.
            motion-safe variant 로 prefers-reduced-motion 시 모두 즉시 표시. */}
        <div
          key={`hero-${idx}`}
          className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300"
        >
          <ZodiacWheel hero={slide.hero} ariaLabel={slide.heroAriaLabel} />
        </div>

        <div
          key={`copy-${idx}`}
          className="flex flex-col items-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:delay-75"
        >
          <div className="mt-7 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[var(--app-pink-strong)]">
            {slide.eyebrow}
          </div>
          <h1
            id={headingId}
            className="mt-2 text-[22px] font-extrabold leading-[1.35] tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all', textAlign: 'center' }}
          >
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p
            className="mt-3 max-w-xs text-[12.5px] leading-[1.7] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all', textAlign: 'center' }}
          >
            {slide.body[0]}
            <br />
            {slide.body[1]}
          </p>
        </div>

        {/* Pagination dots — 클릭으로도 슬라이드 점프. */}
        <div
          className="mt-7 flex items-center gap-1.5"
          role="tablist"
          aria-label="슬라이드 선택"
        >
          {SLIDES.map((_, i) => {
            const active = i === idx;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`슬라이드 ${i + 1}로 이동`}
                onClick={() => setIdx(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: active ? '18px' : '6px',
                  background: active ? 'var(--app-pink)' : 'rgba(0,0,0,0.16)',
                }}
              />
            );
          })}
        </div>
      </section>

      {/* CTA — 마지막 슬라이드는 server action 으로 redirect, 이전은 다음 슬라이드. */}
      <footer className="px-6 pb-10 pt-4">
        {isLast ? (
          <form action={finishAction}>
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] transition-transform active:scale-[0.98]"
            >
              사주 입력하고 시작 →
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(i + 1, SLIDES.length - 1))}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] transition-transform active:scale-[0.98]"
          >
            다음 →
          </button>
        )}
      </footer>
    </main>
  );
}
