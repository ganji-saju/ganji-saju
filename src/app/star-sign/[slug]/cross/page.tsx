// Redesign 2026-05-15 — 별자리 × 사주 크로스 페이지.
// /star-sign/[slug]/cross — 사용자 프로필이 있으면 일간 계산해 합성 인사이트 표시.
// 없으면 sign element ↔ 동양 오행 매핑 hint 만 노출 + 사주 입력 CTA.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { STAR_SIGN_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { hasCoreBirthProfile, toBirthInputFromProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { cachedCalculateSaju } from '@/lib/saju/calc-cache';
import {
  STAR_SIGN_CONTENT,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';
import {
  summarizeCrossOverview,
  synthesizeCross,
  type CrossSynthesis,
} from '@/lib/star-sign/cross-saju';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

function getStarSign(slug: string) {
  return STAR_SIGN_FORTUNES.find((item) => item.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getStarSign(slug);
  if (!item) return { title: '별자리 × 사주' };
  return {
    title: `${item.label} × 사주`,
    description: `${item.label} 의 서양 별자리 element 와 동양 일간 (10 천간) 결합 분석 — 두 시스템이 만드는 내 성격의 양면.`,
    alternates: { canonical: `/star-sign/${item.slug}/cross` },
  };
}

const TONE_STYLE: Record<
  'best' | 'good' | 'mid' | 'caution',
  { bg: string; color: string; border: string }
> = {
  best: {
    bg: 'rgba(45,135,88,0.08)',
    color: 'var(--app-jade)',
    border: 'rgba(45,135,88,0.3)',
  },
  good: {
    bg: 'var(--app-pink-soft)',
    color: 'var(--app-pink-strong)',
    border: 'var(--app-pink-line)',
  },
  mid: {
    bg: 'rgba(0,0,0,0.04)',
    color: 'var(--app-copy-soft)',
    border: 'var(--app-line)',
  },
  caution: {
    bg: 'rgba(212,148,38,0.06)',
    color: 'var(--app-amber)',
    border: 'rgba(212,148,38,0.32)',
  },
};

export default async function StarSignCrossPage({ params }: Props) {
  const { slug } = await params;
  const item = getStarSign(slug);
  if (!item) notFound();

  const typedSlug = item.slug as StarSignSlug;
  const content = STAR_SIGN_CONTENT[typedSlug];
  const meta = STAR_SIGN_META[item.slug as keyof typeof STAR_SIGN_META];
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);

  // 프로필 있으면 일간 계산.
  let cross: CrossSynthesis | null = null;
  if (profile && hasCoreBirthProfile(profile)) {
    try {
      const birthInput = toBirthInputFromProfile({
        ...profile,
        birthYear: profile.birthYear!,
        birthMonth: profile.birthMonth!,
        birthDay: profile.birthDay!,
      });
      const sajuResult = cachedCalculateSaju(birthInput);
      cross = synthesizeCross(typedSlug, sajuResult.dayMaster);
    } catch {
      cross = null;
    }
  }

  const overview = summarizeCrossOverview(typedSlug);
  const toneStyle = cross ? TONE_STYLE[cross.relationTone] : null;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader
          title={`${item.label} × 사주`}
          backHref={`/star-sign/${item.slug}`}
        />

        <section className="space-y-5 px-1">
          {/* §1 hero — 두 시스템 결합 */}
          <article
            className="relative overflow-hidden rounded-[22px] p-5 text-white"
            style={{
              background:
                'linear-gradient(135deg, #1a0a2e 0%, #45178a 50%, #ec4899 100%)',
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
                  radial-gradient(circle at 35% 70%, #fff 0.5px, transparent 1px)
                `,
              }}
            />
            <div className="relative">
              <div
                className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]"
                style={{ opacity: 0.7 }}
              >
                별자리 × 사주
              </div>
              <h1 className="mt-2 text-[22px] font-extrabold leading-snug tracking-tight">
                서양의 별빛 + 동양의 명식
              </h1>
              <p className="mt-2 text-[12.5px] leading-[1.6]" style={{ opacity: 0.9 }}>
                서양 별자리는 외향적 성향을, 동양 일간은 내면의 핵심 기질을 보여줍니다.
                두 시스템을 함께 읽으면 한쪽만으로는 보이지 않는 입체감이 드러납니다.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div
                  className="rounded-[14px] p-3"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  <div className="text-[10px] uppercase font-bold" style={{ opacity: 0.6 }}>
                    서양 별자리
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[20px]">{meta.symbol}</span>
                    <span className="text-[14px] font-extrabold">{item.label}</span>
                  </div>
                  <div className="mt-1 text-[10.5px]" style={{ opacity: 0.75 }}>
                    {overview.signElementLabel} · {content.rulingPlanetKo}
                  </div>
                </div>
                <div
                  className="rounded-[14px] p-3"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  <div className="text-[10px] uppercase font-bold" style={{ opacity: 0.6 }}>
                    동양 일간
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[18px] font-extrabold">
                      {cross ? cross.dayMaster : '—'}
                    </span>
                    <span className="text-[11.5px] font-bold" style={{ opacity: 0.85 }}>
                      {cross ? cross.dayMasterLabel : '미확인'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px]" style={{ opacity: 0.75 }}>
                    {cross ? `${cross.dayMasterElementLabel} · ${cross.yinYang}` : '프로필 등록 필요'}
                  </div>
                </div>
              </div>
            </div>
          </article>

          {cross && toneStyle ? (
            <>
              {/* §2 관계 라벨 */}
              <article
                className="rounded-[16px] border p-4"
                style={{ background: toneStyle.bg, borderColor: toneStyle.border }}
              >
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
                  style={{ color: toneStyle.color }}
                >
                  두 시스템의 관계
                </div>
                <div
                  className="mt-1.5 text-[18px] font-extrabold leading-snug"
                  style={{ color: 'var(--app-ink)' }}
                >
                  {cross.relationLabel}
                </div>
                <p
                  className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  서양 {overview.signElementLabel} → 동양 {cross.dayMasterElementLabel.split(' ')[0]}{' '}
                  관계 · {cross.synergyLine}
                </p>
              </article>

              {/* §3 통합 인사이트 */}
              <article
                className="rounded-[16px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  🔮 통합 인사이트
                </div>
                <h2
                  className="mt-1.5 text-[16px] font-extrabold leading-[1.45] tracking-tight text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {cross.integratedInsight}
                </h2>
                <div className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                  결합 키워드
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {cross.combinedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full border bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-pink-strong)]"
                      style={{ borderColor: 'var(--app-pink-line)' }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </article>

              {/* §4 시너지 vs 충돌 */}
              <div className="grid gap-2.5">
                <article
                  className="rounded-[14px] border bg-white p-4"
                  style={{ borderColor: 'rgba(45,135,88,0.22)' }}
                >
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                    ☘ 시너지
                  </div>
                  <p
                    className="mt-1 text-[13px] leading-[1.55] text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {cross.synergyLine}
                  </p>
                </article>
                <article
                  className="rounded-[14px] border bg-white p-4"
                  style={{ borderColor: 'rgba(220,79,79,0.22)' }}
                >
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
                    ⚡ 갈등 가능성
                  </div>
                  <p
                    className="mt-1 text-[13px] leading-[1.55] text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {cross.tensionLine}
                  </p>
                </article>
              </div>

              {/* §5 행동 제안 3개 */}
              <article
                className="rounded-[16px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  ✨ 두 기운을 함께 살리는 법
                </div>
                <div className="mt-2 grid gap-2">
                  {cross.actionSuggestions.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 rounded-[12px] p-2.5"
                      style={{ background: 'rgba(0,0,0,0.025)' }}
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                        style={{ background: 'var(--app-pink-strong)' }}
                      >
                        {idx + 1}
                      </span>
                      <p
                        className="text-[12.5px] leading-[1.5] text-[var(--app-ink)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {act}
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              {/* §6 사주 풀이 CTA */}
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
                  내 사주 전체 풀이로 이어보기
                </h2>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ opacity: 0.75 }}>
                  일간 한 글자만으로는 닿지 않는 음양/오행 균형과 십성 흐름을 함께 보면, 두 시스템의
                  결합이 더 또렷해집니다.
                </p>
                <Link
                  href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  내 사주 풀이로 이어보기 →
                </Link>
              </article>
            </>
          ) : (
            <>
              {/* §No-profile fallback */}
              <article
                className="rounded-[16px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  🔮 일반 매핑
                </div>
                <p
                  className="mt-2 text-[13px] leading-[1.6] text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {overview.hint}
                </p>
                <p
                  className="mt-2 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  내 일간이 무엇이냐에 따라 같은 별자리도 다섯 가지 성향으로 나뉩니다 (목/화/토/금/수).
                  사주 정보를 입력하시면 정확한 합성 인사이트를 받아보실 수 있어요.
                </p>
              </article>

              {/* §Strengths preview from sign only */}
              <article
                className="rounded-[16px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  서양 별자리만으로 본 강점
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {content.strengths.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-jade)]"
                      style={{ borderColor: 'rgba(45,135,88,0.22)' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </article>

              {/* §CTA: 사주 입력 */}
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
                  지금 시작
                </div>
                <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-tight">
                  내 일간을 알고 싶다면
                </h2>
                <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ opacity: 0.75 }}>
                  생년월일·태어난 시간을 입력하면 동양 명식의 핵심인 일간을 자동으로 산출합니다.
                </p>
                <Link
                  href="/saju/new"
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  사주 정보 입력하기 →
                </Link>
              </article>
            </>
          )}

          {/* §Back to detail */}
          <Link
            href={`/star-sign/${item.slug}`}
            className="block rounded-full border bg-white px-4 py-2.5 text-center text-[13px] font-bold text-[var(--app-copy-muted)]"
            style={{ borderColor: 'var(--app-line)' }}
          >
            ← {item.label} 별자리로 돌아가기
          </Link>
        </section>
      </AppPage>
    </AppShell>
  );
}
