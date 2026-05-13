import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppShell } from '@/shared/layout/app-shell';
import { GangiIntro, GangiListLink, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { GANGI_FREE_HUB_ITEMS } from '@/content/gangi-market';
import { buildOpenGraph, buildTwitter } from '@/lib/site';

const PAGE_TITLE = '무료운세';
const PAGE_DESC = '오늘운세, 타로 한 장, 띠운세를 무료로 바로 시작하는 달빛인생 무료운세 허브입니다.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESC,
  alternates: { canonical: '/free' },
  openGraph: buildOpenGraph({ title: PAGE_TITLE, description: PAGE_DESC, path: '/free' }),
  twitter: buildTwitter({ title: PAGE_TITLE, description: PAGE_DESC }),
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
