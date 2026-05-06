import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DREAM_ENTRIES } from '@/lib/free-content-pages';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

function getDreamEntry(slug: string) {
  return DREAM_ENTRIES.find((item) => item.slug === slug);
}

export async function generateStaticParams() {
  return DREAM_ENTRIES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getDreamEntry(slug);

  if (!item) {
    return {
      title: '꿈해몽',
    };
  }

  return {
    title: `${item.title} 꿈해몽`,
    description: `${item.title}이 반복해서 떠오를 때 참고할 수 있는 무료 꿈해몽 상세 페이지입니다.`,
    alternates: {
      canonical: `/dream-interpretation/${item.slug}`,
    },
  };
}

export default async function DreamInterpretationDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getDreamEntry(slug);

  if (!item) {
    notFound();
  }

  const relatedItems = DREAM_ENTRIES.filter((entry) => entry.slug !== item.slug).slice(0, 3);

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="detail"
              className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]"
            >
              꿈해몽
            </Badge>,
            <Badge key="free" className="border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]">
              무료 풀이
            </Badge>,
          ]}
          title={item.title}
          description={item.summary}
        />

        <ProductGrid columns={2}>
          <FeatureCard
            surface="soft"
            eyebrow="보통 이렇게 봅니다"
            description={item.meaning}
          />
          <FeatureCard
            surface="soft"
            eyebrow="오늘 해볼 행동"
            description={item.action}
          />
        </ProductGrid>

        <SectionSurface size="lg">
          <SectionHeader
            eyebrow="다음으로"
            title="마음에 남는 질문을 더 이어보세요"
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/tarot/daily">
              <Button className="px-6">
                오늘의 타로 보기
              </Button>
            </Link>
            <Link href="/dream-interpretation">
              <Button variant="outline">
                꿈해몽 목록으로 돌아가기
              </Button>
            </Link>
          </div>
        </SectionSurface>

        <section>
          <SectionHeader
            eyebrow="다른 꿈도 보기"
            title="비슷한 꿈해몽"
          />
          <ProductGrid columns={3} className="mt-5">
            {relatedItems.map((entry) => (
              <Link
                key={entry.slug}
                href={`/dream-interpretation/${entry.slug}`}
                className="group"
              >
                <FeatureCard
                  surface="soft"
                  className="h-full transition group-hover:-translate-y-0.5 group-hover:border-[var(--app-pink-line)]"
                  title={entry.title}
                  description={entry.summary}
                />
              </Link>
            ))}
          </ProductGrid>
        </section>
      </AppPage>
    </AppShell>
  );
}
