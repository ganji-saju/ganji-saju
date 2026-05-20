// Redesign 2026-05-17 — PageHero / SectionSurface / SectionHeader / FeatureCard /
// ProductGrid → inline + design token + Tailwind utility (PR #193 / #198 / #206 / #207 / #211).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { DREAM_ENTRIES } from '@/lib/free-content-pages';
import { buildContentPageMetadata } from '@/lib/seo/page-metadata';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  serializeStructuredData,
} from '@/lib/seo/structured-data';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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

  return buildContentPageMetadata({
    title: `${item.title} 꿈해몽`,
    description: `${item.title}이 반복해서 떠오를 때 참고할 수 있는 무료 꿈해몽 상세 페이지입니다.`,
    path: `/dream-interpretation/${item.slug}`,
  });
}

const PANEL_STYLE = {
  border: '1px solid rgba(17, 17, 20, 0.08)',
  borderRadius: '1.25rem',
  background: '#ffffff',
  padding: '1.4rem 1.15rem',
  boxShadow: '0 16px 38px -28px rgba(17, 17, 20, 0.32)',
} as const;

const SOFT_FEATURE_STYLE = {
  border: '1px solid var(--app-pink-line)',
  borderRadius: '0.95rem',
  background: 'var(--app-pink-soft)',
  padding: '0.95rem',
} as const;

const KICKER_STYLE = {
  color: 'var(--app-pink-strong)',
  fontSize: '0.76rem',
  fontWeight: 760,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
} as const;

export default async function DreamInterpretationDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getDreamEntry(slug);

  if (!item) {
    notFound();
  }

  const relatedItems = DREAM_ENTRIES.filter((entry) => entry.slug !== item.slug).slice(0, 3);

  // 2026-05-20 Phase 8-A — JSON-LD Article + Breadcrumb schema for SERP rich result.
  //   FAQPage schema 는 FAQ 콘텐츠 가 채워지는 Phase 8-D 에서 추가.
  const articleSchema = buildArticleSchema({
    headline: `${item.title} 꿈해몽`,
    description: `${item.title}이 반복해서 떠오를 때 참고할 수 있는 무료 꿈해몽 상세 페이지입니다.`,
    path: `/dream-interpretation/${item.slug}`,
    articleSection: '꿈해몽',
  });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: '홈', path: '/' },
    { name: '꿈해몽', path: '/dream-interpretation' },
    { name: item.title, path: `/dream-interpretation/${item.slug}` },
  ]);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5 sm:space-y-6">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(articleSchema) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(breadcrumbSchema) }}
        />
        <GangiPageHeader title="꿈해몽" backHref="/dream-interpretation" />

        {/* Hero — badge + title + description */}
        <section className="px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              꿈해몽
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                border: '1px solid var(--app-line)',
                background: '#ffffff',
                color: 'var(--app-copy-muted)',
              }}
            >
              무료 풀이
            </span>
          </div>
          <h1
            className="mt-3 text-[24px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            {item.title}
          </h1>
          <p
            className="mt-2 text-[14px] leading-[1.7]"
            style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
          >
            {item.summary}
          </p>
        </section>

        {/* §풀이 + 행동 — 2 card */}
        <div className="mx-[0.25rem] grid gap-3 sm:grid-cols-2">
          <article style={SOFT_FEATURE_STYLE}>
            <div
              className="text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink-strong)' }}
            >
              보통 이렇게 봅니다
            </div>
            <p
              className="mt-1.5 text-[13px] leading-[1.7]"
              style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
            >
              {item.meaning}
            </p>
          </article>
          <article style={SOFT_FEATURE_STYLE}>
            <div
              className="text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink-strong)' }}
            >
              오늘 해볼 행동
            </div>
            <p
              className="mt-1.5 text-[13px] leading-[1.7]"
              style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
            >
              {item.action}
            </p>
          </article>
        </div>

        {/* §다음으로 — CTA 2 button */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>다음으로</div>
          <h2
            className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            마음에 남는 질문을 더 이어보세요
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/tarot/daily"
              className="inline-flex h-12 items-center justify-center rounded-full px-5 text-[13.5px] font-extrabold text-white"
              style={{
                background: 'var(--app-pink)',
                boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)',
              }}
            >
              오늘의 타로 보기
            </Link>
            <Link
              href="/dream-interpretation"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-[13.5px] font-extrabold"
              style={{
                border: '1px solid var(--app-line)',
                color: 'var(--app-ink)',
                boxShadow: '0 12px 28px -24px rgba(17, 17, 20, 0.32)',
              }}
            >
              꿈해몽 목록으로
            </Link>
          </div>
        </article>

        {/* §다른 꿈도 보기 — related */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>다른 꿈도 보기</div>
          <h2
            className="mt-1.5 text-[20px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            비슷한 꿈해몽
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {relatedItems.map((entry) => (
              <Link
                key={entry.slug}
                href={`/dream-interpretation/${entry.slug}`}
                className="block rounded-[0.95rem] transition"
                style={{
                  border: '1px solid var(--app-line)',
                  background: '#ffffff',
                  padding: '0.95rem',
                }}
              >
                <h3
                  className="text-[14px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {entry.title}
                </h3>
                <p
                  className="mt-1.5 text-[12.5px] leading-[1.65]"
                  style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
                >
                  {entry.summary}
                </p>
              </Link>
            ))}
          </div>
        </article>
      </AppPage>
    </AppShell>
  );
}
