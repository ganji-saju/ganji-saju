import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { GANGI_FREE_HUB_ITEMS } from '@/content/gangi-market';

export const metadata: Metadata = {
  title: '무료운세',
  description: '오늘운세, 타로 한 장, 띠운세를 무료로 바로 시작하는 달빛인생 무료운세 허브입니다.',
  alternates: { canonical: '/free' },
};

export default function FreeFortunePage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="무료운세" />
        <PageIntro
          eyebrow="Free Start"
          title="무료로 바로 보는 오늘의 결"
          description="가입 없이도 오늘운세, 타로, 내 띠 흐름을 먼저 확인할 수 있어요."
        />
        <LightSection
          eyebrow="무료 시작"
          title="짧게 보고 필요한 풀이만 이어가기"
          description="카드형 나열보다 바로 선택할 수 있는 리스트로 정리했습니다."
          surface="soft"
        >
          <FlowEntryList
            items={GANGI_FREE_HUB_ITEMS.map((item) => ({
              id: item.href,
              href: item.href,
              title: item.title,
              description: item.desc,
              badge: 'FREE',
              meta: '시작',
            }))}
          />
        </LightSection>
        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}
