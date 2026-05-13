// PR2 redesign (Claude Design / 가이드 §6): 홈 페이지 4 컴포넌트 + Bottom CTA.
// 데이터 (GANGI_HOME_CARDS / GANGI_FREE_ACTIONS / GANGI_HOME_CATEGORIES) 와
// 라우팅 / onTrack 이벤트 / 캐러셀 동작 일절 무수정.
// 시각(마크업 + 스타일) 만 mockup screens-a.jsx 의 모양으로 정렬한다.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import type {
  GangiHomeBanner,
  GangiHomeCategoryKey,
  GangiServiceCard,
} from '@/content/gangi-market';
import { GANGI_HOME_BANNERS, GANGI_HOME_CATEGORIES } from '@/content/gangi-market';
import { cn } from '@/lib/utils';

type TrackHandler = (payload: Record<string, unknown>) => void;

// ─── 1) Season banner (캐러셀 동작 유지, 시각만 새 디자인) ────────────────────
export function GangiSeasonBanner({
  banners = GANGI_HOME_BANNERS,
  onTrack,
}: {
  banners?: readonly GangiHomeBanner[];
  onTrack?: TrackHandler;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeBanners = banners.length ? banners : GANGI_HOME_BANNERS;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  }>({ pointerId: null, startX: 0, startScrollLeft: 0, moved: false });

  const goToBanner = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const nextIndex = Math.min(Math.max(index, 0), safeBanners.length - 1);
      const viewport = viewportRef.current;
      setActiveIndex(nextIndex);
      if (viewport) {
        viewport.scrollTo({ left: viewport.clientWidth * nextIndex, behavior });
      }
    },
    [safeBanners.length]
  );

  useEffect(() => {
    if (safeBanners.length <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setActiveIndex((current) => {
        const next = (current + 1) % safeBanners.length;
        window.requestAnimationFrame(() => {
          const viewport = viewportRef.current;
          viewport?.scrollTo({ left: viewport.clientWidth * next, behavior: 'smooth' });
        });
        return next;
      });
    }, 6500);

    return () => window.clearInterval(timer);
  }, [safeBanners.length]);

  useEffect(() => {
    if (activeIndex >= safeBanners.length) {
      goToBanner(0, 'auto');
    }
  }, [activeIndex, goToBanner, safeBanners.length]);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || scrollRafRef.current !== null) return;

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const next = Math.round(viewport.scrollLeft / Math.max(viewport.clientWidth, 1));
      const clamped = Math.min(Math.max(next, 0), safeBanners.length - 1);
      setActiveIndex((current) => (current === clamped ? current : clamped));
    });
  }, [safeBanners.length]);

  return (
    <section className="px-4 pt-3" aria-label="추천 운세 배너">
      <div
        ref={viewportRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto scrollbar-none"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        onScroll={handleScroll}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          const target = event.target as HTMLElement;
          if (target.closest('a, button')) return;
          const viewport = viewportRef.current;
          if (!viewport) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: viewport.scrollLeft,
            moved: false,
          };
          viewport.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          const viewport = viewportRef.current;
          if (!viewport || drag.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - drag.startX;
          if (Math.abs(deltaX) > 4) drag.moved = true;
          viewport.scrollLeft = drag.startScrollLeft - deltaX;
          if (drag.moved) event.preventDefault();
        }}
        onPointerUp={(event) => {
          const viewport = viewportRef.current;
          if (viewport?.hasPointerCapture(event.pointerId)) {
            viewport.releasePointerCapture(event.pointerId);
          }
          dragRef.current.pointerId = null;
        }}
        onPointerCancel={(event) => {
          const viewport = viewportRef.current;
          if (viewport?.hasPointerCapture(event.pointerId)) {
            viewport.releasePointerCapture(event.pointerId);
          }
          dragRef.current.pointerId = null;
        }}
      >
        {safeBanners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.href}
            className="relative block w-full shrink-0 snap-start overflow-hidden rounded-[22px] p-5 text-white no-underline"
            style={{
              background:
                banner.tone === 'soft'
                  ? 'var(--app-pink-soft)'
                  : banner.tone === 'night'
                  ? 'linear-gradient(135deg, #1a1a20 0%, #3a1530 100%)'
                  : 'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
              color: banner.tone === 'soft' ? 'var(--app-ink)' : '#fff',
              minHeight: 160,
            }}
            onClick={() =>
              onTrack?.({
                from: 'home_banner',
                banner: banner.id,
                menu: banner.cta,
              })
            }
          >
            {/* 한자 배경 (운/緣 등) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-3 -right-3 select-none"
              style={{
                fontFamily: 'var(--font-han)',
                fontSize: 140,
                fontWeight: 700,
                lineHeight: 1,
                opacity: 0.08,
                color: banner.tone === 'soft' ? 'var(--app-pink-strong)' : '#fff',
              }}
            >
              運
            </span>

            <div className="relative">
              <p
                className="m-0"
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  opacity: 0.85,
                }}
              >
                {banner.kicker}
              </p>
              <h2
                className="m-0 mt-1.5"
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.35,
                }}
              >
                {banner.title}
              </h2>
              <p
                className="m-0 mt-3"
                style={{
                  fontSize: 12.5,
                  opacity: 0.9,
                  lineHeight: 1.5,
                }}
              >
                {banner.description}
              </p>
              <span
                className="mt-3 inline-flex items-center gap-1 rounded-full"
                style={{
                  background:
                    banner.tone === 'soft'
                      ? 'var(--app-pink-strong)'
                      : 'rgba(255,255,255,0.22)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '7px 12px',
                }}
              >
                {banner.cta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* dots */}
      {safeBanners.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" aria-label="배너 선택">
          {safeBanners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              aria-label={String(index + 1) + '번째 배너 보기'}
              aria-current={activeIndex === index ? 'true' : undefined}
              onClick={() => goToBanner(index)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: activeIndex === index ? 16 : 6,
                background:
                  activeIndex === index
                    ? 'var(--app-pink-strong)'
                    : 'var(--app-line-strong)',
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ─── 2) Free quick action (2x1 grid) ─────────────────────────────────────────
export function GangiQuickActionCard({
  href,
  mark, // 'sun' (오늘운세) | 'card' (타로) — 기존 데이터 보존
  zodiac, // 'rooster' / 'rabbit' 등 — GANGI_FREE_ACTIONS 에 이미 있음
  label,
  title,
  desc,
  onTrack,
}: {
  href: string;
  mark?: 'sun' | 'card';
  zodiac?: ZodiacKey;
  label: string;
  title: string;
  desc?: string;
  onTrack?: () => void;
}) {
  // mark → zodiac fallback (구버전 호출자 호환)
  const zodiacKind: ZodiacKey =
    zodiac ?? (mark === 'sun' ? 'rooster' : mark === 'card' ? 'rabbit' : 'rooster');

  return (
    <Link
      href={href}
      onClick={onTrack}
      className="flex items-center gap-2.5 rounded-[18px] border bg-white p-3 no-underline"
      style={{ borderColor: 'var(--app-line)', color: 'var(--app-ink)' }}
    >
      <ZodiacChip kind={zodiacKind} size="sm" />
      <div className="min-w-0 flex-1">
        <span
          className="inline-flex items-center rounded-[6px] px-1.5"
          style={{
            background: 'var(--app-ink)',
            color: '#fff',
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.02em',
            height: 18,
          }}
        >
          {label || 'FREE'}
        </span>
        <div
          className="mt-1 truncate"
          style={{
            fontSize: 13.5,
            fontWeight: 800,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        {desc ? (
          <div
            className="mt-0.5 truncate"
            style={{
              fontSize: 11.5,
              color: 'var(--app-copy-muted)',
            }}
          >
            {desc}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// ─── 3) Category tabs (horizontal chips) ─────────────────────────────────────
export function GangiCategoryTabs({
  active,
  onChange,
}: {
  active: GangiHomeCategoryKey;
  onChange: (category: GangiHomeCategoryKey) => void;
}) {
  return (
    <nav
      className="flex gap-1.5 overflow-x-auto px-4 pt-4 pb-1"
      aria-label="운세 카테고리"
      style={{ scrollbarWidth: 'none' }}
    >
      {GANGI_HOME_CATEGORIES.map((category) => {
        const isActive = active === category.key;
        return (
          <button
            key={category.key}
            type="button"
            data-active={isActive ? 'true' : 'false'}
            onClick={() => onChange(category.key)}
            className={cn(
              'inline-flex shrink-0 items-center rounded-[999px] border px-3 text-[12.5px] font-semibold transition-colors',
              'whitespace-nowrap'
            )}
            style={{
              height: 30,
              background: isActive ? 'var(--app-ink)' : 'var(--app-surface-muted)',
              borderColor: isActive ? 'var(--app-ink)' : 'var(--app-line)',
              color: isActive ? '#fff' : 'var(--app-copy)',
            }}
          >
            {category.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── 4) Service card (grid 2-col) ────────────────────────────────────────────
export function GangiServiceCardLink({
  card,
  onTrack,
}: {
  card: GangiServiceCard;
  onTrack?: (card: GangiServiceCard) => void;
}) {
  const isFree = card.price === '무료' || card.price === '무료 시작';
  const isComingSoon = card.price === '준비 중';

  return (
    <Link
      href={card.href}
      onClick={() => onTrack?.(card)}
      data-free={isFree ? 'true' : 'false'}
      className="relative flex flex-col gap-2.5 rounded-[18px] border bg-white p-3.5 no-underline transition-transform hover:-translate-y-[2px]"
      style={{
        borderColor: 'var(--app-line)',
        color: 'var(--app-ink)',
        minHeight: 158,
      }}
    >
      {/* 태그 (HOT / 추천) */}
      {card.tag ? (
        <span
          className="absolute right-2.5 top-2.5 inline-flex items-center rounded-[6px] px-1.5"
          style={{
            background:
              card.tag === 'HOT' ? 'var(--app-coral)' : 'var(--app-pink)',
            color: '#fff',
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '0.02em',
            height: 18,
          }}
        >
          {card.tag}
        </span>
      ) : null}

      <ZodiacChip kind={card.zodiac as ZodiacKey} size="md" />

      <div className="min-w-0">
        <h2
          className="m-0"
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--app-ink)',
          }}
        >
          {card.title}
        </h2>
        <p
          className="m-0 mt-1"
          style={{
            fontSize: 12,
            color: 'var(--app-copy-muted)',
            lineHeight: 1.45,
          }}
        >
          {card.desc}
        </p>
      </div>

      <div
        className="mt-auto inline-flex items-center gap-1"
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: isFree
            ? 'var(--app-ink)'
            : isComingSoon
            ? 'var(--app-copy-muted)'
            : 'var(--app-pink-strong)',
        }}
      >
        {card.price}
        <span className="ml-auto" style={{ color: 'var(--app-copy-muted)' }}>
          →
        </span>
      </div>
    </Link>
  );
}

// ─── 5) Bottom CTA — 사주 시작 (mockup 5번 섹션, 신규) ──────────────────────
export function GangiHomeBottomCta({ onTrack }: { onTrack?: () => void }) {
  return (
    <section className="px-4 pt-4 pb-3" aria-label="사주 시작 CTA">
      <Link
        href="/saju/new"
        onClick={onTrack}
        className="flex items-center gap-3.5 rounded-[20px] p-4 no-underline"
        style={{ background: 'var(--app-ink)', color: '#fff' }}
      >
        <ZodiacChip kind="dragon" size="lg" />
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--app-pink)',
              letterSpacing: '0.04em',
            }}
          >
            NEW USER
          </div>
          <div
            className="mt-1"
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.35,
            }}
          >
            생년월일만 알면
            <br />
            3초 안에 시작
          </div>
        </div>
        <span
          className="shrink-0 inline-flex items-center rounded-full"
          style={{
            background: 'var(--app-pink)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            padding: '7px 11px',
          }}
        >
          시작 →
        </span>
      </Link>
    </section>
  );
}
