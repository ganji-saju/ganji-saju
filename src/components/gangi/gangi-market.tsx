'use client';

import { useEffect, useState } from 'react';
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
  const activeBanner = safeBanners[activeIndex] ?? safeBanners[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeBanners.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [safeBanners.length]);

  useEffect(() => {
    if (activeIndex >= safeBanners.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, safeBanners.length]);

  return (
    <section
      className="gangi-season-banner"
      data-tone={activeBanner.tone}
      aria-label="추천 운세 배너"
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        event.currentTarget.style.setProperty('--banner-shift-x', `${x * 10}px`);
        event.currentTarget.style.setProperty('--banner-shift-y', `${y * 8}px`);
        event.currentTarget.style.setProperty('--banner-visual-x', `${x * -4.5}px`);
        event.currentTarget.style.setProperty('--banner-visual-y', `${y * -3}px`);
        event.currentTarget.style.setProperty('--banner-tilt', `${x * 1.8}deg`);
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
        <p className="gangi-banner-kicker">{activeBanner.kicker}</p>
        <h1>{activeBanner.title}</h1>
        <p className="gangi-banner-desc">{activeBanner.description}</p>
        <Link
          href={activeBanner.href}
          className="gangi-banner-button"
          onClick={() =>
            onTrack?.({
              from: 'home_banner',
              banner: activeBanner.id,
              menu: activeBanner.cta,
            })
          }
        >
          {activeBanner.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="gangi-banner-visual" aria-hidden="true">
        {activeBanner.zodiac ? (
          <GangiCharacter zodiac={activeBanner.zodiac} size="lg" />
        ) : (
          <span className="gangi-banner-moon" />
        )}
      </div>
      <div className="gangi-banner-dots" aria-label="배너 선택">
        {safeBanners.map((banner, index) => (
          <button
            key={banner.id}
            type="button"
            aria-label={String(index + 1) + '번째 배너 보기'}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => setActiveIndex(index)}
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
