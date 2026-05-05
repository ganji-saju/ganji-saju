'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GangiCharacter } from '@/components/gangi/gangi-ui';
import type {
  GangiHomeCategoryKey,
  GangiServiceCard,
} from '@/content/gangi-market';
import { GANGI_HOME_CATEGORIES } from '@/content/gangi-market';

type TrackHandler = (payload: Record<string, unknown>) => void;

export function GangiSeasonBanner({ onTrack }: { onTrack?: TrackHandler }) {
  return (
    <section className="gangi-season-banner" aria-label="이번 주 추천 운세">
      <div className="gangi-season-glow" />
      <div>
        <p className="gangi-banner-kicker">이번 주의 띠</p>
        <h1>
          호랑이띠,
          <br />
          새 기회가 오는 주
        </h1>
      </div>
      <div className="gangi-banner-bottom">
        <p>
          연락 한 통이 일주일을
          <br />
          바꿀 수 있어요.
        </p>
        <GangiCharacter zodiac="tiger" size="lg" />
      </div>
      <Link
        href="/zodiac"
        className="gangi-banner-button"
        onClick={() => onTrack?.({ from: 'home_banner', menu: '띠운세' })}
      >
        12띠 운세 모두 보기
        <ArrowRight className="h-4 w-4" />
      </Link>
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
