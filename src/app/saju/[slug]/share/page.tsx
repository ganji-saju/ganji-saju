// Redesign 2026-05-13 (Claude Design / screens-f.jsx ScreenSajuShare):
// 신규 /saju/[slug]/share — 인스타 1:1.3 비율 결과 카드 + 5 채널 공유 + 추천 전 안내.
// 실제 공유는 Web Share API + 클립보드 fallback. QR 코드는 임시 picture-pattern.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { resolveReading } from '@/lib/saju/readings';
import { buildSajuReport, buildPunchReading } from '@/domain/saju/report';
import type { SajuReport } from '@/domain/saju/report';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
// 2026-05-16 PR #179 — 사주 페이지 ↔ 운세 페이지 점수 단일화.
import { computeSajuIljinScore } from '@/server/today-fortune/build-today-fortune';
import { unifyScoresWithIljinScore } from '@/lib/today-fortune/unify-saju-scores';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';

interface Props {
  params: Promise<{ slug: string }>;
}

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake',
  午: 'horse', 未: 'sheep', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig',
};

const ZODIAC_KOR: Record<ZodiacKey, string> = {
  rat: '쥐띠', ox: '소띠', tiger: '범띠', rabbit: '토끼띠', dragon: '용띠', snake: '뱀띠',
  horse: '말띠', sheep: '양띠', monkey: '원숭이띠', rooster: '닭띠', dog: '개띠', pig: '돼지띠',
};

function getYearZodiac(data: SajuDataV1 | SajuDataV2): ZodiacKey {
  return BRANCH_TO_ZODIAC[data.pillars.year.branch] ?? 'dragon';
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 70;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '공유용 결과 카드',
    description: '친구와 나누기 좋은 사주 한 줄 결과 카드입니다.',
    robots: { index: false, follow: false },
  };
}

export default async function SajuSharePage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  const { input, sajuData } = reading;
  const rawReport = buildSajuReport(input, sajuData);
  // 2026-05-16 PR #179 — 오늘 운세 페이지와 점수 일치 보장.
  const iljinResult = computeSajuIljinScore(sajuData);
  const report: SajuReport = iljinResult
    ? { ...rawReport, scores: unifyScoresWithIljinScore(rawReport.scores, iljinResult.totalScore) }
    : rawReport;
  const punch = buildPunchReading(report);
  const yearZodiac = getYearZodiac(sajuData);
  const zodiacLabel = ZODIAC_KOR[yearZodiac];
  const dayMasterLabel = `${sajuData.pillars.day.ganzi}일주`;

  const verdict = simplifySajuCopy(punch.verdict);
  const overall = clampScore(report.scores.find((s) => s.key === 'overall')?.score ?? 70);
  const mainScoreKeys: Array<{ key: 'love' | 'wealth' | 'career'; label: string }> = [
    { key: 'love', label: '연애' },
    { key: 'wealth', label: '재물' },
    { key: 'career', label: '직장' },
  ];
  const mainScoreLine = mainScoreKeys
    .map((ks) => {
      const v = report.scores.find((s) => s.key === ks.key);
      return v ? `${ks.label} ${clampScore(v.score)}` : null;
    })
    .filter(Boolean)
    .join(' · ');

  // 2026-07-03 공유 전수감사 — 레거시 한글도메인(간지사주.kr, 301 대상) 대신 canonical.
  //   85/91/kakao path 가 같은 인코딩 경로를 공유하도록 상수화.
  const sajuPath = `/saju/${encodeURIComponent(slug)}`;
  const shareUrl = getCanonicalUrl(sajuPath);
  const shareText = `${zodiacLabel} ${dayMasterLabel} — ${verdict}`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="공유하기" backHref={sajuPath} />

        <section className="space-y-5 px-1">
          {/* §1 미리보기 eyebrow + 헤드라인 */}
          <div>
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              공유 미리보기
            </div>
            {/* 2026-07-03 — 카드 자체가 전송되는 게 아니라 텍스트+링크가 공유되므로 정확한 안내로. */}
            <h1 className="mt-1.5 text-[20.7px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]">
              링크와 함께 이런 내용이 전달돼요
            </h1>
          </div>

          {/* §2 공유 카드 — 4:5 비율 그라데이션 */}
          <article
            className="relative overflow-hidden rounded-[24px] p-6"
            style={{
              aspectRatio: '4 / 5',
              background:
                'linear-gradient(160deg, #fff0f7 0%, #ffd9eb 60%, #ff9bc6 100%)',
              boxShadow: '0 18px 40px rgba(216,27,114,0.2)',
            }}
          >
            {/* 큰 한자 배경 — 運 */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-5 -top-5 select-none leading-none"
              style={{
                fontFamily: 'var(--font-han)',
                fontSize: 276,
                fontWeight: 700,
                color: '#fff',
                opacity: 0.18,
              }}
            >
              運
            </div>

            {/* 상단 브랜드 */}
            <div className="relative flex items-center gap-2">
              <div
                className="grid h-7 w-7 place-items-center rounded-[8px] text-[18.4px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                  fontFamily: 'var(--font-han)',
                }}
              >
                干
              </div>
              <div className="text-[15px] font-extrabold tracking-tight text-[var(--app-ink)]">
                간지사주
              </div>
              <span className="ml-auto text-[11.5px] font-extrabold text-[var(--app-pink-strong)]">
                간지사주
              </span>
            </div>

            {/* 가운데 컨텐츠 */}
            <div className="relative flex flex-1 flex-col items-center justify-center pt-6 pb-2 text-center">
              <ZodiacChip kind={yearZodiac} size="xl" />
              <div className="mt-3 text-[12.6px] font-extrabold tracking-[0.08em] text-[var(--app-pink-strong)]">
                오늘의 한 줄 · {zodiacLabel} {dayMasterLabel}
              </div>
              <div className="mt-3 text-[23px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
                {verdict}
              </div>
              <div className="mt-3 text-[14.4px] leading-[1.55] text-[var(--app-copy)]">
                총운 {overall}
                {mainScoreLine ? ` · ${mainScoreLine}` : ''}
              </div>
            </div>

            {/* 하단 워터마크 — 2026-07-03: 스캔 불가능한 가짜 QR(CSS 패턴) 제거, 도메인 표기는 canonical. */}
            <div
              className="relative flex items-center justify-between pt-3"
              style={{ borderTop: '1px dashed rgba(216,27,114,0.32)' }}
            >
              <div className="text-[11.5px] font-bold leading-tight text-[var(--app-copy-soft)]">
                내 운세 보기
                <br />
                <span className="font-extrabold text-[var(--app-pink-strong)]">ganjisaju.kr</span>
              </div>
            </div>
          </article>

          {/* §3 공유 채널 */}
          <section>
            <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">어디로 보낼까요?</h2>
            <ShareActions
              text={shareText}
              url={shareUrl}
              className="mt-2.5"
              kakao={buildKakaoShare({
                title: `${zodiacLabel} ${dayMasterLabel} 사주`,
                description: verdict,
                path: sajuPath,
                buttonTitle: '내 사주 보기',
              })}
            />
          </section>

          {/* 2026-07-03 — "친구가 가입하면 전 50개" 추천 보상 안내 제거: 추천(referral)
              시스템·귀속 파라미터·지급 로직이 존재하지 않는 허위 약속이었고, 전(재화)
              발행도 중단됨(PR #563). 추천 보상 도입 시 ref 파라미터+지급 로직과 함께 복원. */}
        </section>
      </AppPage>
    </AppShell>
  );
}
