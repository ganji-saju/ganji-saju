// Redesign 2026-05-15 — 별자리 두 개 궁합 상세.
// /star-sign/compat/[a]/[b] — 6 영역 점수 + 강점/긴장 + 데이트/갈등 팁.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { STAR_SIGN_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { analyzeCompatibility } from '@/lib/star-sign/compatibility';
import {
  ELEMENT_HEX,
  STAR_SIGN_CONTENT,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ a: string; b: string }>;
}

function isValidSlug(slug: string): slug is StarSignSlug {
  return STAR_SIGN_FORTUNES.some((s) => s.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { a, b } = await params;
  if (!isValidSlug(a) || !isValidSlug(b)) return { title: '별자리 궁합' };
  const aItem = STAR_SIGN_FORTUNES.find((s) => s.slug === a)!;
  const bItem = STAR_SIGN_FORTUNES.find((s) => s.slug === b)!;
  return {
    title: `${aItem.label} × ${bItem.label} 궁합`,
    description: `${aItem.label}와 ${bItem.label}의 종합 궁합 점수 · 연애·우정·결혼·소통·여행 6 영역 · 데이트 추천과 갈등 극복 팁까지.`,
    alternates: { canonical: `/star-sign/compat/${a}/${b}` },
  };
}

const TONE_STYLE: Record<
  'best' | 'good' | 'mid' | 'avoid',
  { bg: string; color: string; border: string; gradient: string }
> = {
  best: {
    bg: 'rgba(45,135,88,0.08)',
    color: 'var(--app-jade)',
    border: 'rgba(45,135,88,0.3)',
    gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  },
  good: {
    bg: 'var(--app-pink-soft)',
    color: 'var(--app-pink-strong)',
    border: 'var(--app-pink-line)',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
  },
  mid: {
    bg: 'rgba(0,0,0,0.04)',
    color: 'var(--app-copy-soft)',
    border: 'var(--app-line)',
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
  },
  avoid: {
    bg: 'rgba(212,148,38,0.06)',
    color: 'var(--app-amber)',
    border: 'rgba(212,148,38,0.32)',
    gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
  },
};

function ScoreBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const hue =
    value >= 85 ? 'var(--app-jade)' : value >= 70 ? 'var(--app-pink)' : value >= 55 ? 'var(--app-amber)' : 'var(--app-coral)';
  return (
    <div
      className="rounded-[12px] border bg-white p-3"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-extrabold text-[var(--app-ink)]">{label}</span>
        <span
          className="text-[16px] font-extrabold tabular-nums"
          style={{ color: hue }}
        >
          {value}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'rgba(0,0,0,0.06)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: hue }}
        />
      </div>
      <p
        className="mt-1.5 text-[10.5px] leading-[1.4] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {hint}
      </p>
    </div>
  );
}

export default async function StarSignCompatPage({ params }: Props) {
  const { a, b } = await params;
  if (!isValidSlug(a) || !isValidSlug(b)) notFound();

  const aItem = STAR_SIGN_FORTUNES.find((s) => s.slug === a)!;
  const bItem = STAR_SIGN_FORTUNES.find((s) => s.slug === b)!;
  const aMeta = STAR_SIGN_META[a as keyof typeof STAR_SIGN_META];
  const bMeta = STAR_SIGN_META[b as keyof typeof STAR_SIGN_META];
  const aContent = STAR_SIGN_CONTENT[a];
  const bContent = STAR_SIGN_CONTENT[b];
  const report = analyzeCompatibility(a, b);
  const tone = TONE_STYLE[report.tone];

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="별자리 궁합" backHref="/star-sign" />

        <section className="space-y-5 px-1">
          {/* §1 hero - 두 별자리 + 종합 점수 */}
          <article
            className="relative overflow-hidden rounded-[22px] p-5 text-white"
            style={{ background: tone.gradient }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40"
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
                12 별자리 궁합
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <Link href={`/star-sign/${a}`} className="text-center">
                  <div
                    className="mx-auto grid h-[68px] w-[68px] place-items-center rounded-full text-[28px]"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid rgba(255,255,255,0.32)',
                    }}
                    aria-hidden="true"
                  >
                    {aMeta.symbol}
                  </div>
                  <div className="mt-1.5 text-[12px] font-extrabold">{aItem.label}</div>
                </Link>
                <div className="text-[28px] font-extrabold" style={{ opacity: 0.8 }}>
                  ×
                </div>
                <Link href={`/star-sign/${b}`} className="text-center">
                  <div
                    className="mx-auto grid h-[68px] w-[68px] place-items-center rounded-full text-[28px]"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid rgba(255,255,255,0.32)',
                    }}
                    aria-hidden="true"
                  >
                    {bMeta.symbol}
                  </div>
                  <div className="mt-1.5 text-[12px] font-extrabold">{bItem.label}</div>
                </Link>
              </div>
              <div className="mt-4 text-center">
                <div className="text-[10px] uppercase font-bold" style={{ opacity: 0.6 }}>
                  종합 궁합 점수
                </div>
                <div className="text-[48px] font-extrabold tabular-nums leading-none">
                  {report.overallScore}
                </div>
              </div>
              <p
                className="mt-3 text-center text-[12.5px] leading-[1.55]"
                style={{ opacity: 0.95, wordBreak: 'keep-all' }}
              >
                {report.headline}
              </p>
            </div>
          </article>

          {/* §2 element + quality 관계 */}
          <div className="grid grid-cols-2 gap-2">
            <article
              className="rounded-[14px] border bg-white p-3.5"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                원소
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: ELEMENT_HEX[aContent.element] }}
                  aria-hidden="true"
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: ELEMENT_HEX[bContent.element] }}
                  aria-hidden="true"
                />
              </div>
              <div
                className="mt-1 text-[11.5px] font-bold leading-[1.4] text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {report.elementRelation}
              </div>
            </article>
            <article
              className="rounded-[14px] border bg-white p-3.5"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
                모달리티
              </div>
              <div
                className="mt-1 text-[11.5px] font-bold leading-[1.4] text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {report.qualityRelation}
              </div>
            </article>
          </div>

          {/* §3 6 영역 점수 */}
          <section>
            <h2 className="text-[14px] font-extrabold text-[var(--app-ink)]">
              영역별 궁합
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
              연애·우정·직장·결혼·소통·여행 6 영역의 케미를 나누어 봤습니다
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {report.areas.map((a) => (
                <ScoreBar key={a.area} label={a.area} value={a.score} hint={a.hint} />
              ))}
            </div>
          </section>

          {/* §4 강점 (jade) */}
          <article
            className="rounded-[16px] border p-4"
            style={{
              background: 'rgba(45,135,88,0.05)',
              borderColor: 'rgba(45,135,88,0.22)',
            }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
              ☘ 잘 맞는 점
            </div>
            <ul
              className="mt-2 grid gap-1.5 text-[12.5px] leading-[1.55] text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {report.strengths.map((s, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span style={{ color: 'var(--app-jade)' }}>•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* §5 긴장점 (coral) */}
          <article
            className="rounded-[16px] border p-4"
            style={{
              background: 'rgba(220,79,79,0.04)',
              borderColor: 'rgba(220,79,79,0.22)',
            }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
              ⚡ 부딪칠 수 있는 점
            </div>
            <ul
              className="mt-2 grid gap-1.5 text-[12.5px] leading-[1.55] text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {report.tensions.map((t, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span style={{ color: 'var(--app-coral)' }}>•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* §6 데이트 추천 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              💝 함께하면 좋은 시간
            </div>
            <div className="mt-2 grid gap-1.5">
              {report.dateIdeas.map((d, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-[10px] p-2.5"
                  style={{ background: 'var(--app-pink-soft)' }}
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white"
                    style={{ background: 'var(--app-pink-strong)' }}
                  >
                    {idx + 1}
                  </span>
                  <p
                    className="text-[12px] leading-[1.5] text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {d}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* §7 갈등 극복 팁 */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
              🛡 갈등이 생기면
            </div>
            <ul
              className="mt-2 grid gap-1.5 text-[12px] leading-[1.5] text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {report.conflictTips.map((t, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span style={{ color: 'var(--app-jade)' }}>✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* §8 다른 별자리와도 보기 — swap CTA */}
          <article
            className="rounded-[16px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              🔄 다른 조합도 보기
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href={`/star-sign/compat/${b}/${a}`}
                className="rounded-full border bg-white px-3 py-2 text-center text-[11.5px] font-bold text-[var(--app-pink-strong)]"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                {bItem.label} → {aItem.label}
              </Link>
              <Link
                href={`/star-sign/${a}`}
                className="rounded-full border bg-white px-3 py-2 text-center text-[11.5px] font-bold text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {aItem.label} 상세
              </Link>
            </div>
          </article>

          {/* §9 사주 궁합 CTA */}
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
              사주 궁합으로도 보기
            </h2>
            <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ opacity: 0.75 }}>
              서양 별자리 궁합은 큰 흐름을, 동양 사주 궁합은 음양·오행·일진의 세밀한 만남을 보여줍니다.
              두 시스템을 함께 보면 입체적인 관계 그림이 나옵니다.
            </p>
            <Link
              href="/compatibility"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
            >
              사주 궁합 입력하기 →
            </Link>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
