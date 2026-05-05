import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import { ENGINE_METHOD_ENTRIES } from '@/lib/engine-method-pages';

export const metadata: Metadata = {
  title: '풀이가 달라지는 이유 | 달빛인생',
  description:
    '사주 결과가 왜 다르게 보이는지, 출생지와 시간이 왜 필요한지 생활 언어로 풀어낸 도움말입니다.',
  alternates: {
    canonical: '/method',
  },
  openGraph: {
    title: '달빛인생 풀이 도움말',
    description:
      '결과가 다르게 보일 때 확인하면 좋은 출생 시간, 출생지, 풀이 흐름 도움말을 모았습니다.',
    url: 'https://ganji-saju.vercel.app/method',
    siteName: '달빛인생',
    locale: 'ko_KR',
    type: 'website',
  },
};

const READING_GUIDE = [
  '같은 생년월일인데 AI마다 결과가 달라 혼란스러웠던 경우',
  '출생지와 분 단위 시간을 왜 묻는지 납득이 잘 안 갔던 경우',
  '내 결과가 왜 그렇게 나왔는지만 짧게 확인하고 싶은 경우',
] as const;

const READING_ORDER = [
  'AI 사주 결과가 왜 달라질까',
  '출생지와 시간이 왜 필요할까',
  '부족한 기운은 어떻게 읽을까',
] as const;

export default function MethodIndexPage() {
  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="method-guide"
              className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              풀이 도움말
            </Badge>,
            <Badge key="seo" className="border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]">
              시간 · 장소 · 큰 흐름
            </Badge>,
          ]}
          title="결과가 왜 달라지는지 궁금할 때만 보세요"
          description="사주를 공부하기 위한 글이 아니라, 내 결과가 왜 다른 앱과 다르게 보이는지 이해하고 싶을 때 보는 도움말입니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="헷갈릴 때 확인"
              title="결과가 다르게 보이는 이유만 짧게 정리합니다"
              titleClassName="text-3xl"
              description="출생 시간, 출생지, 큰 흐름처럼 결과에 영향을 주는 부분만 생활 언어로 풀었습니다."
              descriptionClassName="text-[var(--app-copy)]"
            />

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
              <BulletList items={READING_GUIDE} />

              <div className="rounded-[20px] border border-[var(--app-line)] bg-white px-5 py-5">
                <div className="app-caption mb-3">궁금할 때 볼 주제</div>
                <BulletList items={READING_ORDER} />
              </div>
            </div>
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="바로 이어보기"
            title="설명보다 내 풀이가 먼저입니다"
            description="도움말은 궁금할 때만 확인하고, 실제 결과 화면에서는 핵심 요약과 분야별 조언을 먼저 보시면 됩니다."
          >
            <ActionCluster>
              <Link
                href="/about-engine"
                className="gangi-secondary-button"
              >
                풀이 안내 보기
              </Link>
              <Link
                href="/saju/new"
                className="gangi-primary-button"
              >
                사주 시작하기
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="궁금할 때 보는 도움말"
            title="설명은 길게 흩어놓기보다, 질문 단위로 나누어 읽기 좋게 정리했습니다"
            titleClassName="text-3xl"
            description="각 글은 하나의 질문에만 집중하고, 마지막에는 다음으로 읽기 좋은 주제를 이어서 제안합니다."
            descriptionClassName="text-[var(--app-copy)]"
          />

          <ProductGrid columns={2} className="mt-6">
            {ENGINE_METHOD_ENTRIES.map((entry) => (
              <FeatureCard
                key={entry.slug}
                surface="soft"
                badge={
                  <Badge className="border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]">쉬운 도움말</Badge>
                }
                eyebrow={entry.eyebrow}
                title={entry.title}
                titleClassName="text-3xl"
                description={
                  <>
                    <p>{entry.summary}</p>
                    <div className="mt-4 rounded-[18px] border border-[var(--app-line)] bg-white px-4 py-4 text-sm leading-7 text-[var(--app-copy-soft)]">
                      {entry.question}
                    </div>
                  </>
                }
                footer={
                  <Link
                    href={`/method/${entry.slug}`}
                    className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    이어서 읽기
                  </Link>
                }
              />
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
