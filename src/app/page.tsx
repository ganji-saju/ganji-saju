'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppShell } from '@/shared/layout/app-shell';

const CATEGORY_TABS = [
  { label: '전체', categories: [] },
  { label: '사주·명리', categories: ['사주', '대운', '띠운세'] },
  { label: '운세·택일', categories: ['운세', '타로', '택일'] },
  { label: '상담', categories: ['궁합', '상담'] },
] as const;

const HERO_DOTS = ['비법', '궁합', '대운', '택일'] as const;

const SERVICE_CARDS = [
  {
    title: '990원 사주',
    subtitle: '용하다고 소문난 사주 해설',
    price: '1주문',
    href: '/saju/new',
    category: '사주',
    visual: '사주',
    theme: 'saju',
    teacher: '사주용선생',
  },
  {
    title: '궁합 해설',
    subtitle: '우리 사이는 몇 점? 궁합도 잘봐요',
    price: '1주문',
    href: '/compatibility/input',
    category: '궁합',
    visual: '궁합',
    theme: 'love',
    teacher: '궁합양선생',
  },
  {
    title: '대운 해설',
    subtitle: '올해와 앞으로의 흐름을 쉽게 봅니다',
    price: '990원',
    href: '/saju/new?focus=year',
    category: '대운',
    visual: '대운',
    theme: 'wave',
    teacher: '명리호선생',
  },
  {
    title: '택일',
    subtitle: '좋은 날, 확인할 날, 쉬어갈 날',
    price: '준비중',
    href: '/guide?teacher=move-mal',
    category: '택일',
    visual: '택일',
    theme: 'day',
    teacher: '이동말선생',
  },
  {
    title: '무료 오늘운세',
    subtitle: '오늘 조심할 말과 해볼 행동 하나',
    price: '무료',
    href: '/today-fortune?concern=general',
    category: '운세',
    visual: '오늘',
    theme: 'today',
    teacher: '오늘소선생',
  },
  {
    title: '무료 타로',
    subtitle: '카드 한 장으로 지금 마음 확인',
    price: '무료',
    href: '/tarot/daily',
    category: '타로',
    visual: '타로',
    theme: 'tarot',
    teacher: '타로토선생',
  },
  {
    title: '띠운세',
    subtitle: '내 띠로 보는 오늘의 기운',
    price: '무료',
    href: '/zodiac',
    category: '띠운세',
    visual: '띠운',
    theme: 'zodiac',
    teacher: '간지선생',
  },
  {
    title: '대화방 상담',
    subtitle: '궁금한 마음을 짧게 물어보기',
    price: '무료 시작',
    href: '/dialogue',
    category: '상담',
    visual: '상담',
    theme: 'consult',
    teacher: '달빛상담',
  },
] as const;

export default function HomePage() {
  const [activeCategory, setActiveCategory] =
    useState<(typeof CATEGORY_TABS)[number]['label']>(CATEGORY_TABS[0].label);
  const activeTab =
    CATEGORY_TABS.find((tab) => tab.label === activeCategory) ?? CATEGORY_TABS[0];
  const visibleServiceCards = useMemo(() => {
    if (!activeTab.categories.length) return SERVICE_CARDS;

    return SERVICE_CARDS.filter((card) =>
      activeTab.categories.includes(card.category as never)
    );
  }, [activeTab.categories]);

  useEffect(() => {
    trackMoonlightEvent('home_view', { brand: 'dalbit-insaeng-market' });
  }, []);

  return (
    <AppShell header={<SiteHeader />} className="dalbit-market-shell">
      <div className="dalbit-market-home">
        <section className="dalbit-market-hero" aria-label="오늘 추천 운세">
          <div className="dalbit-hero-stripe dalbit-hero-stripe-left" />
          <div className="dalbit-hero-stripe dalbit-hero-stripe-right" />
          <div className="dalbit-hero-side-copy" aria-hidden="true">
            <span>잘 풀리는 하루</span>
          </div>
          <div className="dalbit-hero-center">
            <div className="dalbit-hero-avatar">
              <span>猫</span>
            </div>
            <h1>
              <span>비법</span>
              <strong>택일</strong>
            </h1>
            <p>정통 운세를 오늘 바로 눌러보는 날</p>
            <Link
              href="/today-fortune?concern=general"
              className="dalbit-hero-button"
              onClick={() => trackMoonlightEvent('home_free_today_click', { from: 'market_hero' })}
            >
              무료운세 보기
            </Link>
          </div>
          <div className="dalbit-hero-dots" aria-label="추천 배너">
            {HERO_DOTS.map((dot, index) => (
              <span key={dot} data-active={index === 0 ? 'true' : 'false'} />
            ))}
          </div>
        </section>

        <nav className="dalbit-category-tabs" aria-label="운세 카테고리">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              data-active={tab.label === activeCategory ? 'true' : 'false'}
              onClick={() => {
                setActiveCategory(tab.label);
                trackMoonlightEvent('home_service_menu_click', {
                  from: 'market_home_tabs',
                  category: tab.label,
                });
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="dalbit-market-grid" aria-label="달빛인생 주요 서비스">
          {visibleServiceCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="dalbit-market-card"
              data-theme={card.theme}
              onClick={() =>
                trackMoonlightEvent('home_service_menu_click', {
                  from: 'market_home_grid',
                  menu: card.title,
                  teacher: card.teacher,
                })
              }
            >
              <div className="dalbit-market-card-art">
                <div className="dalbit-card-character">
                  <span>猫</span>
                </div>
                <div className="dalbit-card-big-copy">{card.visual}</div>
                <div className="dalbit-card-sparkle">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <div className="dalbit-market-card-body">
                <div>
                  <div className="dalbit-market-price">{card.price}</div>
                  <h2>{card.title}</h2>
                  <p>{card.subtitle}</p>
                </div>
                <div className="dalbit-market-cta">
                  해설 보러가기
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
