import type { Metadata } from 'next';
import Link from 'next/link';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { FusionStrip } from '@/components/moonlight/FusionStrip';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '궁합',
  description: '연인, 배우자, 부모자녀, 가족과의 궁합을 관계별 질문으로 살펴보는 궁합 페이지입니다.',
  alternates: { canonical: '/compatibility' },
};

export default function CompatibilityPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="gangi-subpage gangi-responsive-page space-y-6">
        <PageIntro
          eyebrow="관계의 결"
          title="어떤 관계를 풀고 싶은지 먼저 고르세요"
          description="기본 궁합은 사주 중심으로 관계의 큰 흐름을 보고, 성향궁합은 두 사람의 16유형 성향까지 함께 정리합니다."
          actions={
            <>
              <Link href="/compatibility/personality" className="gangi-primary-button">
                성향궁합 시작
              </Link>
              <Link href="/compatibility/input?relationship=lover" className="gangi-secondary-button">
                기본 궁합 시작
              </Link>
            </>
          }
        />

        <FusionStrip
          prefixLabel="두 사람의 사주 네 기둥"
          suffixLabel="두 사람의 성향 네 축"
        />

        <LightSection
          eyebrow="성향궁합"
          title="사주와 성향을 함께 보고 싶다면"
          description="관계 유형, 두 사람의 생년월일, 성향 선택 또는 간단 체크, 현재 질문까지 한 흐름으로 준비합니다."
          actions={
            <Link href="/compatibility/personality" className="gangi-primary-button">
              달빛 성향궁합 보기
            </Link>
          }
          surface="paper"
        >
          <p className="text-sm leading-6 text-[var(--gyeol-muted)]">
            기본 궁합보다 더 구체적으로 왜 끌리고 왜 부딪히는지 보고 싶을 때 사용하세요.
          </p>
        </LightSection>

        <LightSection
          eyebrow="기본 궁합"
          title="질문이 분명할수록 궁합 풀이도 더 선명해집니다"
          description="기존 기본 궁합 흐름은 그대로 유지합니다. 지금 궁금한 관계를 골라 입력 화면으로 이어가세요."
          surface="soft"
        >
          <FlowEntryList
            items={COMPATIBILITY_RELATIONSHIPS.map((item) => ({
              id: item.slug,
              href: `/compatibility/input?relationship=${item.slug}`,
              badge: item.title,
              title: item.hook,
              description: '기본 사주 궁합으로 관계의 큰 흐름을 봅니다.',
              meta: '입력하기',
            }))}
          />
        </LightSection>

        <LightSection
          eyebrow="깊이보기"
          title="무료로 먼저 확인하고 필요한 풀이만 더 열어보세요"
          description="멤버십과 유료 해금 흐름은 기존 정책을 그대로 사용합니다."
          actions={
            <>
              <Link href="/membership" className="gangi-primary-button">
                멤버십 보기
              </Link>
              <Link href="/pricing" className="gangi-secondary-button">
                가격 안내
              </Link>
            </>
          }
          surface="paper"
        />

        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}
