// Redesign 2026-05-16 — 별자리 12×12 호환 매트릭스 미리보기.
// /star-sign/compat — 모든 별자리 쌍의 점수를 한눈에 보고 클릭 시 상세 페이지로.
// 두 축 (행/열) 동일하게 12 별자리, 셀 클릭 시 /star-sign/compat/[a]/[b] 이동.
import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { STAR_SIGN_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildStarSignSlugFromProfile } from '@/lib/profile-personalization';
import {
  ELEMENT_HEX,
  getCompatibilityScore,
  getCompatibilityTone,
  STAR_SIGN_CONTENT,
  type StarSignSlug,
} from '@/lib/star-sign/sign-content';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '별자리 12×12 궁합 매트릭스',
  description:
    '12 별자리 × 12 별자리 144칸 호환 점수를 한눈에. 셀을 누르면 두 별자리의 상세 궁합 분석으로 이어집니다.',
  alternates: {
    canonical: '/star-sign/compat',
  },
};

const TONE_BG: Record<'best' | 'good' | 'mid' | 'avoid', string> = {
  best: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  good: 'var(--app-pink-soft)',
  mid: 'rgba(0,0,0,0.04)',
  avoid: 'rgba(212,148,38,0.08)',
};

const TONE_COLOR: Record<'best' | 'good' | 'mid' | 'avoid', string> = {
  best: '#fff',
  good: 'var(--app-pink-strong)',
  mid: 'var(--app-copy-soft)',
  avoid: 'var(--app-amber)',
};

const SIGN_ORDER: StarSignSlug[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

export default async function StarSignCompatMatrixPage() {
  const profile = await getOptionalSignedInProfile();
  const mySlug = buildStarSignSlugFromProfile(profile) as StarSignSlug | null;

  // 전체 144 점수 미리 계산해 통계.
  const allScores: number[] = [];
  for (const a of SIGN_ORDER) {
    for (const b of SIGN_ORDER) {
      allScores.push(getCompatibilityScore(a, b));
    }
  }
  const averageScore = Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length);
  const maxScore = Math.max(...allScores);
  const minScore = Math.min(...allScores);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="12×12 궁합 매트릭스" backHref="/star-sign" />

        <section className="space-y-5 px-1">
          {/* §hero */}
          <article
            className="rounded-[18px] border p-4"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              12 × 12 = 144 칸 한눈에
            </div>
            <h1 className="mt-1 text-[18px] font-extrabold leading-snug text-[var(--app-ink)]">
              내 별자리 행과 다른 별자리 열을 짚어보세요
            </h1>
            <p
              className="mt-2 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              점수 (50-95) 가 높을수록 색이 강하게 표시됩니다. 셀을 누르면 두 별자리의
              종합 점수·6 영역 점수·강점/긴장·데이트 추천을 확인하실 수 있어요.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[10px] font-bold text-[var(--app-copy-soft)]">최저</div>
                <div className="text-[16px] font-extrabold tabular-nums text-[var(--app-amber)]">
                  {minScore}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-[var(--app-copy-soft)]">평균</div>
                <div className="text-[16px] font-extrabold tabular-nums text-[var(--app-pink-strong)]">
                  {averageScore}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-[var(--app-copy-soft)]">최고</div>
                <div className="text-[16px] font-extrabold tabular-nums text-[var(--app-jade)]">
                  {maxScore}
                </div>
              </div>
            </div>
          </article>

          {/* §my row hint */}
          {mySlug ? (
            <article
              className="rounded-[14px] border bg-white p-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                ⭐ MY 별자리 행이 강조됩니다
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--app-copy-muted)]">
                {STAR_SIGN_FORTUNES.find((s) => s.slug === mySlug)?.label} 행을 따라가며 가장
                잘 맞는 별자리를 찾아보세요.
              </p>
            </article>
          ) : null}

          {/* §matrix */}
          <section className="-mx-1 overflow-x-auto pb-2">
            <table
              className="border-separate"
              style={{ borderSpacing: '4px', minWidth: '420px' }}
            >
              <thead>
                <tr>
                  <th className="text-[10px] font-bold text-[var(--app-copy-soft)]">
                    <span className="sr-only">행: 내 별자리</span>
                  </th>
                  {SIGN_ORDER.map((b) => {
                    const meta = STAR_SIGN_META[b];
                    const content = STAR_SIGN_CONTENT[b];
                    return (
                      <th
                        key={`h-${b}`}
                        scope="col"
                        className="px-0.5"
                        style={{ minWidth: '28px' }}
                      >
                        <Link
                          href={`/star-sign/${b}`}
                          className="grid h-7 w-7 place-items-center rounded-full mx-auto"
                          style={{
                            background: 'rgba(0,0,0,0.03)',
                            color: ELEMENT_HEX[content.element],
                            fontSize: '14px',
                          }}
                          aria-label={`${STAR_SIGN_FORTUNES.find((s) => s.slug === b)?.label} 상세`}
                        >
                          {meta?.symbol ?? ''}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SIGN_ORDER.map((a) => {
                  const aMeta = STAR_SIGN_META[a];
                  const aContent = STAR_SIGN_CONTENT[a];
                  const isMyRow = a === mySlug;
                  return (
                    <tr key={`r-${a}`}>
                      <th
                        scope="row"
                        className="pr-0.5"
                        style={{ minWidth: '28px' }}
                      >
                        <Link
                          href={`/star-sign/${a}`}
                          className="grid h-7 w-7 place-items-center rounded-full mx-auto"
                          style={{
                            background: isMyRow ? 'var(--app-pink-soft)' : 'rgba(0,0,0,0.03)',
                            color: ELEMENT_HEX[aContent.element],
                            fontSize: '14px',
                            border: isMyRow ? '1.5px solid var(--app-pink)' : 'none',
                          }}
                          aria-label={`${STAR_SIGN_FORTUNES.find((s) => s.slug === a)?.label} 상세`}
                        >
                          {aMeta?.symbol ?? ''}
                        </Link>
                      </th>
                      {SIGN_ORDER.map((b) => {
                        const score = getCompatibilityScore(a, b);
                        const tone = getCompatibilityTone(score);
                        const isSelf = a === b;
                        const isMyCol = b === mySlug;
                        return (
                          <td key={`${a}-${b}`}>
                            <Link
                              href={
                                isSelf
                                  ? `/star-sign/${a}`
                                  : `/star-sign/compat/${a}/${b}`
                              }
                              className="grid h-7 w-7 place-items-center rounded-[8px] text-[10px] font-extrabold tabular-nums transition-transform active:scale-95"
                              style={{
                                background: isSelf
                                  ? 'rgba(0,0,0,0.06)'
                                  : TONE_BG[tone],
                                color: isSelf ? 'var(--app-copy-soft)' : TONE_COLOR[tone],
                                border: isMyRow || isMyCol ? '1px solid var(--app-pink-line)' : 'none',
                              }}
                              aria-label={`${a}-${b} 점수 ${score}`}
                            >
                              {isSelf ? '—' : score}
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* §legend */}
          <article
            className="rounded-[14px] border bg-white p-3"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              범례
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(['best', 'good', 'mid', 'avoid'] as const).map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span
                    className="grid h-6 w-10 place-items-center rounded-[6px] text-[10px] font-extrabold"
                    style={{ background: TONE_BG[t], color: TONE_COLOR[t] }}
                  >
                    {t === 'best'
                      ? '85+'
                      : t === 'good'
                        ? '75+'
                        : t === 'mid'
                          ? '60+'
                          : '<60'}
                  </span>
                  <span className="text-[11px] text-[var(--app-copy-muted)]">
                    {t === 'best'
                      ? '최상'
                      : t === 'good'
                        ? '좋음'
                        : t === 'mid'
                          ? '보통'
                          : '주의'}
                  </span>
                </div>
              ))}
            </div>
          </article>

          {/* §quick links */}
          <article
            className="rounded-[14px] border bg-white p-3"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              빠른 이동
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href="/star-sign"
                className="rounded-full border bg-white px-3 py-2 text-center text-[12px] font-bold text-[var(--app-pink-strong)]"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                12 별자리 메인
              </Link>
              {mySlug ? (
                <Link
                  href={`/star-sign/${mySlug}`}
                  className="rounded-full border bg-white px-3 py-2 text-center text-[12px] font-bold text-[var(--app-ink)]"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  내 별자리 상세
                </Link>
              ) : (
                <Link
                  href="/compatibility"
                  className="rounded-full border bg-white px-3 py-2 text-center text-[12px] font-bold text-[var(--app-ink)]"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  사주 궁합
                </Link>
              )}
            </div>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
