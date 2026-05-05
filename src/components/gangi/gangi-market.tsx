'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GangiCharacter } from '@/components/gangi/gangi-ui';
import type {
  GangiHomeCategoryKey,
  GangiServiceCard,
} from '@/content/gangi-market';
import { GANGI_HOME_BANNERS, GANGI_HOME_CATEGORIES } from '@/content/gangi-market';

type TrackHandler = (payload: Record<string, unknown>) => void;

export function GangiSeasonBanner({ onTrack }: { onTrack?: TrackHandler }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeBanner = GANGI_HOME_BANNERS[activeIndex] ?? GANGI_HOME_BANNERS[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % GANGI_HOME_BANNERS.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      className="gangi-season-banner"
      data-tone={activeBanner.tone}
      aria-label="추천 운세 배너"
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
        {GANGI_HOME_BANNERS.map((banner, index) => (
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

export function GangiHomeFooter() {
  return (
    <footer className="gangi-home-footer">
      달빛인생 · 오늘 바로 보는 운세
      <br />
      © 2026 Moonlight Life
    </footer>
  );
}
