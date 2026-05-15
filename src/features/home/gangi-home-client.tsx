'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GangiCategoryTabs,
  GangiHomeBottomCta,
  GangiQuickActionCard,
  GangiSeasonBanner,
  GangiServiceCardLink,
} from '@/components/gangi/gangi-market';
import {
  GANGI_FREE_ACTIONS,
  GANGI_HOME_CARDS,
  type GangiHomeBanner,
  type GangiHomeCategoryKey,
} from '@/content/gangi-market';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppShell } from '@/shared/layout/app-shell';

export function GangiHomeClient({
  initialBanners,
  myStarSignSlot,
}: {
  initialBanners: readonly GangiHomeBanner[];
  /** server-rendered MyStarSignCard (profile 있을 때만 truthy). client 는 그대로 노출. */
  myStarSignSlot?: ReactNode;
}) {
  const [activeCategory, setActiveCategory] = useState<GangiHomeCategoryKey>('all');
  const visibleCards = useMemo(() => {
    if (activeCategory === 'all') return GANGI_HOME_CARDS;
    return GANGI_HOME_CARDS.filter((card) => card.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    trackMoonlightEvent('home_view', { brand: 'dalbit-insaeng-card-mall' });
  }, []);

  return (
    <AppShell header={<SiteHeader />} className="dalbit-market-shell">
      <div className="gangi-home">
        <GangiSeasonBanner
          banners={initialBanners}
          onTrack={(payload) => trackMoonlightEvent('home_service_menu_click', payload)}
        />

        {/* PR #132 — server 측에서 렌더된 MyStarSignCard slot. profile 없으면 null. */}
        {myStarSignSlot ? (
          <section className="px-4 pt-3" aria-label="MY 별자리 오늘 운세">
            {myStarSignSlot}
          </section>
        ) : null}

        <section
          className="grid grid-cols-2 gap-2.5 px-4 pt-3.5"
          aria-label="무료 빠른 운세"
        >
          {GANGI_FREE_ACTIONS.map((action) => (
            <GangiQuickActionCard
              key={action.id}
              href={action.href}
              mark={action.mark}
              zodiac={action.zodiac}
              label={action.label}
              title={action.title}
              desc={action.desc}
              onTrack={() =>
                trackMoonlightEvent(
                  action.id === 'today' ? 'home_free_today_click' : 'home_free_tarot_click',
                  { from: 'home_quick_action' }
                )
              }
            />
          ))}
        </section>

        <GangiCategoryTabs
          active={activeCategory}
          onChange={(category) => {
            setActiveCategory(category);
            trackMoonlightEvent('home_service_menu_click', {
              from: 'home_category_tabs',
              category,
            });
          }}
        />

        <section
          className="grid grid-cols-2 gap-3 px-4 pt-3"
          aria-label="달빛인생 운세 상품"
        >
          {visibleCards.map((card) => (
            <GangiServiceCardLink
              key={card.id}
              card={card}
              onTrack={(selected) =>
                trackMoonlightEvent('home_service_menu_click', {
                  from: 'home_card_grid',
                  menu: selected.title,
                  price: selected.price,
                })
              }
            />
          ))}
        </section>

        {/* PR2 redesign: mockup screens-a.jsx 5번 섹션 (Bottom CTA) */}
        <GangiHomeBottomCta
          onTrack={() =>
            trackMoonlightEvent('home_service_menu_click', {
              from: 'home_bottom_cta',
              menu: '사주 시작',
            })
          }
        />
      </div>
    </AppShell>
  );
}
