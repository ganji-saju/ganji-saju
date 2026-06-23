'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GangiCategoryTabs,
  GangiHomeBottomCta,
  GangiSeasonBanner,
  GangiServiceCardLink,
} from '@/components/gangi/gangi-market';
import {
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
  // 2026-06-23 — 메인 리디자인(간지사주 메인 리디자인.html): 배너 캐러셀 → 카테고리 칩 →
  //   8 캐릭터 카드(가로 레이아웃·파스텔 틴트) → 신규 유저 CTA. 라우팅·데이터·이벤트 불변.
  const [activeCategory, setActiveCategory] = useState<GangiHomeCategoryKey>('all');
  const visibleCards = useMemo(() => {
    // 미완성('출시 예정') 가격 카드는 숨김(결제 CTA 영역 미완성 표기 0).
    const activeCards = GANGI_HOME_CARDS.filter((card) => card.price !== '출시 예정');
    if (activeCategory === 'all') return activeCards;
    return activeCards.filter((card) => card.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    trackMoonlightEvent('home_view', { brand: 'dalbit-insaeng-card-mall' });
  }, []);

  return (
    <AppShell header={<SiteHeader />} className="dalbit-market-shell">
      <div className="gangi-home">
        {/* 배너 캐러셀 — 현재 배너데이터(GANGI_HOME_BANNERS). 배너 이미지 확정 시 시각 교체. */}
        <GangiSeasonBanner
          banners={initialBanners}
          onTrack={(payload) => trackMoonlightEvent('home_service_menu_click', payload)}
        />

        {/* server-rendered MyStarSignCard slot. profile 없으면 null. */}
        {myStarSignSlot ? (
          <section className="px-4 pt-3" aria-label="MY 별자리 오늘 운세">
            {myStarSignSlot}
          </section>
        ) : null}

        {/* 카테고리 칩 (전체 · 사주·명리 · 운세·택일 · 상담) */}
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

        {/* 8 캐릭터 카드 그리드 — 가로 레이아웃 + 원형 아바타 + 파스텔 틴트. */}
        <section
          className="grid grid-cols-2 gap-3 px-4 pt-3"
          aria-label="간지사주 운세 메뉴"
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

        {/* 신규 유저 CTA — "생년월일만 알면 3초 안에 시작" 다크 카드. */}
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
