'use client';

import { useEffect, type ReactNode } from 'react';
import {
  GangiHomeBottomCta,
  GangiSeasonBanner,
  GangiServiceCardLink,
} from '@/components/gangi/gangi-market';
import {
  GANGI_HOME_CARDS,
  type GangiHomeBanner,
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
  // 2026-06-23 — 메인 캐릭터 카드 개편(slide3 시안): 카테고리 탭·무료액션 분리 섹션 제거,
  //   8개 캐릭터 카드 단일 그리드로 통합. 출시 예정 카드는 계속 숨김(미완성 노출 0).
  const visibleCards = GANGI_HOME_CARDS.filter((card) => card.price !== '출시 예정');

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

        {/* 2026-06-23 시안 — 8개 캐릭터 카드 그리드(사주·대운·택일·궁합 / 꿈해몽·대화상담·무료타로·무료운세). */}
        <section
          className="grid grid-cols-2 gap-3 px-4 pt-4"
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
