// Redesign 2026-05-17 — design system component (GangiIntro / GangiListLink / GangiPageHeader)
// 기반 무료운세 허브. UI 는 components/gangi/gangi-ui.tsx 의 design system 안에 있고,
// page 자체는 data-driven mapping (GANGI_FREE_HUB_ITEMS). 별도 inline style 없이 시스템
// component 의 일관 시각 사용 — sibling /free 흐름 (사주 / 타로 / 띠) 들과 통일.
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppShell } from '@/shared/layout/app-shell';
import { GangiIntro, GangiListLink, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { GANGI_FREE_HUB_ITEMS } from '@/content/gangi-market';

export const metadata: Metadata = {
  title: '무료운세',
  description: '오늘운세, 타로 세 장, 띠운세를 무료로 바로 시작하는 간지사주 무료운세 허브입니다.',
  alternates: { canonical: '/free' },
};

export default function FreeFortunePage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <div className="gangi-subpage">
        <GangiPageHeader title="무료운세" />
        <GangiIntro
          title={
            <>
              무료로 바로 보는
              <br />
              운세
            </>
          }
          description="가입 없이도 오늘운세, 타로, 내 띠 흐름을 먼저 확인할 수 있어요."
        />
        <div className="gangi-action-list">
          {GANGI_FREE_HUB_ITEMS.map((item) => (
            <GangiListLink
              key={item.href}
              href={item.href}
              zodiac={item.zodiac}
              title={item.title}
              desc={item.desc}
              price="FREE"
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
