import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import {
  ENGINE_METHOD_ENTRIES,
  type EngineMethodEntry,
  getEngineMethodEntriesBySlug,
  getEngineMethodEntry,
} from '@/lib/engine-method-pages';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ENGINE_METHOD_ENTRIES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getEngineMethodEntry(slug);

  if (!item) {
    return {
      title: '계산 기준 읽을거리',
    };
  }

  return {
    title: `${item.title} | 달빛인생`,
    description: item.description,
    keywords: item.keywords,
    alternates: {
      canonical: `/method/${item.slug}`,
    },
    openGraph: {
      title: `${item.title} | 달빛인생`,
      description: item.description,
      url: `https://saju-app-lac.vercel.app/method/${item.slug}`,
      siteName: '달빛인생',
      locale: 'ko_KR',
      type: 'article',
    },
  };
}

function buildMethodFaqs(item: EngineMethodEntry) {
  const firstSection = item.sections[0];
  const secondSection = item.sections[1];
  const visibleChecks = item.checklist.slice(0, 3).join(', ');

  return [
    {
      question: item.question,
      answer: item.lead,
    },
    {
      question: `${item.title}에서 먼저 확인해야 할 기준은 무엇인가요?`,
      answer: firstSection
        ? `${firstSection.body} 달빛인생에서는 ${visibleChecks} 같은 기준을 결과 화면에서 함께 확인할 수 있습니다.`
        : `${visibleChecks} 같은 기준을 먼저 확인하는 편이 좋습니다.`,
    },
    {
      question: '달빛인생에서는 이 주제를 어떤 방식으로 보여주나요?',
      answer: secondSection
        ? `${secondSection.body} 결과 화면에서는 판단 단서와 체크 포인트를 같이 보여주고, 필요한 경우 풀이 기준과 깊은 사주풀이로 이어서 확인할 수 있습니다.`
        : '결과 화면에서는 판단 단서와 체크 포인트를 같이 보여주고, 필요한 경우 풀이 기준과 깊은 사주풀이로 이어서 확인할 수 있습니다.',
    },
  ];
}

function toSectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default async function MethodDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getEngineMethodEntry(slug);

  if (!item) {
    notFound();
  }

  const guidedItems = getEngineMethodEntriesBySlug(item.relatedSlugs);
  const secondaryItems = ENGINE_METHOD_ENTRIES.filter(
    (entry) => entry.slug !== item.slug && !item.relatedSlugs.includes(entry.slug)
  ).slice(0, 3);
  const faqs = buildMethodFaqs(item);
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    description: item.description,
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    mainEntityOfPage: `https://saju-app-lac.vercel.app/method/${item.slug}`,
    url: `https://saju-app-lac.vercel.app/method/${item.slug}`,
    articleSection: item.eyebrow,
    keywords: item.keywords,
    author: {
      '@type': 'Organization',
      name: '달빛인생',
    },
    publisher: {
      '@type': 'Organization',
      name: '달빛인생',
      url: 'https://saju-app-lac.vercel.app',
    },
    about: item.keywords.map((keyword) => ({
      '@type': 'Thing',
      name: keyword,
    })),
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  const sectionAnchors = item.sections.map((section) => ({
    href: `#${toSectionId(section.title)}`,
    label: section.title,
  }));

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <SectionSurface surface="panel">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
                {item.eyebrow}
              </Badge>
              <Badge className="border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]">풀이 기준 글</Badge>
            </div>

            <SectionHeader
              className="mt-5"
              title={item.title}
              titleClassName="text-4xl sm:text-5xl"
              description={<span className="app-reading-prose">{item.summary}</span>}
              descriptionClassName="text-[var(--app-copy)]"
            />

            <div className="mt-6 rounded-[22px] border border-[var(--app-line)] bg-white p-5">
              <div className="text-sm text-[var(--app-copy-soft)]">이 글이 답하려는 질문</div>
              <p className="font-display mt-3 text-lg font-semibold text-[var(--app-ivory)]">{item.question}</p>
              <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">{item.lead}</p>
            </div>
          </SectionSurface>

          <SupportRail
            surface="muted"
            eyebrow="도움말"
            title="궁금한 부분만 가볍게 확인하세요"
            description="내 결과를 보다가 낯선 기준이 나올 때, 필요한 단락만 짧게 확인할 수 있도록 정리했습니다."
          >
            <nav className="app-reading-nav">
              <div className="app-caption mb-3">바로 보기</div>
              <div className="app-reading-nav-list">
                {sectionAnchors.map((section) => (
                  <Link key={section.href} href={section.href} className="app-reading-nav-link">
                    {section.label}
                  </Link>
                ))}
                <Link href="#faq" className="app-reading-nav-link">
                  자주 이어지는 질문
                </Link>
              </div>
            </nav>

            <ActionCluster>
              <Link
                href="/about-engine"
                className="moon-action-secondary"
              >
                풀이 기준 보기
              </Link>
              <Link
                href="/sample-report"
                className="moon-action-muted"
              >
                샘플 리포트 보기
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <div className="app-reading-layout">
          <article className="app-reading-stack">
            {item.sections.map((section) => (
              <SectionSurface
                key={section.title}
                id={toSectionId(section.title)}
                surface="panel"
                className="scroll-mt-28"
              >
                <SectionHeader
                  title={section.title}
                  titleClassName="text-3xl"
                  description={<span className="app-reading-prose">{section.body}</span>}
                  descriptionClassName="text-[var(--app-copy)]"
                />
              </SectionSurface>
            ))}

            <SectionSurface id="faq" surface="panel" className="scroll-mt-28">
              <SectionHeader
                eyebrow="자주 이어지는 질문"
                title="본문을 읽고 나면 보통 이 질문들로 이어집니다"
                titleClassName="text-3xl"
              />
              <div className="mt-6 space-y-4">
                {faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
                  >
                    <h2 className="font-display text-sm font-semibold text-[var(--app-ivory)]">
                      {faq.question}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </SectionSurface>

            <SectionSurface surface="hero">
              <SectionHeader
                eyebrow="마무리 문장"
                title="읽은 기준을 실제 결과와 연결할 때 비로소 이 문서의 역할이 완성됩니다"
                titleClassName="text-3xl"
                description={<span className="app-reading-prose">{item.closing}</span>}
                descriptionClassName="text-[var(--app-copy)]"
                actions={
                  <ActionCluster>
                    <Link
                      href="/saju/new"
                      className="moon-action-primary"
                    >
                      사주 시작하기
                    </Link>
                    <Link
                      href="/membership"
                      className="moon-action-muted"
                    >
                      멤버십 기준 보기
                    </Link>
                  </ActionCluster>
                }
              />
            </SectionSurface>
          </article>

          <aside className="app-reading-rail">
            <SupportRail
              surface="lunar"
              eyebrow="체크 포인트"
              title="달빛인생에서는 이 기준이 실제로 보입니다"
              description="결과 화면에서 사용자가 직접 확인할 수 있는 지점만 짧게 모았습니다."
            >
              <BulletList items={item.checklist} />
            </SupportRail>

            <SectionSurface surface="panel">
              <SectionHeader
                eyebrow="다음 글 추천"
                title="이 글 다음에는 보통 이런 질문으로 이어집니다"
                titleClassName="text-2xl"
              />
              <div className="mt-5 space-y-3">
                {guidedItems.map((entry) => (
                  <FeatureCard
                    key={entry.slug}
                    surface="soft"
                    eyebrow={entry.eyebrow}
                    title={entry.title}
                    titleClassName="text-xl"
                    description={entry.summary}
                    footer={
                      <Link
                        href={`/method/${entry.slug}`}
                        className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                      >
                        이어 읽기
                      </Link>
                    }
                  />
                ))}
              </div>
            </SectionSurface>
          </aside>
        </div>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="넓게 이어보기"
            title="같은 기준 위에서 더 넓게 읽어볼 만한 글들입니다"
            titleClassName="text-3xl"
          />
          <ProductGrid columns={3} className="mt-6">
            {secondaryItems.map((entry) => (
              <FeatureCard
                key={entry.slug}
                surface="soft"
                eyebrow={entry.eyebrow}
                title={entry.title}
                titleClassName="text-2xl"
                description={entry.summary}
                footer={
                  <Link
                    href={`/method/${entry.slug}`}
                    className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    상세 읽기
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
