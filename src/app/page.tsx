'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GangiCategoryTabs,
  GangiHomeFooter,
  GangiQuickActionCard,
  GangiSeasonBanner,
  GangiServiceCardLink,
} from '@/components/gangi/gangi-market';
import {
  GANGI_FREE_ACTIONS,
  GANGI_HOME_CARDS,
  type GangiHomeCategoryKey,
} from '@/content/gangi-market';
import SiteHeader from '@/features/shared-navigation/site-header';
import { trackMoonlightEvent } from '@/lib/analytics';
import { AppShell } from '@/shared/layout/app-shell';

export default function HomePage() {
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
          onTrack={(payload) => trackMoonlightEvent('home_service_menu_click', payload)}
        />

        <section className="gangi-free-actions" aria-label="무료 빠른 운세">
          {GANGI_FREE_ACTIONS.map((action) => (
            <GangiQuickActionCard
              key={action.id}
              href={action.href}
              mark={action.mark}
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

        <section className="gangi-service-grid" aria-label="달빛인생 운세 상품">
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

        <GangiHomeFooter />
      </div>
    </AppShell>
  );
}
