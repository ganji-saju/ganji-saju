'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GangiCharacter } from '@/components/gangi/gangi-ui';
import type {
  GangiHomeBanner,
  GangiHomeCategoryKey,
  GangiServiceCard,
} from '@/content/gangi-market';
import { GANGI_HOME_BANNERS, GANGI_HOME_CATEGORIES } from '@/content/gangi-market';

type TrackHandler = (payload: Record<string, unknown>) => void;

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
    <section className="gangi-season-carousel" aria-label="추천 운세 배너">
      <div
        ref={viewportRef}
        className="gangi-banner-viewport"
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
        <div className="gangi-banner-track">
          {safeBanners.map((banner) => (
            <article
              key={banner.id}
              className="gangi-season-banner"
              data-tone={banner.tone}
              onPointerMove={(event) => {
                if (event.pointerType !== 'mouse') return;
                const box = event.currentTarget.getBoundingClientRect();
                const x = (event.clientX - box.left) / box.width - 0.5;
                const y = (event.clientY - box.top) / box.height - 0.5;
                event.currentTarget.style.setProperty('--banner-shift-x', String(x * 10) + 'px');
                event.currentTarget.style.setProperty('--banner-shift-y', String(y * 8) + 'px');
                event.currentTarget.style.setProperty('--banner-visual-x', String(x * -4.5) + 'px');
                event.currentTarget.style.setProperty('--banner-visual-y', String(y * -3) + 'px');
                event.currentTarget.style.setProperty('--banner-tilt', String(x * 1.8) + 'deg');
              }}
              onPointerLeave={(event) => {
                event.currentTarget.style.setProperty('--banner-shift-x', '0px');
                event.currentTarget.style.setProperty('--banner-shift-y', '0px');
                event.currentTarget.style.setProperty('--banner-visual-x', '0px');
                event.currentTarget.style.setProperty('--banner-visual-y', '0px');
                event.currentTarget.style.setProperty('--banner-tilt', '0deg');
              }}
            >
              <div className="gangi-season-glow" />
              <div className="gangi-banner-copy">
                <p className="gangi-banner-kicker">{banner.kicker}</p>
                <h1>{banner.title}</h1>
                <p className="gangi-banner-desc">{banner.description}</p>
                <Link
                  href={banner.href}
                  className="gangi-banner-button"
                  onClick={() =>
                    onTrack?.({
                      from: 'home_banner',
                      banner: banner.id,
                      menu: banner.cta,
                    })
                  }
                >
                  {banner.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="gangi-banner-visual" aria-hidden="true">
                {banner.zodiac ? (
                  <GangiCharacter zodiac={banner.zodiac} size="lg" />
                ) : (
                  <span className="gangi-banner-moon" />
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="gangi-banner-dots" aria-label="배너 선택">
        {safeBanners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            aria-label={String(index + 1) + '번째 배너 보기'}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => goToBanner(index)}
          />
        ))}
      </div>
    </section>
  );
}

export function GangiQuickActionCard({
  href,
  mark,
  label,
  title,
  desc,
  onTrack,
}: {
  href: string;
  mark: 'sun' | 'card';
  label: string;
  title: string;
  desc: string;
  onTrack?: () => void;
}) {
  return (
    <Link href={href} className="gangi-free-action" onClick={onTrack}>
      <span className={mark === 'sun' ? 'gangi-sun-mark' : 'gangi-card-mark'} />
      <span className="gangi-free-label">{label}</span>
      <strong>{title}</strong>
      <em>{desc}</em>
    </Link>
  );
}

export function GangiCategoryTabs({
  active,
  onChange,
}: {
  active: GangiHomeCategoryKey;
  onChange: (category: GangiHomeCategoryKey) => void;
}) {
  return (
    <nav className="gangi-category-tabs" aria-label="운세 카테고리">
      {GANGI_HOME_CATEGORIES.map((category) => (
        <button
          key={category.key}
          type="button"
          data-active={active === category.key ? 'true' : 'false'}
          onClick={() => onChange(category.key)}
        >
          {category.label}
        </button>
      ))}
    </nav>
  );
}

export function GangiServiceCardLink({
  card,
  onTrack,
}: {
  card: GangiServiceCard;
  onTrack?: (card: GangiServiceCard) => void;
}) {
  return (
    <Link
      href={card.href}
      className="gangi-service-card"
      data-free={card.price === '무료' ? 'true' : 'false'}
      onClick={() => onTrack?.(card)}
    >
      {card.tag ? (
        <span className="gangi-card-tag" data-hot={card.tag === 'HOT'}>
          {card.tag}
        </span>
      ) : null}
      <GangiCharacter zodiac={card.zodiac} />
      <div className="gangi-card-body">
        <h2>{card.title}</h2>
        <p>{card.desc}</p>
        <span>
          {card.price === '무료' ? '무료로 보기' : card.price}
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
