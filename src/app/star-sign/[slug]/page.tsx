// Redesign 2026-05-15 (확장):
// 별자리 상세 — 우주 그라데이션 hero + 6 영역 점수 + 풍부한 성격/연애/직업/럭키
// + 12×12 호환 매트릭스 + 신화. 콘텐츠 두께를 PR #127 에서 대폭 확장.
// /src/lib/star-sign/sign-content.ts + daily-fortune.ts 와 연동.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { FavoriteStarSignButton } from '@/components/star-sign/favorite-star-sign-button';
import { STAR_SIGN_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { listFavoriteStarSigns } from '@/lib/star-sign/favorites';
import { createClient } from '@/lib/supabase/server';
import {
  getDailyFortune,
  toKstDateKey,
} from '@/lib/star-sign/daily-fortune';
import {
  ELEMENT_HEX,
  ELEMENT_LABEL,
  QUALITY_LABEL,
  STAR_SIGN_CONTENT,
  getAllCompatibilities,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
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
    title: `${item.label} 운세`,
    description: `${item.label} 오늘의 운세 · 성격 · 연애 · 직업 · 12궁 호환 매트릭스를 한눈에 — 간지사주 별자리 상세.`,
    alternates: { canonical: `/star-sign/${item.slug}` },
  };
}

const TONE_STYLE: Record<
  'best' | 'good' | 'mid' | 'avoid',
  { bg: string; color: string; border: string; label: string }
> = {
  best: {
    bg: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
    color: '#fff',
    border: 'var(--app-pink-strong)',
    label: '최상',
  },
  good: {
    bg: 'var(--app-pink-soft)',
    color: 'var(--app-pink-strong)',
    border: 'var(--app-pink-line)',
    label: '좋음',
  },
  mid: {
    bg: 'rgba(0,0,0,0.04)',
    color: 'var(--app-copy-soft)',
    border: 'var(--app-line)',
    label: '보통',
  },
  avoid: {
    bg: 'rgba(220,79,79,0.05)',
    color: 'var(--app-coral)',
    border: 'rgba(220,79,79,0.22)',
    label: '주의',
  },
};

function ScoreBar({ label, value, hue }: { label: string; value: number; hue: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold text-[var(--app-copy-soft)]">{label}</span>
        <span
          className="text-[15px] font-extrabold tabular-nums"
          style={{ color: 'var(--app-ink)' }}
        >
          {value}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'rgba(0,0,0,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: hue }}
        />
      </div>
    </div>
  );
}

export default async function StarSignDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getStarSign(slug);
  if (!item) notFound();

  const typedSlug = item.slug as StarSignSlug;
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);

  // PR #138 — favorites 초기 상태 (server-side fetch, 비로그인은 anonymous mode).
  const supabaseForFavs = await createClient();
  const {
    data: { user: favUser },
  } = await supabaseForFavs.auth.getUser();
  const initialFavorites = favUser
    ? await listFavoriteStarSigns(supabaseForFavs, favUser.id)
    : [];
  const isFavorited = initialFavorites.includes(typedSlug);

  const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];
  const content = STAR_SIGN_CONTENT[typedSlug];
  const fortune = getDailyFortune(typedSlug, toKstDateKey());
  const allCompats = getAllCompatibilities(typedSlug);
  const elementHex = ELEMENT_HEX[content.element];
  const elementLabel = ELEMENT_LABEL[content.element];
  const qualityLabel = QUALITY_LABEL[content.quality];

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
                    지배별 · {content.rulingPlanetKo} ({content.rulingPlanet})
                  </div>
                </div>
              </div>
              <p
                className="mt-4 text-[13px] leading-[1.6]"
                style={{ opacity: 0.92 }}
              >
                {item.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                  style={{ background: elementHex, color: 'white' }}
                >
                  {elementLabel}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.22)',
                  }}
                >
                  {qualityLabel}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.22)',
                  }}
                >
                  {fortune.moodLabel}
                </span>
              </div>
            </div>
          </article>

          {/* §1.5 즐겨찾기 토글 (PR #138) */}
          <div className="flex justify-end px-1">
            <FavoriteStarSignButton
              slug={typedSlug}
              initialFavorited={isFavorited}
              isAnonymous={!favUser}
            />
          </div>

          {/* §2 오늘 종합 운세 — 6 영역 점수 */}
          <article
            className="rounded-[16px] border p-4"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                오늘 종합 운세
              </div>
              <div className="text-[10.5px] text-[var(--app-copy-soft)]">{fortune.dateKey}</div>
            </div>
            <h2 className="mt-1.5 text-[16px] font-extrabold leading-[1.45] tracking-tight text-[var(--app-ink)]">
              {fortune.highlight}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ScoreBar label="총운" value={fortune.scores.overall} hue="var(--app-pink-strong)" />
              <ScoreBar label="연애" value={fortune.scores.love} hue="var(--app-coral)" />
              <ScoreBar label="일" value={fortune.scores.work} hue="var(--app-jade)" />
              <ScoreBar label="건강" value={fortune.scores.health} hue="var(--app-amber)" />
              <ScoreBar label="재물" value={fortune.scores.money} hue="var(--app-pink)" />
              <ScoreBar label="학업" value={fortune.scores.study} hue="var(--app-sky)" />
            </div>
          </article>

          {/* §3 부스터 / 주의 */}
          <div className="grid gap-2.5">
            <article
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'rgba(45,135,88,0.22)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                ☘ 오늘의 부스터
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-[var(--app-ink)]">
                {fortune.boost}
              </p>
            </article>
            <article
              className="rounded-[14px] border bg-white p-4"
              style={{ borderColor: 'rgba(212,148,38,0.32)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber)]">
                ⚠ 살짝 주의
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-[var(--app-ink)]">
                {fortune.caution}
              </p>
            </article>
          </div>

          {/* §4 오늘의 럭키 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              🍀 오늘의 럭키
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">컬러</div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-full border"
                    style={{
                      background: fortune.luckyOfDay.color.hex,
                      borderColor: 'var(--app-line)',
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-[13px] font-extrabold text-[var(--app-ink)]">
                    {fortune.luckyOfDay.color.name}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">숫자</div>
                <div className="mt-1 text-[18px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {fortune.luckyOfDay.number}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">방위</div>
                <div className="mt-1 text-[13px] font-extrabold text-[var(--app-ink)]">
                  {fortune.luckyOfDay.direction}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">시간대</div>
                <div className="mt-1 text-[13px] font-extrabold text-[var(--app-ink)]">
                  {fortune.luckyOfDay.time}
                </div>
              </div>
            </div>
          </article>

          {/* §5 성격 — 강점 vs 약점 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              🎭 성격
            </div>
            <div className="mt-1.5 text-[12px] italic text-[var(--app-copy-muted)]">
              &ldquo;{content.motto}&rdquo;
            </div>
            <div className="mt-3 grid gap-2.5">
              <div
                className="rounded-[12px] border p-3"
                style={{
                  background: 'rgba(45,135,88,0.06)',
                  borderColor: 'rgba(45,135,88,0.2)',
                }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                  강점
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {content.strengths.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-jade)] border"
                      style={{ borderColor: 'rgba(45,135,88,0.22)' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div
                className="rounded-[12px] border p-3"
                style={{
                  background: 'rgba(220,79,79,0.04)',
                  borderColor: 'rgba(220,79,79,0.2)',
                }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
                  약점
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {content.weaknesses.map((w) => (
                    <span
                      key={w}
                      className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-coral)] border"
                      style={{ borderColor: 'rgba(220,79,79,0.22)' }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          {/* §6 연애 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              💘 연애
            </div>
            <p
              className="mt-1.5 text-[13px] leading-[1.55] text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <strong className="text-[var(--app-pink-strong)]">매력 · </strong>
              {content.loveCharm}
            </p>
            <p
              className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <strong className="text-[var(--app-coral)]">유의 · </strong>
              {content.loveCaveat}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10.5px] font-bold text-[var(--app-jade)]">잘 맞는 별자리</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {content.idealMatches.map((m) => {
                    const ms = STAR_SIGN_META[m];
                    return (
                      <Link
                        key={m}
                        href={`/star-sign/${m}`}
                        className="rounded-full bg-[var(--app-pink-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--app-pink-strong)] border"
                        style={{ borderColor: 'var(--app-pink-line)' }}
                      >
                        {ms?.symbol ?? ''} {STAR_SIGN_FORTUNES.find((s) => s.slug === m)?.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold text-[var(--app-coral)]">신중한 별자리</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {content.loveBeware.map((m) => {
                    const ms = STAR_SIGN_META[m];
                    return (
                      <Link
                        key={m}
                        href={`/star-sign/${m}`}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[var(--app-copy-soft)] border"
                        style={{ borderColor: 'rgba(220,79,79,0.22)' }}
                      >
                        {ms?.symbol ?? ''} {STAR_SIGN_FORTUNES.find((s) => s.slug === m)?.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </article>

          {/* §7 직업·재능 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
              💼 직업·재능
            </div>
            <p
              className="mt-1.5 text-[13px] leading-[1.55] text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {content.careerStrength}
            </p>
            <div className="mt-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              추천 분야
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {content.careerSuggestions.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-ink)] border"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  {c}
                </span>
              ))}
            </div>
            <p
              className="mt-2.5 text-[11.5px] leading-[1.5] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              <strong className="text-[var(--app-amber)]">주의 · </strong>
              {content.careerCaveat}
            </p>
          </article>

          {/* §8 12궁 호환 매트릭스 */}
          <section>
            <h2 className="text-[14px] font-extrabold text-[var(--app-ink)]">
              12궁 호환 매트릭스
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
              element + 각도(120°/60°/90°/180°/150°) 조합으로 산출
            </p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {allCompats.map((c) => {
                const targetItem = STAR_SIGN_FORTUNES.find((s) => s.slug === c.slug);
                const targetMeta = STAR_SIGN_META[c.slug as keyof typeof STAR_SIGN_META];
                const isSelf = c.slug === typedSlug;
                const style = TONE_STYLE[c.tone];
                return (
                  <Link
                    key={c.slug}
                    href={isSelf ? `/star-sign/${c.slug}` : `/star-sign/compat/${typedSlug}/${c.slug}`}
                    className="rounded-[12px] border p-2.5 text-center transition-transform active:scale-95"
                    style={{
                      background: c.tone === 'best' ? style.bg : 'white',
                      borderColor: isSelf ? 'var(--app-pink-strong)' : style.border,
                      borderWidth: isSelf ? 2 : 1,
                    }}
                  >
                    <div
                      className="mx-auto grid h-9 w-9 place-items-center rounded-full text-[18px]"
                      style={{
                        background:
                          c.tone === 'best'
                            ? 'rgba(255,255,255,0.22)'
                            : c.tone === 'good'
                              ? style.bg
                              : 'rgba(0,0,0,0.04)',
                        color: c.tone === 'best' ? '#fff' : style.color,
                      }}
                      aria-hidden="true"
                    >
                      {targetMeta?.symbol ?? ''}
                    </div>
                    <div
                      className="mt-1 text-[10.5px] font-bold"
                      style={{ color: c.tone === 'best' ? '#fff' : 'var(--app-ink)' }}
                    >
                      {targetItem?.label.replace('자리', '') ?? c.slug}
                    </div>
                    <div
                      className="mt-0.5 text-[13px] font-extrabold tabular-nums"
                      style={{ color: c.tone === 'best' ? '#fff' : style.color }}
                    >
                      {c.score}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* §9 라이프스타일 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              ✨ 라이프스타일
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">주된 럭키 컬러</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="h-4 w-4 rounded-full border"
                    style={{
                      background: content.luckyColor.hex,
                      borderColor: 'var(--app-line)',
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-[12.5px] font-bold text-[var(--app-ink)]">
                    {content.luckyColor.name}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">럭키 숫자</div>
                <div className="mt-0.5 text-[12.5px] font-bold text-[var(--app-ink)]">
                  {content.luckyNumbers.join(' · ')}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">럭키 요일</div>
                <div className="mt-0.5 text-[12.5px] font-bold text-[var(--app-ink)]">
                  {content.luckyDay}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">탄생석</div>
                <div className="mt-0.5 text-[12.5px] font-bold text-[var(--app-ink)]">
                  {content.birthstone}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">방향</div>
                <div className="mt-0.5 text-[12.5px] font-bold text-[var(--app-ink)]">
                  {content.luckyDirection}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[var(--app-copy-soft)]">신체 강·약</div>
                <div className="mt-0.5 text-[11.5px] leading-[1.4] text-[var(--app-ink)]">
                  <strong className="text-[var(--app-jade)]">강 · </strong>
                  {content.bodyStrong}
                  <br />
                  <strong className="text-[var(--app-coral)]">약 · </strong>
                  {content.bodyWeak}
                </div>
              </div>
            </div>
          </article>

          {/* §10 신화 */}
          <article
            className="rounded-[16px] border p-4"
            style={{
              background: 'linear-gradient(135deg, #1a0a2e 0%, #2e1156 100%)',
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'white',
            }}
          >
            <div
              className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
              style={{ opacity: 0.6 }}
            >
              📜 신화
            </div>
            <p
              className="mt-1.5 text-[13px] leading-[1.55]"
              style={{ opacity: 0.92, wordBreak: 'keep-all' }}
            >
              {content.mythology}
            </p>
          </article>

          {/* §11 사주 크로스 CTA */}
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
                href={`/star-sign/${item.slug}/cross`}
                className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                별자리 × 사주 크로스 보기 →
              </Link>
              <Link
                href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
              >
                {readingSlug ? '내 사주 풀이' : '사주 입력'}
              </Link>
            </div>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
