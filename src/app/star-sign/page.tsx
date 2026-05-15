// Redesign 2026-05-15 (확장):
// 별자리 메인 — 오늘 12 sign 운세 한눈 + element/quality 분류 + top/주의 + 호환 매트릭스 entry.
// PR #128: 기존 hero + 12 grid + featured 카드 → 6 섹션 구조로 두께 추가.
// 별자리별 일별 점수·하이라이트는 src/lib/star-sign/daily-fortune.ts 와 공유.
import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiStarSignIcon } from '@/components/gangi/gangi-star-sign';
import { Badge } from '@/components/ui/badge';
import {
  STAR_SIGN_BLUEPRINT,
  STAR_SIGN_META,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildStarSignSlugFromProfile } from '@/lib/profile-personalization';
import { getDailyFortune, toKstDateKey } from '@/lib/star-sign/daily-fortune';
import {
  ELEMENT_HEX,
  ELEMENT_LABEL,
  QUALITY_LABEL,
  STAR_SIGN_CONTENT,
  type SignElement,
  type SignQuality,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '별자리',
  description:
    '오늘 12 별자리 운세를 한눈에 비교하고 내 별자리를 골라 상세 흐름을 보세요. 원소별 분류와 12궁 호환까지 한 페이지에.',
  alternates: {
    canonical: '/star-sign',
  },
};

const ELEMENT_ORDER: SignElement[] = ['fire', 'earth', 'air', 'water'];
const QUALITY_ORDER: SignQuality[] = ['cardinal', 'fixed', 'mutable'];

const MOOD_EMOJI: Record<string, string> = {
  warm: '🌤',
  calm: '🌿',
  dynamic: '🔥',
  sensitive: '💧',
};

export default async function StarSignPage() {
  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildStarSignSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const dateKey = toKstDateKey();

  // 12 sign 의 오늘 운세 일괄 계산.
  const dailyAll = STAR_SIGN_FORTUNES.map((item) => {
    const slug = item.slug as StarSignSlug;
    const fortune = getDailyFortune(slug, dateKey);
    const content = STAR_SIGN_CONTENT[slug];
    const meta = STAR_SIGN_META[slug];
    return { slug, item, fortune, content, meta };
  });

  // 오늘 가장 운 좋은 top 3 + 살짝 주의 1개.
  const sortedByOverall = [...dailyAll].sort(
    (a, b) => b.fortune.scores.overall - a.fortune.scores.overall
  );
  const topThree = sortedByOverall.slice(0, 3);
  const cautionOne = sortedByOverall[sortedByOverall.length - 1]!;

  // 개인 별자리 우선 표시.
  const featuredSlug = (personalizedSlug ?? STAR_SIGN_BLUEPRINT.featuredSlug) as StarSignSlug;
  const featured = dailyAll.find((d) => d.slug === featuredSlug) ?? dailyAll[0]!;
  const hasPersonalizedProfile = Boolean(profile && personalizedSlug);

  // element / quality 분류.
  const byElement = ELEMENT_ORDER.map((el) => ({
    element: el,
    members: dailyAll.filter((d) => d.content.element === el),
  }));

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <PageHero
          badges={[
            <Badge
              key="star-sign"
              className="border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky)]"
            >
              별자리
            </Badge>,
            <Badge
              key="today"
              className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]"
            >
              {dateKey} 기준
            </Badge>,
          ]}
          title={hasPersonalizedProfile ? `선생님은 ${featured.item.label}` : '오늘 12 별자리 운세'}
          description="원소·점수·하이라이트를 한눈에 비교하고 내 별자리 상세 흐름을 확인하세요."
        />

        {/* §1 개인 추천 또는 featured */}
        <section className="px-1">
          <article
            className="relative overflow-hidden rounded-[22px] p-5 text-white"
            style={{
              background: 'linear-gradient(160deg, #1a0a2e 0%, #2e1156 50%, #45178a 100%)',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 18% 28%, #fff 1px, transparent 1.5px),
                  radial-gradient(circle at 72% 18%, #fff 0.5px, transparent 1px),
                  radial-gradient(circle at 88% 62%, #fff 1px, transparent 1.5px),
                  radial-gradient(circle at 35% 70%, #fff 0.5px, transparent 1px),
                  radial-gradient(circle at 60% 84%, #fff 0.5px, transparent 1px),
                  radial-gradient(circle at 10% 88%, #fff 1px, transparent 1.5px)
                `,
              }}
            />
            <div className="relative">
              <div
                className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]"
                style={{ opacity: 0.7 }}
              >
                {hasPersonalizedProfile ? 'MY 별자리' : '오늘의 추천'}
              </div>
              <div className="mt-2.5 flex items-end gap-3.5">
                <div
                  className="grid h-[68px] w-[68px] place-items-center rounded-full text-[32px] font-light"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                  }}
                  aria-hidden="true"
                >
                  {featured.meta.symbol}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[22px] font-extrabold tracking-tight">
                    {featured.item.label}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ opacity: 0.7 }}>
                    {featured.item.dateRange} · {featured.content.rulingPlanetKo}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase" style={{ opacity: 0.6 }}>
                    총운
                  </div>
                  <div className="text-[28px] font-extrabold tabular-nums leading-none">
                    {featured.fortune.scores.overall}
                  </div>
                </div>
              </div>
              <p
                className="mt-3 text-[12.5px] leading-[1.55]"
                style={{ opacity: 0.92, wordBreak: 'keep-all' }}
              >
                {featured.fortune.highlight}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/star-sign/${featured.slug}`}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  상세 흐름 보기 →
                </Link>
                <Link
                  href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                  className="inline-flex items-center justify-center rounded-full border border-white/24 px-4 py-2.5 text-[13px] font-bold text-white/85"
                >
                  {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'}
                </Link>
              </div>
            </div>
          </article>
        </section>

        {/* §2 오늘의 TOP 3 별자리 */}
        <section className="space-y-2 px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">오늘 운 좋은 TOP 3</h2>
          <p className="text-[11.5px] text-[var(--app-copy-soft)]">
            12 별자리 총운 점수 상위 — 매일 자정 기준으로 바뀝니다
          </p>
          <div className="mt-1 grid gap-2">
            {topThree.map((d, idx) => {
              const rankColor = idx === 0 ? 'var(--app-pink-strong)' : idx === 1 ? 'var(--app-amber)' : 'var(--app-jade)';
              return (
                <Link
                  key={d.slug}
                  href={`/star-sign/${d.slug}`}
                  className="rounded-[16px] border bg-white p-4 transition-transform active:scale-[0.98]"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[18px] font-extrabold text-white"
                      style={{ background: rankColor }}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className="text-[22px]"
                      style={{ color: ELEMENT_HEX[d.content.element] }}
                      aria-hidden="true"
                    >
                      {d.meta.symbol}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-extrabold text-[var(--app-ink)]">
                        {d.item.label}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[11.5px] text-[var(--app-copy-muted)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {d.fortune.highlight}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[20px] font-extrabold tabular-nums" style={{ color: rankColor }}>
                        {d.fortune.scores.overall}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* §3 살짝 주의 */}
        <section className="px-1">
          <article
            className="rounded-[16px] border p-4"
            style={{
              background: 'rgba(212,148,38,0.04)',
              borderColor: 'rgba(212,148,38,0.22)',
            }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber)]">
              ⚠ 오늘 살짝 주의
            </div>
            <Link href={`/star-sign/${cautionOne.slug}`} className="mt-2 flex items-center gap-3">
              <span
                className="text-[26px]"
                style={{ color: ELEMENT_HEX[cautionOne.content.element] }}
                aria-hidden="true"
              >
                {cautionOne.meta.symbol}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold text-[var(--app-ink)]">
                  {cautionOne.item.label}
                </div>
                <div
                  className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {cautionOne.fortune.caution}
                </div>
              </div>
              <div
                className="text-[20px] font-extrabold tabular-nums text-[var(--app-amber)]"
              >
                {cautionOne.fortune.scores.overall}
              </div>
            </Link>
          </article>
        </section>

        {/* §4 12 별자리 오늘 점수 grid */}
        <section className="px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">
            12 별자리 오늘 점수
          </h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
            내 별자리를 눌러 상세 흐름·럭키·호환 매트릭스를 확인하세요
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {dailyAll.map((d) => {
              const isActive = d.slug === featuredSlug;
              const elHex = ELEMENT_HEX[d.content.element];
              return (
                <Link
                  key={d.slug}
                  href={`/star-sign/${d.slug}`}
                  className="rounded-[14px] border bg-white p-2.5 text-center transition-transform active:scale-95"
                  style={{
                    borderColor: isActive ? 'var(--app-pink-strong)' : 'var(--app-line)',
                    borderWidth: isActive ? 1.5 : 1,
                    background: isActive ? 'var(--app-pink-soft)' : 'white',
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[18px]" style={{ color: elHex }} aria-hidden="true">
                      {d.meta.symbol}
                    </span>
                    <span className="text-[10px]" aria-hidden="true">
                      {MOOD_EMOJI[d.fortune.mood] ?? ''}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] font-extrabold text-[var(--app-ink)]">
                    {d.item.label.replace('자리', '')}
                  </div>
                  <div
                    className="mt-0.5 text-[15px] font-extrabold tabular-nums"
                    style={{
                      color: d.fortune.scores.overall >= 80
                        ? 'var(--app-jade)'
                        : d.fortune.scores.overall >= 65
                          ? 'var(--app-ink)'
                          : 'var(--app-amber)',
                    }}
                  >
                    {d.fortune.scores.overall}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* §5 원소별 분류 */}
        <section className="px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">원소별 별자리</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
            불·땅·공기·물 — 점성술의 4 원소가 성격의 베이스를 만듭니다
          </p>
          <div className="mt-3 grid gap-2">
            {byElement.map(({ element, members }) => {
              const elHex = ELEMENT_HEX[element];
              return (
                <article
                  key={element}
                  className="rounded-[14px] border bg-white p-3.5"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold text-white"
                      style={{ background: elHex }}
                      aria-hidden="true"
                    >
                      {ELEMENT_LABEL[element][0]}
                    </span>
                    <span className="text-[13px] font-extrabold text-[var(--app-ink)]">
                      {ELEMENT_LABEL[element]}자리
                    </span>
                    <span className="text-[10.5px] text-[var(--app-copy-soft)]">
                      ({members.length}개)
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {members.map((m) => (
                      <Link
                        key={m.slug}
                        href={`/star-sign/${m.slug}`}
                        className="rounded-[10px] border bg-white px-2 py-1.5 text-center"
                        style={{ borderColor: 'var(--app-line)' }}
                      >
                        <div className="text-[14px]" style={{ color: elHex }} aria-hidden="true">
                          {m.meta.symbol}
                        </div>
                        <div className="mt-0.5 text-[10.5px] font-bold text-[var(--app-ink)]">
                          {m.item.label.replace('자리', '')}
                        </div>
                        <div className="text-[10.5px] tabular-nums text-[var(--app-copy-soft)]">
                          {m.fortune.scores.overall}
                        </div>
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* §6 quality (3 modality) 한 줄 */}
        <section className="px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">3 모달리티</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
            시작·고정·변통 — 같은 원소 안에서도 행동 패턴이 갈립니다
          </p>
          <div className="mt-3 grid gap-2">
            {QUALITY_ORDER.map((q) => {
              const members = dailyAll.filter((d) => d.content.quality === q);
              return (
                <article
                  key={q}
                  className="rounded-[14px] border bg-white p-3.5"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-[var(--app-ink)]">
                      {QUALITY_LABEL[q]}
                    </span>
                    <span className="text-[10.5px] text-[var(--app-copy-soft)]">
                      ({members.length}개)
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {members.map((m) => (
                      <Link
                        key={m.slug}
                        href={`/star-sign/${m.slug}`}
                        className="rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-bold text-[var(--app-ink)]"
                        style={{ borderColor: 'var(--app-line)' }}
                      >
                        {m.meta.symbol} {m.item.label.replace('자리', '')}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* §7 사주 크로스 CTA */}
        <section className="px-1">
          <article
            className="rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              더 깊이
            </div>
            <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-tight">
              내 사주와 함께 봐주세요
            </h2>
            <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ opacity: 0.75 }}>
              {STAR_SIGN_BLUEPRINT.cross}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'} →
              </Link>
              <Link
                href="/star-sign/compat"
                className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
              >
                12×12 매트릭스
              </Link>
            </div>
          </article>
        </section>

        {/* §legacy: original 12 grid (keep for icon-style preview) */}
        <section className="gangi-card-panel p-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            12 별자리 아이콘 뷰
          </div>
          <div className="gangi-star-sign-grid mt-3">
            {STAR_SIGN_FORTUNES.map((item) => {
              const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];
              return (
                <Link
                  key={item.slug}
                  href={`/star-sign/${item.slug}`}
                  className="gangi-star-sign-card"
                  data-active={item.slug === featured.slug ? 'true' : undefined}
                >
                  <GangiStarSignIcon slug={item.slug} symbol={meta.symbol} size="sm" />
                  <strong>{item.label}</strong>
                  <em>{item.dateRange}</em>
                </Link>
              );
            })}
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}
