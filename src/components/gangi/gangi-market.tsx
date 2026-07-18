// PR2 redesign (Claude Design / 가이드 §6): 홈 페이지 4 컴포넌트 + Bottom CTA.
// 데이터 (GANGI_HOME_CARDS / GANGI_FREE_ACTIONS / GANGI_HOME_CATEGORIES) 와
// 라우팅 / onTrack 이벤트 / 캐러셀 동작 일절 무수정.
// 시각(마크업 + 스타일) 만 mockup screens-a.jsx 의 모양으로 정렬한다.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { StarSignChip } from '@/components/gangi/star-sign-chip';
import type {
  GangiHomeBanner,
  GangiHomeCategoryKey,
  GangiServiceCard,
} from '@/content/gangi-market';
import { GANGI_HOME_BANNERS, GANGI_HOME_CATEGORIES } from '@/content/gangi-market';
import { ComparePrice, Price } from '@/components/payments/price-provider';
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
    startY: number;
    startWindowScrollY: number;
    startScrollLeft: number;
    moved: boolean;
    axis: 'horizontal' | 'vertical' | null;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startWindowScrollY: 0,
    startScrollLeft: 0,
    moved: false,
    axis: null,
  });
  const suppressClickRef = useRef(false);

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

  // 2026-05-20 — 키보드 a11y: viewport focusable + ←/→/Home/End 키 carousel nav.
  //   기존 pointer/scroll 동작 보존. focus 시 ring 으로 활성 indication.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (safeBanners.length <= 1) return;
      const target = event.target as HTMLElement;
      // 슬라이드 안 Link/button 에 focus 된 경우는 native Tab 이동 우선.
      if (target !== event.currentTarget) return;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToBanner(activeIndex - 1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToBanner(activeIndex + 1);
          break;
        case 'Home':
          event.preventDefault();
          goToBanner(0);
          break;
        case 'End':
          event.preventDefault();
          goToBanner(safeBanners.length - 1);
          break;
      }
    },
    [activeIndex, goToBanner, safeBanners.length]
  );

  return (
    <section className="px-4 pt-3" aria-label="추천 운세 배너">
      <div
        ref={viewportRef}
        className="flex w-full snap-x snap-mandatory overflow-x-hidden scrollbar-none rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-pink-strong)] focus-visible:ring-offset-2"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', touchAction: 'pan-y' }}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`추천 운세 배너 ${activeIndex + 1}/${safeBanners.length}`}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          // 2026-05-20 — 사용자 보고: 모바일에서 손가락 swipe 가 부드럽지 않음.
          //   기존 'mouse only' 가드 제거 → mouse + touch + pen 모두 drag 허용.
          //   mouse 의 경우만 left button 체크 (right click 등 제외).
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          const viewport = viewportRef.current;
          if (!viewport) return;
          suppressClickRef.current = false;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startWindowScrollY: window.scrollY,
            startScrollLeft: viewport.scrollLeft,
            moved: false,
            axis: null,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          const viewport = viewportRef.current;
          if (!viewport || drag.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - drag.startX;
          const deltaY = event.clientY - drag.startY;
          if (!drag.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 6) {
            drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
          }
          if (drag.axis === 'vertical') {
            // 일부 Android 인앱 WebView는 가로 캐러셀에서 시작한 세로 제스처를
            // 페이지로 넘기지 않는다. native pan이 시작되면 pointercancel 되므로,
            // 이벤트가 계속 오는 WebView에서만 이 값이 안전망으로 작동한다.
            window.scrollTo({ top: drag.startWindowScrollY - deltaY, behavior: 'auto' });
            return;
          }
          if (drag.axis !== 'horizontal') return;
          if (!viewport.hasPointerCapture(event.pointerId)) {
            viewport.setPointerCapture(event.pointerId);
          }
          drag.moved = true;
          viewport.scrollLeft = drag.startScrollLeft - deltaX;
          event.preventDefault();
        }}
        onPointerUp={(event) => {
          const viewport = viewportRef.current;
          if (viewport?.hasPointerCapture(event.pointerId)) {
            viewport.releasePointerCapture(event.pointerId);
          }
          suppressClickRef.current = dragRef.current.moved;
          dragRef.current.pointerId = null;
        }}
        onPointerCancel={(event) => {
          const viewport = viewportRef.current;
          if (viewport?.hasPointerCapture(event.pointerId)) {
            viewport.releasePointerCapture(event.pointerId);
          }
          suppressClickRef.current = dragRef.current.moved;
          dragRef.current.pointerId = null;
        }}
      >
        {safeBanners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.href}
            className={`relative block w-full shrink-0 snap-start overflow-hidden rounded-[22px] no-underline${
              banner.image ? '' : ' p-5 text-white'
            }`}
            style={
              banner.image
                ? undefined
                : {
                    background:
                      banner.tone === 'soft'
                        ? 'var(--app-pink-soft)'
                        : banner.tone === 'night'
                        ? 'linear-gradient(135deg, #1a1a20 0%, #3a1530 100%)'
                        : 'linear-gradient(135deg, var(--app-pink) 0%, var(--app-pink-strong) 100%)',
                    color: banner.tone === 'soft' ? 'var(--app-ink)' : '#fff',
                    minHeight: 160,
                  }
            }
            aria-label={banner.image ? banner.alt ?? banner.title : undefined}
            onClick={(event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                suppressClickRef.current = false;
                return;
              }
              onTrack?.({
                from: 'home_banner',
                banner: banner.id,
                menu: banner.cta,
              });
            }}
          >
            {/* 2026-06-26 — 완성형 이미지 배너(3:1). 지정 시 이미지만 풀블리드, 텍스트 레이어 대체. */}
            {banner.image ? (
              <picture>
                <source srcSet={`/images/gangi/banners/${banner.image}.avif`} type="image/avif" />
                <source srcSet={`/images/gangi/banners/${banner.image}.webp`} type="image/webp" />
                <img
                  src={`/images/gangi/banners/${banner.image}.png`}
                  alt={banner.alt ?? banner.title}
                  className="block w-full"
                  style={{ aspectRatio: '3 / 1', objectFit: 'cover' }}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            ) : (
            <>
            {/* 한자 배경 (운/緣 등) */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-3 -right-3 select-none"
              style={{
                fontFamily: 'var(--font-han)',
                fontSize: 161,
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
                  fontSize: 16,
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
                  fontSize: 26,
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
                  fontSize: 16.5,
                  opacity: 0.9,
                  lineHeight: 1.62,
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
                  fontSize: 15.5,
                  fontWeight: 800,
                  padding: '9px 14px',
                }}
              >
                {banner.cta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
            </>
            )}
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
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.02em',
            height: 22,
          }}
        >
          {label || 'FREE'}
        </span>
        <div
          className="mt-1 truncate"
          style={{
            fontSize: 17,
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
              fontSize: 15,
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
              'inline-flex shrink-0 items-center rounded-[999px] border px-4 text-[15.5px] font-semibold transition-colors',
              'whitespace-nowrap'
            )}
            style={{
              height: 42,
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

  // 2026-06-26 메인 카드 시안 C(20260625 PPTX): 인물 사진 풀블리드 + 비네팅 + 하단 외곽선 강조 텍스트.
  //   파스텔 틴트는 인물 사진의 투명 영역(배경 제거 PNG) 채움색. 인물 이미지는 추후 교체 예정.
  const TINT: Record<NonNullable<GangiServiceCard['tint']>, string> = {
    pink: '#fff0f7',
    plum: '#f6eefe',
    sky: '#eaf4fd',
    coral: '#fff0ee',
    indigo: '#eeeefb',
    amber: '#fdf4e3',
    jade: '#e9f7f2',
  };
  const tintBg = TINT[card.tint ?? 'pink'];

  return (
    <Link
      href={card.href}
      onClick={() => onTrack?.(card)}
      data-free={isFree ? 'true' : 'false'}
      className="relative block aspect-[3/4] overflow-hidden rounded-[20px] no-underline transition-transform active:scale-[0.98]"
      style={{ background: tintBg, color: 'var(--app-ink)' }}
    >
      {/* 인물 사진 풀블리드 — picture(avif/webp/png) object-top. 없으면 chip 폴백. */}
      {card.image ? (
        <picture>
          <source srcSet={`/images/gangi/people/${card.image}.avif`} type="image/avif" />
          <source srcSet={`/images/gangi/people/${card.image}.webp`} type="image/webp" />
          <img
            src={`/images/gangi/people/${card.image}.png`}
            alt={card.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </picture>
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          {card.chipKind === 'star-sign' ? (
            <StarSignChip kind={card.starSign} size="lg" />
          ) : (
            <ZodiacChip kind={card.zodiac as ZodiacKey} size="lg" />
          )}
        </span>
      )}

      {/* 비네팅 — 가장자리만 은은하게 어둡게(글씨 가독성). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 16%, transparent 38%, rgba(15,8,16,0.58) 100%)' }}
      />

      {/* 태그 (HOT / 추천) */}
      {card.tag ? (
        <span
          className="absolute right-2.5 top-2.5 z-10 inline-flex items-center rounded-[6px] px-1.5"
          style={{
            background: card.tag === 'HOT' ? 'var(--app-coral)' : 'var(--app-pink)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: '0.03em',
            height: 22,
          }}
        >
          {card.tag}
        </span>
      ) : null}

      {/* 하단 강조 텍스트 — 제목/부제 배지. 2026-07-18(20260718 PPTX slide4): 50대 이상 타깃
          가독성 요구("더 크게, 잘 보이는 색깔로"). 흰 글씨+그림자만으로는 인물 사진 위에서
          대비가 들쭉날쭉해 **불투명 배경판**으로 고정 대비를 만든다(제목=먹빛 판/흰 글씨,
          부제=노란 판/먹빛 글씨). 제목 글자수가 2자("사주")~9자("질문 하나 대화상담")로
          편차가 커서 길이별로 크기를 단계 조절 — 고정 크기면 긴 제목이 카드를 넘친다. */}
      <span className="absolute inset-x-0 bottom-0 block p-3">
        <span
          className="inline-block rounded-[9px] px-2 py-1"
          style={{
            background: 'rgba(20,14,26,0.86)',
            color: '#fff',
            fontSize: card.title.length <= 3 ? 29 : card.title.length <= 5 ? 23 : 18,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}
        >
          {card.title}
        </span>
        <span
          className="mt-1.5 inline-block rounded-[8px] px-2 py-0.5"
          style={{
            background: '#ffd83d',
            color: '#241a08',
            fontSize: 14.4,
            fontWeight: 850,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {card.desc}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-[8px] px-2 py-0.5"
            style={{
              background: isFree ? 'rgba(255,255,255,0.94)' : 'var(--app-pink)',
              color: isFree ? 'var(--app-jade)' : '#fff',
              fontSize: 15,
              fontWeight: 900,
            }}
          >
            {card.priceKey ? <Price priceKey={card.priceKey} /> : card.price}
          </span>
          {/* 이벤트 원가 취소선 — compare 값 없으면 ComparePrice 가 스스로 null 렌더. */}
          {card.priceKey ? (
            <ComparePrice
              priceKey={card.priceKey}
              className="text-[12.5px] font-bold text-white line-through [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]"
            />
          ) : null}
        </span>
      </span>
    </Link>
  );
}

// ─── 5) Bottom CTA — 홈 대표 진입(미결정) CTA (mockup 5번 섹션, 신규) ──────
// Task8 — "생년월일만 알면 3초 안에 시작"은 상품(사주/오늘운세)을 특정하지 않는
//   홈의 대표 시작 버튼이라 통합 허브(/start)로 보낸다. 상품이 명확한 카드
//   (GANGI_HOME_CARDS 등)는 각자 라우트를 그대로 유지한다.
export function GangiHomeBottomCta({ onTrack }: { onTrack?: () => void }) {
  return (
    <section className="px-4 pt-4 pb-3" aria-label="운세 시작 CTA">
      <Link
        href="/start"
        onClick={onTrack}
        className="flex items-center gap-3.5 rounded-[20px] p-4 no-underline"
        style={{ background: 'var(--app-ink)', color: '#fff' }}
      >
        <ZodiacChip kind="dragon" size="lg" />
        <div className="min-w-0 flex-1">
          <div
            style={{
              fontSize: 15,
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
              fontSize: 20,
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
            fontSize: 15,
            fontWeight: 800,
            padding: '9px 13px',
          }}
        >
          시작 →
        </span>
      </Link>
    </section>
  );
}
