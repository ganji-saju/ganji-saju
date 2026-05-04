import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpenText, Compass, FileText, MessageCircleMore } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import {
  INTERPRETATION_ENTRY_GUIDE,
  INTERPRETATION_LAYERS,
  REPORT_SAMPLE_HREF,
  WISDOM_CARDS,
  toneClasses,
} from '@/content/moonlight';

export const metadata: Metadata = {
  title: '이용 안내',
  description: '달빛인생의 사주, 명리, 궁합, 타로, 리포트 보관과 상담 연결을 한곳에 모았습니다.',
  alternates: { canonical: '/guide' },
};

const READING_FLOW = [
  '처음 1분은 한 줄 총평과 핵심 주제만 확인합니다.',
  '세부 단서는 궁금할 때만 따로 펼쳐봅니다.',
  '본문은 재물, 관계, 일, 생활 리듬처럼 궁금한 영역부터 읽습니다.',
  '오래 볼 내용은 PDF와 MY 보관함에 남기고, 추가 질문은 대화로 이어갑니다.',
] as const;

const GUIDE_LINKS = [
  {
    title: '샘플 리포트',
    body: '결제 전 실제 리포트가 어느 정도 깊이로 나오는지 먼저 봅니다.',
    href: REPORT_SAMPLE_HREF,
    cta: '샘플 보기',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: '계산 정보',
    body: '출생 시간, 절기, 진태양시처럼 결과에 영향을 주는 정보를 따로 확인합니다.',
    href: '/method',
    cta: '안내 보기',
    icon: <Compass className="h-5 w-5" />,
  },
  {
    title: '풀이 흐름',
    body: '어려운 사주 용어를 어떻게 생활 조언으로 바꾸는지 정리해 둔 안내입니다.',
    href: '/about-engine#decision-trace',
    cta: '흐름 보기',
    icon: <BookOpenText className="h-5 w-5" />,
  },
  {
    title: '대화로 이어가기',
    body: '리포트를 읽은 뒤 남는 질문은 달빛인생에게 이어서 물어볼 수 있습니다.',
    href: '/dialogue',
    cta: '대화 시작',
    icon: <MessageCircleMore className="h-5 w-5" />,
  },
] as const;

const HOME_MOVED_GUIDES = [
  {
    title: '오늘운세와 가벼운 탐색',
    body: '오늘의 흐름, 타로, 별자리, 띠운세는 홈이 아니라 해석 메뉴에서 가볍게 시작합니다.',
    href: '/interpretation',
    cta: '해석 메뉴 보기',
  },
  {
    title: '궁합과 관계 풀이',
    body: '상대 정보를 직접 입력하거나 저장된 사람을 골라 관계의 결을 따로 확인합니다.',
    href: '/compatibility/input',
    cta: '궁합 입력하기',
  },
  {
    title: '선생 말투와 대화',
    body: '풀이를 읽은 뒤 남는 질문은 대화에서 이어가고, 말투 선택은 결과를 더 편하게 읽기 위한 장치입니다.',
    href: '/dialogue',
    cta: '대화 열기',
  },
  {
    title: '리포트 상품과 보관',
    body: '깊은 사주풀이, 연간 전략서, PDF, MY 보관함처럼 소장형 흐름은 멤버십에서 비교합니다.',
    href: '/membership',
    cta: '상품 보기',
  },
  {
    title: '풀이 기준과 판단 흐름',
    body: '절기, 출생지, 시간 보정, 판단 단서처럼 설명이 필요한 기준은 별도 문서에서 확인합니다.',
    href: '/method',
    cta: '기준 보기',
  },
  {
    title: '샘플 리포트',
    body: '실제 결제 전 어떤 내용이 남는지 샘플 화면으로 먼저 살펴봅니다.',
    href: REPORT_SAMPLE_HREF,
    cta: '샘플 보기',
  },
] as const;

export default function GuidePage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-0">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="guide"
              className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              이용 안내
            </Badge>,
            <Badge
              key="light"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              도움말과 기준
            </Badge>,
          ]}
          title="풀이에 방해되는 설명은 여기서만 따로 보세요"
          description="풀이 화면에서는 결과와 행동을 먼저 보여드리고, 설명이 필요한 내용은 이 안내 페이지에 모았습니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <SectionSurface surface="lunar" size="lg">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="처음 오셨다면"
              title="궁금한 깊이에 맞춰 바로 시작하시면 됩니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="오래 남길 풀이는 사주에서, 관계는 궁합에서, 가벼운 하루 흐름은 무료 운세에서 시작하면 가장 덜 헷갈립니다."
              actions={
                <ActionCluster>
                  <Link href="/saju/new" className="moon-cta-primary">
                    내 깊은 사주풀이 만들기
                  </Link>
                  <Link
                    href="/interpretation"
                    className="moon-action-secondary"
                  >
                    해석 입구 보기
                  </Link>
                </ActionCluster>
              }
            />

            <div className="mt-6 grid gap-4">
              {INTERPRETATION_ENTRY_GUIDE.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  title={item.title}
                  titleClassName="text-2xl"
                  description={item.body}
                  footer={
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      {item.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ))}
            </div>
          </SectionSurface>

          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="결과 활용"
              title="궁금한 영역부터 바로 보시면 됩니다"
              titleClassName="text-3xl"
              description="달빛인생 리포트는 한 줄 요약, 재물·관계·일 같은 분야, 오늘 할 행동을 먼저 보도록 정리합니다."
            />
            <BulletList items={READING_FLOW} className="mt-6" />
          </SectionSurface>
        </section>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="홈에서 분리한 정보"
            title="사주풀이 외의 안내는 이곳에서 찾으시면 됩니다"
            titleClassName="text-3xl"
            description="홈은 깊은 사주풀이 시작에 집중하고, 여러 서비스와 도움말은 안내 페이지에 모았습니다."
          />

          <ProductGrid columns={3} className="mt-6">
            {HOME_MOVED_GUIDES.map((item) => (
              <FeatureCard
                key={item.title}
                surface="soft"
                title={item.title}
                titleClassName="text-xl"
                description={item.body}
                footer={
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-2 text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    {item.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
            ))}
          </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="해석 종류"
            title="서비스마다 맡은 역할이 다릅니다"
            titleClassName="text-3xl"
            description="풀이 화면에서는 이 설명을 반복하지 않도록, 전체 개념은 이곳에만 모아두었습니다."
          />

          <ProductGrid columns={3} className="mt-6">
            {WISDOM_CARDS.map((card) => {
              const tone = toneClasses(card.tone);

              return (
                <FeatureCard
                  key={card.slug}
                  surface="soft"
                  eyebrow={<span className={`font-hanja tracking-[0.22em] ${tone.text}`}>{card.hanja}</span>}
                  title={card.title}
                  titleClassName={`text-2xl ${tone.text}`}
                  description={card.description}
                  footer={
                    <Link
                      href={card.href}
                      className={`inline-flex items-center gap-2 text-sm underline underline-offset-4 hover:text-[var(--app-ivory)] ${tone.text}`}
                    >
                      바로 열기
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              );
            })}
          </ProductGrid>
        </SectionSurface>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="풀이 깊이"
              title="가벼운 운세와 소장 리포트는 구분해서 봅니다"
              titleClassName="text-3xl"
              description="무료 탐색은 오늘의 감을 잡는 입구이고, 깊은 사주풀이는 오래 남겨 다시 읽는 리포트입니다."
            />
            <div className="mt-6 grid gap-4">
              {INTERPRETATION_LAYERS.map((layer) => (
                <FeatureCard
                  key={layer.title}
                  surface="soft"
                  title={layer.title}
                  titleClassName="text-xl"
                  description={layer.body}
                />
              ))}
            </div>
          </SectionSurface>

          <SectionSurface surface="lunar">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="더 자세한 안내"
              title="세부 안내와 예시는 필요할 때만 펼쳐보세요"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="계산 정보나 풀이 흐름은 일반 풀이 화면에서 길게 반복하지 않고, 아래 페이지로 분리했습니다."
            />

            <ProductGrid columns={2} className="mt-6">
              {GUIDE_LINKS.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-gold)]/25 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]">
                      {item.icon}
                    </span>
                  }
                  title={item.title}
                  titleClassName="text-xl"
                  description={item.body}
                  footer={
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      {item.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ))}
            </ProductGrid>
          </SectionSurface>
        </section>
      </AppPage>
    </AppShell>
  );
}
