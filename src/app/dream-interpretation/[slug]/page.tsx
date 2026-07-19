// Redesign 2026-05-17 — PageHero / SectionSurface / SectionHeader / FeatureCard /
// ProductGrid → inline + design token + Tailwind utility (PR #193 / #198 / #206 / #207 / #211).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { DREAM_ENTRIES } from '@/lib/free-content-pages';
import { buildRelatedDreamSlugs } from '@/lib/dream/related-dreams';
import { DREAM_CONTENT } from '@/lib/dream/dream-content';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { buildContentPageMetadata } from '@/lib/seo/page-metadata';
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFAQPageSchema,
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

  // 2026-05-20 Phase 8-D — enriched content (10 sections + FAQ). fallback = 기존 단순 layout.
  const content = DREAM_CONTENT[item.slug] ?? null;
  const oneLine = content?.oneLineSummary ?? item.summary;

  // 관련 꿈: 큐레이션(relatedSlugs) 우선 + 결정론적 회전 이웃으로 6개까지 자동 보강.
  //   내부 링크 확충(페이지당 링크↑) + 모든 꿈이 유입 링크를 받도록(강연결) — related-dreams.ts.
  const relatedItems = buildRelatedDreamSlugs(
    DREAM_ENTRIES.map((e) => e.slug),
    item.slug,
    content?.relatedSlugs ?? [],
    6
  )
    .map((slug) => DREAM_ENTRIES.find((e) => e.slug === slug))
    .filter(Boolean) as typeof DREAM_ENTRIES;

  // 2026-05-20 Phase 8-A + 8-D — JSON-LD Article + Breadcrumb + (조건부) FAQPage schema.
  const articleSchema = buildArticleSchema({
    headline: `${item.title} 꿈해몽`,
    description: oneLine,
    path: `/dream-interpretation/${item.slug}`,
    articleSection: '꿈해몽',
  });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: '홈', path: '/' },
    { name: '꿈해몽', path: '/dream-interpretation' },
    { name: item.title, path: `/dream-interpretation/${item.slug}` },
  ]);
  const faqSchema = content?.faqs?.length
    ? buildFAQPageSchema({
        items: content.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      })
    : null;

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
        {faqSchema ? (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: serializeStructuredData(faqSchema) }}
          />
        ) : null}
        <GangiPageHeader title="꿈해몽" backHref="/dream-interpretation" />

        {/* Hero — badge + title + description */}
        <section className="px-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-[12px] px-2.5 py-1 text-[12.6px] font-extrabold"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              꿈해몽
            </span>
            <span
              className="inline-flex items-center rounded-[12px] px-2.5 py-1 text-[12.6px] font-bold"
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
            className="mt-3 text-[27.6px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            {item.title}
          </h1>
          <p
            className="mt-2 text-[16.1px] leading-[1.7]"
            style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
          >
            {oneLine}
          </p>
        </section>

        {/* 2026-05-20 Phase 8-D — enriched content (10 sections) 또는 fallback (단순 2-card) */}
        {content ? (
          <>
            {/* §3 기본 의미 */}
            <article className="mx-[0.25rem]" style={PANEL_STYLE}>
              <div style={KICKER_STYLE}>기본 의미</div>
              <p
                className="mt-2 text-[15.5px] leading-[1.8]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                {content.baseMeaning}
              </p>
            </article>

            {/* §4 상황별 해석 */}
            {content.situations.length > 0 ? (
              <article className="mx-[0.25rem]" style={PANEL_STYLE}>
                <div style={KICKER_STYLE}>상황별 해석</div>
                <ul className="mt-3 space-y-3">
                  {content.situations.map((s) => (
                    <li
                      key={s.heading}
                      className="rounded-[0.9rem] p-3"
                      style={{ background: 'var(--app-pink-soft)' }}
                    >
                      <div
                        className="text-[14.4px] font-extrabold"
                        style={{ color: 'var(--app-pink-strong)' }}
                      >
                        {s.heading}
                      </div>
                      <p
                        className="mt-1 text-[14.4px] leading-[1.65]"
                        style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                      >
                        {s.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {/* §5 심리적 해석 + §7 주의할 점 — 2 card */}
            <div className="mx-[0.25rem] grid gap-3 sm:grid-cols-2">
              <article style={SOFT_FEATURE_STYLE}>
                <div
                  className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink-strong)' }}
                >
                  심리적 해석
                </div>
                <p
                  className="mt-1.5 text-[15px] leading-[1.75]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {content.psychological}
                </p>
              </article>
              <article style={SOFT_FEATURE_STYLE}>
                <div
                  className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-coral)' }}
                >
                  주의할 점
                </div>
                <p
                  className="mt-1.5 text-[15px] leading-[1.75]"
                  style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                >
                  {content.caution}
                </p>
              </article>
            </div>

            {/* §6 오늘의 행동 가이드 */}
            {content.actionGuide.length > 0 ? (
              <article className="mx-[0.25rem]" style={PANEL_STYLE}>
                <div style={KICKER_STYLE}>오늘의 행동 가이드</div>
                <ul className="mt-3 space-y-2">
                  {content.actionGuide.map((line, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-[15px] leading-[1.65]"
                      style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: 'var(--app-pink)' }}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}

            {/* §10 FAQ */}
            {content.faqs.length > 0 ? (
              <article className="mx-[0.25rem]" style={PANEL_STYLE}>
                <div style={KICKER_STYLE}>자주 묻는 질문</div>
                <dl className="mt-3 space-y-3">
                  {content.faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      className="rounded-[0.9rem] border p-3"
                      style={{ borderColor: 'var(--app-line)' }}
                    >
                      <dt
                        className="text-[15px] font-extrabold leading-snug"
                        style={{ color: 'var(--app-ink)' }}
                      >
                        Q. {faq.question}
                      </dt>
                      <dd
                        className="mt-1.5 text-[14.4px] leading-[1.7]"
                        style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
                      >
                        {faq.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ) : null}
          </>
        ) : (
          // fallback (DREAM_CONTENT 에 없는 entry) — 기존 단순 2-card layout
          <div className="mx-[0.25rem] grid gap-3 sm:grid-cols-2">
            <article style={SOFT_FEATURE_STYLE}>
              <div
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                보통 이렇게 봅니다
              </div>
              <p
                className="mt-1.5 text-[15px] leading-[1.7]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                {item.meaning}
              </p>
            </article>
            <article style={SOFT_FEATURE_STYLE}>
              <div
                className="text-[12.1px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink-strong)' }}
              >
                오늘 해볼 행동
              </div>
              <p
                className="mt-1.5 text-[15px] leading-[1.7]"
                style={{ color: 'var(--app-copy)', wordBreak: 'keep-all' }}
              >
                {item.action}
              </p>
            </article>
          </div>
        )}

        {/* §9 CTA — 다음으로 (꿈 → 운세 / 타로 / 사주 cross-area + 유료 funnel) */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>다음으로</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
            style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
          >
            마음에 남는 질문을 더 이어보세요
          </h2>
          {/* 2026-05-20 Phase 8-D — 무료 cross-area 3 link */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link
              href="/today-fortune?from=dream"
              className="inline-flex h-12 items-center justify-center rounded-[12px] px-4 text-[15px] font-extrabold text-white"
              style={{
                background: 'var(--app-pink)',
                boxShadow: '0 12px 28px rgba(216, 27, 114, 0.32)',
              }}
            >
              오늘운세 보기
            </Link>
            <Link
              href="/tarot/daily?from=dream"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-white px-4 text-[15px] font-extrabold"
              style={{
                border: '1px solid var(--app-pink-line)',
                background: 'var(--app-pink-soft)',
                color: 'var(--app-pink-strong)',
              }}
            >
              타로 세 장 뽑기
            </Link>
            <Link
              href="/dream"
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-white px-4 text-[15px] font-extrabold"
              style={{
                border: '1px solid var(--app-line)',
                color: 'var(--app-ink)',
              }}
            >
              꿈해몽 목록
            </Link>
          </div>
          {/* 2026-05-20 Phase 8-E — PaidFunnelGrid 공통 컴포넌트로 추출 + 멤버십 옵션 추가 (꿈해몽 가장 conversion 영역). */}
          <PaidFunnelGrid from="dream" tone="light" includeMembership className="mt-3" />
        </article>

        {/* §다른 꿈도 보기 — related */}
        <article className="mx-[0.25rem]" style={PANEL_STYLE}>
          <div style={KICKER_STYLE}>다른 꿈도 보기</div>
          <h2
            className="mt-1.5 text-[23px] font-extrabold leading-snug tracking-tight"
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
                  className="text-[16.1px] font-extrabold leading-snug tracking-tight"
                  style={{ color: 'var(--app-ink)', wordBreak: 'keep-all' }}
                >
                  {entry.title}
                </h3>
                <p
                  className="mt-1.5 text-[14.4px] leading-[1.65]"
                  style={{ color: 'var(--app-copy-muted)', wordBreak: 'keep-all' }}
                >
                  {entry.summary}
                </p>
              </Link>
            ))}
          </div>
        </article>

        {/* 친구에게 공유 — 2026-07-03 공유 커버리지: 공개 SEO 페이지인데 공유 UI 만 없던 곳. */}
        <section className="px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">친구에게 공유</h2>
          <ShareActions
            text={`${item.title} 꿈해몽 — ${oneLine}`}
            url={getCanonicalUrl(`/dream-interpretation/${item.slug}`)}
            className="mt-2.5"
            kakao={buildKakaoShare({
              title: `${item.title} 꿈해몽`,
              description: oneLine,
              path: `/dream-interpretation/${item.slug}`,
              buttonTitle: '꿈해몽 보기',
            })}
          />
        </section>
      </AppPage>
    </AppShell>
  );
}
