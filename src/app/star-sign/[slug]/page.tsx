// Redesign 2026-05-13 (Claude Design / screens-g.jsx ScreenStarSign):
// 별자리 상세 — 우주 그라데이션 hero + 별 배경 + 12 별자리 grid + 분야별 한 줄.
// 데이터(STAR_SIGN_FORTUNES / STAR_SIGN_META)·라우팅 무수정.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { STAR_SIGN_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

const RULING_PLANET: Record<string, string> = {
  aries: '화성 (Mars)',
  taurus: '금성 (Venus)',
  gemini: '수성 (Mercury)',
  cancer: '달 (Moon)',
  leo: '태양 (Sun)',
  virgo: '수성 (Mercury)',
  libra: '금성 (Venus)',
  scorpio: '명왕성 (Pluto)',
  sagittarius: '목성 (Jupiter)',
  capricorn: '토성 (Saturn)',
  aquarius: '천왕성 (Uranus)',
  pisces: '해왕성 (Neptune)',
};

// 12 별자리 기본 호환표 — 풍자별로 가장 잘 맞는 2개 + 보통 1개
const COMPATIBILITY: Record<string, Array<{ slug: string; label: string; symbol: string; score: number; tone: 'best' | 'good' | 'mid' }>> = {
  aries: [
    { slug: 'leo', label: '사자', symbol: '♌', score: 92, tone: 'best' },
    { slug: 'sagittarius', label: '궁수', symbol: '♐', score: 88, tone: 'good' },
    { slug: 'libra', label: '천칭', symbol: '♎', score: 68, tone: 'mid' },
  ],
  taurus: [
    { slug: 'virgo', label: '처녀', symbol: '♍', score: 91, tone: 'best' },
    { slug: 'capricorn', label: '염소', symbol: '♑', score: 87, tone: 'good' },
    { slug: 'scorpio', label: '전갈', symbol: '♏', score: 66, tone: 'mid' },
  ],
  gemini: [
    { slug: 'libra', label: '천칭', symbol: '♎', score: 93, tone: 'best' },
    { slug: 'aquarius', label: '물병', symbol: '♒', score: 89, tone: 'good' },
    { slug: 'sagittarius', label: '궁수', symbol: '♐', score: 67, tone: 'mid' },
  ],
  cancer: [
    { slug: 'scorpio', label: '전갈', symbol: '♏', score: 90, tone: 'best' },
    { slug: 'pisces', label: '물고기', symbol: '♓', score: 88, tone: 'good' },
    { slug: 'capricorn', label: '염소', symbol: '♑', score: 65, tone: 'mid' },
  ],
  leo: [
    { slug: 'aries', label: '양', symbol: '♈', score: 92, tone: 'best' },
    { slug: 'sagittarius', label: '궁수', symbol: '♐', score: 87, tone: 'good' },
    { slug: 'aquarius', label: '물병', symbol: '♒', score: 64, tone: 'mid' },
  ],
  virgo: [
    { slug: 'taurus', label: '황소', symbol: '♉', score: 91, tone: 'best' },
    { slug: 'capricorn', label: '염소', symbol: '♑', score: 86, tone: 'good' },
    { slug: 'pisces', label: '물고기', symbol: '♓', score: 65, tone: 'mid' },
  ],
  libra: [
    { slug: 'gemini', label: '쌍둥이', symbol: '♊', score: 94, tone: 'best' },
    { slug: 'aquarius', label: '물병', symbol: '♒', score: 88, tone: 'good' },
    { slug: 'aries', label: '양', symbol: '♈', score: 64, tone: 'mid' },
  ],
  scorpio: [
    { slug: 'cancer', label: '게', symbol: '♋', score: 90, tone: 'best' },
    { slug: 'pisces', label: '물고기', symbol: '♓', score: 87, tone: 'good' },
    { slug: 'taurus', label: '황소', symbol: '♉', score: 66, tone: 'mid' },
  ],
  sagittarius: [
    { slug: 'aries', label: '양', symbol: '♈', score: 88, tone: 'best' },
    { slug: 'leo', label: '사자', symbol: '♌', score: 87, tone: 'good' },
    { slug: 'gemini', label: '쌍둥이', symbol: '♊', score: 67, tone: 'mid' },
  ],
  capricorn: [
    { slug: 'taurus', label: '황소', symbol: '♉', score: 87, tone: 'best' },
    { slug: 'virgo', label: '처녀', symbol: '♍', score: 86, tone: 'good' },
    { slug: 'cancer', label: '게', symbol: '♋', score: 65, tone: 'mid' },
  ],
  aquarius: [
    { slug: 'gemini', label: '쌍둥이', symbol: '♊', score: 89, tone: 'best' },
    { slug: 'libra', label: '천칭', symbol: '♎', score: 88, tone: 'good' },
    { slug: 'leo', label: '사자', symbol: '♌', score: 64, tone: 'mid' },
  ],
  pisces: [
    { slug: 'cancer', label: '게', symbol: '♋', score: 88, tone: 'best' },
    { slug: 'scorpio', label: '전갈', symbol: '♏', score: 87, tone: 'good' },
    { slug: 'virgo', label: '처녀', symbol: '♍', score: 65, tone: 'mid' },
  ],
};

function getDailyScores(slug: string) {
  const seed = slug.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const day = new Date().getDate();
  return {
    overall: 60 + ((seed * 7 + day * 3) % 35),
    love: 60 + ((seed * 11 + day * 5) % 35),
    work: 60 + ((seed * 13 + day * 7) % 35),
    health: 60 + ((seed * 17 + day) % 35),
  };
}

function getStarSign(slug: string) {
  return STAR_SIGN_FORTUNES.find((item) => item.slug === slug);
}

export async function generateStaticParams() {
  return STAR_SIGN_FORTUNES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getStarSign(slug);
  if (!item) return { title: '별자리' };
  return {
    title: `${item.label} 별자리`,
    description: `${item.label}의 오늘 흐름과 사주 크로스 관점을 함께 보는 달빛인생의 별자리 상세 화면입니다.`,
    alternates: { canonical: `/star-sign/${item.slug}` },
  };
}

export default async function StarSignDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getStarSign(slug);
  if (!item) notFound();

  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);
  const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];
  const allSigns = STAR_SIGN_FORTUNES;
  const compatibility = COMPATIBILITY[item.slug] ?? COMPATIBILITY.libra;
  const scores = getDailyScores(item.slug);
  const rulingPlanet = RULING_PLANET[item.slug] ?? '금성 (Venus)';

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title={`${item.label} 별자리`} backHref="/star-sign" />

        <section className="space-y-5 px-1">
          {/* §1 우주 그라데이션 hero */}
          <article
            className="relative overflow-hidden rounded-[22px] p-5 text-white"
            style={{
              background:
                'linear-gradient(160deg, #1a0a2e 0%, #2e1156 50%, #45178a 100%)',
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
                {item.slug.toUpperCase()} · {item.dateRange}
              </div>
              <div className="mt-2.5 flex items-end gap-3.5">
                <div
                  className="grid h-[80px] w-[80px] place-items-center rounded-full text-[38px] font-light"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                  }}
                  aria-hidden="true"
                >
                  {meta.symbol}
                </div>
                <div>
                  <div className="text-[24px] font-extrabold tracking-tight">{item.label}</div>
                  <div className="mt-0.5 text-[11.5px]" style={{ opacity: 0.7 }}>
                    지배별 · {rulingPlanet}
                  </div>
                </div>
              </div>
              <p
                className="mt-4 text-[13px] leading-[1.6]"
                style={{ opacity: 0.92 }}
              >
                {item.summary}
              </p>
            </div>
          </article>

          {/* §2 오늘의 별자리 (pink-soft) */}
          <article
            className="rounded-[14px] border p-4"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              오늘의 별자리
            </div>
            <h2 className="mt-1.5 text-[15.5px] font-extrabold leading-[1.45] tracking-tight text-[var(--app-ink)]">
              {item.todayFocus}
            </h2>
            <div className="mt-3.5 grid grid-cols-4 gap-2">
              {[
                ['총운', scores.overall],
                ['연애', scores.love],
                ['일', scores.work],
                ['건강', scores.health],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <div className="text-[10.5px] font-bold text-[var(--app-copy-soft)]">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[20px] font-extrabold text-[var(--app-pink-strong)]">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* §3 오늘 잘 맞는 별자리 */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">
              오늘 잘 맞는 별자리
            </h2>
            <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="grid grid-cols-3 gap-3">
                {compatibility.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/star-sign/${c.slug}`}
                    className="text-center"
                  >
                    <div
                      className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[24px]"
                      style={
                        c.tone === 'best'
                          ? {
                              background:
                                'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                              color: '#fff',
                            }
                          : c.tone === 'good'
                            ? {
                                background: 'var(--app-pink-soft)',
                                color: 'var(--app-pink-strong)',
                              }
                            : {
                                background: 'rgba(0,0,0,0.04)',
                                color: 'var(--app-copy-soft)',
                              }
                      }
                      aria-hidden="true"
                    >
                      {c.symbol}
                    </div>
                    <div className="mt-1.5 text-[12px] font-extrabold text-[var(--app-ink)]">
                      {c.label}자리
                    </div>
                    <div className="mt-0.5 text-[14px] font-extrabold text-[var(--app-pink-strong)]">
                      {c.score}
                    </div>
                  </Link>
                ))}
              </div>
            </article>
          </section>

          {/* §4 행동 제안 */}
          <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              행동 제안
            </div>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--app-ink)]">
              {item.action}
            </p>
          </article>

          {/* §5 12 별자리 모두 보기 */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">
              12 별자리 모두 보기
            </h2>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {allSigns.map((entry) => {
                const relatedMeta = STAR_SIGN_META[entry.slug as keyof typeof STAR_SIGN_META];
                const active = entry.slug === item.slug;
                return (
                  <Link
                    key={entry.slug}
                    href={`/star-sign/${entry.slug}`}
                    className="block rounded-[12px] py-2.5 text-center"
                    style={
                      active
                        ? {
                            background: 'var(--app-pink-soft)',
                            border: '1.5px solid var(--app-pink)',
                          }
                        : {
                            background: 'rgba(0,0,0,0.025)',
                            border: '1px solid var(--app-line)',
                          }
                    }
                  >
                    <div
                      className="text-[22px]"
                      style={{
                        color: active ? 'var(--app-pink-strong)' : 'var(--app-copy-muted)',
                      }}
                      aria-hidden="true"
                    >
                      {relatedMeta.symbol}
                    </div>
                    <div
                      className="mt-1 text-[11px] font-bold"
                      style={{
                        color: active ? 'var(--app-pink-strong)' : 'var(--app-ink)',
                      }}
                    >
                      {entry.label.replace('자리', '')}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* §6 분야별 한 줄 */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">분야별 한 줄</h2>
            <div className="mt-3 grid gap-2.5">
              {[
                { label: '연애', text: item.summary, color: 'var(--app-coral)' },
                { label: '일', text: item.todayFocus, color: 'var(--app-jade)' },
                { label: '관계', text: item.action, color: 'var(--app-sky)' },
              ].map((row) => (
                <article
                  key={row.label}
                  className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[13px] font-extrabold text-white"
                    style={{ background: row.color }}
                    aria-hidden="true"
                  >
                    {row.label[0]}
                  </span>
                  <div className="min-w-0 flex-1 text-[13px] leading-[1.5] text-[var(--app-ink)]">
                    <strong style={{ color: row.color }}>{row.label}</strong> · {row.text}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* §7 사주로 이어보기 CTA */}
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
              서양의 별빛과 동양의 명식을 나란히 놓고 오늘 마음에 더 가까운 결을 함께 읽어드립니다.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                {readingSlug ? '내 사주와 함께 보기' : '사주와 함께 보기'} →
              </Link>
              <Link
                href="/star-sign"
                className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
              >
                별자리 목록으로
              </Link>
            </div>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
