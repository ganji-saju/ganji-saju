// Redesign 2026-05-17 — flow-polish.css 의 .gangi-today-detail-* / .gangi-paid-detail-* /
// .gangi-detail-* / .gangi-result-flow-* named CSS class 모두 inline style 로 1:1 변환.
// 사용자 보고 (audit-redesign-coverage CRITICAL 30건 → 0) — sibling page 들과 동일한
// inline + design token 패턴 (var(--app-pink), var(--app-ink) 등) 으로 architecture
// 일관성 확보. CSS rule 들은 다른 페이지가 참조 안 하므로 후속 cleanup PR 에서 삭제.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { SafetyNotice } from '@/components/common/safety-notice';
import { buildPunchReading, buildSajuReport } from '@/domain/saju/report';
import type { PunchReading, ReportScore, SajuReport } from '@/domain/saju/report';
// 2026-05-16 PR #179 — 사주 페이지 ↔ 운세 페이지 점수 단일화.
import { computeSajuIljinScore } from '@/server/today-fortune/build-today-fortune';
import { unifyScoresWithIljinScore } from '@/lib/today-fortune/unify-saju-scores';
import SiteHeader from '@/features/shared-navigation/site-header';
import { resolveReading } from '@/lib/saju/readings';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import { getSajuTodayDetailEntitlement } from '@/lib/saju/today-detail-access';
import { buildSajuTodayDetailCheckoutHref } from '@/lib/saju/today-detail-links';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
}

const SCORE_CARD_LABELS: Partial<Record<ReportScore['key'], string>> = {
  wealth: '돈',
  love: '마음',
  career: '일',
  relationship: '관계',
};

const SCORE_CARD_COLORS: Partial<Record<ReportScore['key'], string>> = {
  wealth: '#D59B2E',
  love: '#E05298',
  career: '#3F8796',
  relationship: '#5C8A63',
  overall: 'var(--app-pink)',
};

// 공통 inline style snippet — 카드 surface (white bg + radius + soft shadow).
const CARD_SURFACE_STYLE = {
  border: '1px solid rgba(17, 17, 20, 0.09)',
  borderRadius: '1.55rem',
  background: '#ffffff',
  boxShadow: '0 16px 38px -28px rgba(17, 17, 20, 0.42)',
} as const;

const KICKER_STYLE = {
  color: 'var(--app-pink-strong)',
  fontSize: '0.76rem',
  fontWeight: 760,
  letterSpacing: '0.02em',
  lineHeight: 1.25,
} as const;

const SECTION_TITLE_STYLE = {
  marginTop: '0.15rem',
  color: 'var(--app-ink)',
  fontSize: '1.05rem',
  fontWeight: 740,
  lineHeight: 1.35,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '오늘 자세히 보기',
    description: '구매한 오늘 상세 풀이를 짧고 쉽게 확인하는 화면입니다.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

function normalizeItemKey(value: string) {
  return value
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 28);
}

function uniqueNonEmpty(items: Array<string | null | undefined>, max = 3) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const cleaned = item?.trim();
    if (!cleaned) continue;
    const key = normalizeItemKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= max) break;
  }

  return result;
}

function easyResultCopy(value: string | null | undefined, maxSentences = 1) {
  const cleaned = simplifySajuCopy(value)
    .replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/gu, '')
    .replace(/사주 구조/gu, '내 흐름')
    .replace(/보완 기운/gu, '채울 점')
    .replace(/기운의 균형/gu, '컨디션 균형')
    .replace(/대운 흐름/gu, '긴 흐름')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?。])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length > 0 ? sentences.slice(0, maxSentences).join(' ') : cleaned;
}

function buildKeyThemes(report: SajuReport, punch: PunchReading) {
  return uniqueNonEmpty(
    [
      punch.why,
      report.summaryHighlights[0],
      report.timeline[0]?.headline,
      report.scores.find((score) => score.key === report.focusScoreKey)?.summary,
    ].map((item) => easyResultCopy(item)),
    3
  );
}

function buildCautionPatterns(report: SajuReport, punch: PunchReading) {
  return uniqueNonEmpty(
    [
      punch.caution,
      report.cautionAction.description,
      ...report.evidenceCards
        .filter((card) => ['relations', 'gongmang', 'specialSals'].includes(card.key))
        .map((card) => card.body),
    ],
    3
  ).map((item) => easyResultCopy(item));
}

function buildFavorableChoices(report: SajuReport, punch: PunchReading) {
  return uniqueNonEmpty(
    [
      punch.action,
      report.primaryAction.description,
      ...report.evidenceCards.flatMap((card) => card.practicalActions ?? []),
    ],
    3
  ).map((item) => easyResultCopy(item));
}

function buildScoreCards(report: SajuReport) {
  return report.scores
    .filter((score) => score.key !== 'overall')
    .map((score) => ({
      ...score,
      displayLabel: SCORE_CARD_LABELS[score.key] ?? score.label,
      color: SCORE_CARD_COLORS[score.key] ?? 'var(--app-pink)',
      summary: easyResultCopy(score.summary),
    }));
}

function getScoreStatus(score: number) {
  if (score >= 75) return '좋음';
  if (score >= 60) return '무난';
  if (score >= 45) return '점검';
  return '천천히';
}

export default async function SajuTodayDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { topic } = await searchParams;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const entitlement = await getSajuTodayDetailEntitlement(slug);
  const checkoutHref = buildSajuTodayDetailCheckoutHref(slug);

  if (!entitlement) {
    return (
      <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
        <AppPage className="gangi-subpage space-y-5">
          <GangiPageHeader title="오늘 자세히 보기" backHref={`/saju/${encodeURIComponent(slug)}`} />
          <section
            className="mx-[0.85rem] text-center"
            style={{ ...CARD_SURFACE_STYLE, padding: '1.45rem 1.25rem' }}
          >
            <div style={KICKER_STYLE}>구매 후 열람</div>
            <h1
              className="mt-2.5"
              style={{
                color: 'var(--app-ink)',
                fontSize: '1.35rem',
                fontWeight: 720,
                lineHeight: 1.45,
              }}
            >
              이 풀이는 550원 결제 후 열립니다
            </h1>
            <p
              className="mx-auto mt-2.5"
              style={{
                maxWidth: '22rem',
                color: 'var(--app-copy)',
                fontSize: '0.9rem',
                fontWeight: 480,
                lineHeight: 1.7,
              }}
            >
              이미 결제했다면 같은 계정으로 로그인한 뒤 다시 열어주세요.
            </p>
            <Link
              href={checkoutHref}
              className="mt-[1.15rem] inline-flex min-h-[3.15rem] items-center justify-center rounded-full px-[1.45rem] py-[0.85rem]"
              style={{
                background: 'var(--app-pink)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 740,
                boxShadow: '0 14px 32px -20px rgba(216, 27, 114, 0.72)',
              }}
            >
              550원 결제하고 열기
            </Link>
          </section>
        </AppPage>
      </AppShell>
    );
  }

  const { input, sajuData } = reading;
  const rawReport = buildSajuReport(input, sajuData, topic);
  // 2026-05-16 PR #179 — 오늘 운세 페이지와 점수 일치 보장.
  const iljinResult = computeSajuIljinScore(sajuData);
  const report: SajuReport = iljinResult
    ? { ...rawReport, scores: unifyScoresWithIljinScore(rawReport.scores, iljinResult.totalScore) }
    : rawReport;
  const punchReading = buildPunchReading(report);
  const isTimeUnknown = input.unknownTime === true || input.hour === undefined;
  const scoreCards = buildScoreCards(report);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="오늘 자세히 보기" backHref={`/saju/${encodeURIComponent(slug)}`} />

        {/* 흐름 strip — 총평 / 상세 / 보관 */}
        <div
          className="mx-[0.85rem] grid grid-cols-3 gap-[0.38rem] rounded-full bg-white p-[0.35rem]"
          style={{
            border: '1px solid var(--app-line)',
            boxShadow: '0 10px 26px -24px rgba(17, 17, 20, 0.32)',
          }}
          aria-label="풀이 흐름"
        >
          {[
            { label: '총평', active: false },
            { label: '상세', active: true },
            { label: '보관', active: false },
          ].map((step) => (
            <span
              key={step.label}
              className="inline-flex min-h-[2.15rem] items-center justify-center rounded-full whitespace-nowrap"
              style={{
                color: step.active ? '#ffffff' : 'var(--app-copy-muted)',
                background: step.active ? 'var(--app-ink)' : 'transparent',
                fontSize: '0.76rem',
                fontWeight: 650,
              }}
            >
              {step.label}
            </span>
          ))}
        </div>

        {/* Hero — pink-soft gradient + 550원 chip */}
        <section
          className="relative mx-[0.85rem] grid gap-4 overflow-hidden"
          style={{
            border: '1px solid var(--app-pink-line)',
            borderRadius: '1.55rem',
            background:
              'radial-gradient(circle at 88% 10%, rgba(255, 79, 154, 0.18), transparent 31%), linear-gradient(180deg, #fff3f9 0%, #ffffff 100%)',
            padding: '1.25rem 1.15rem',
            boxShadow: '0 18px 44px -30px rgba(216, 27, 114, 0.46)',
          }}
        >
          {/* Decorative blob */}
          <span
            aria-hidden="true"
            className="absolute"
            style={{
              right: '-1.7rem',
              bottom: '-1.9rem',
              width: '7rem',
              height: '7rem',
              borderRadius: '9999px',
              background: 'rgba(255, 79, 154, 0.08)',
            }}
          />
          <div className="relative">
            <div style={KICKER_STYLE}>구매한 풀이</div>
            <h1
              className="mt-2"
              style={{
                maxWidth: '14em',
                color: 'var(--app-ink)',
                fontSize: 'clamp(1.35rem, 5.4vw, 1.62rem)',
                fontWeight: 720,
                lineHeight: 1.42,
                wordBreak: 'keep-all',
              }}
            >
              오늘 바로 쓸 말과 행동만 정리했어요
            </h1>
            <p
              className="mt-2.5"
              style={{
                maxWidth: '23rem',
                color: 'var(--app-copy)',
                fontSize: '0.92rem',
                fontWeight: 480,
                lineHeight: 1.72,
                wordBreak: 'keep-all',
              }}
            >
              긴 풀이 대신 지금 필요한 핵심, 조심할 점, 해볼 일을 카드로 나눠 보여드립니다.
            </p>
          </div>
          <span
            className="relative inline-flex w-max items-center rounded-full bg-white"
            style={{
              border: '1px solid var(--app-pink-line)',
              padding: '0.55rem 0.85rem',
              color: 'var(--app-pink-strong)',
              fontSize: '0.78rem',
              fontWeight: 760,
              boxShadow: '0 12px 26px -22px rgba(216, 27, 114, 0.55)',
            }}
          >
            550원 풀이
          </span>
        </section>

        {/* Stack section — 본문 카드 들 */}
        <section className="mx-[0.85rem] grid gap-[0.9rem]" aria-label="오늘 상세 풀이">
          {/* 한눈에 보는 핵심 — pink-soft main card */}
          <article
            style={{
              border: '1px solid var(--app-pink-line)',
              borderRadius: '1.55rem',
              background: 'var(--app-pink-soft)',
              padding: '1.2rem 1.1rem',
              boxShadow: '0 18px 44px -30px rgba(216, 27, 114, 0.46)',
            }}
          >
            <div style={KICKER_STYLE}>한눈에 보는 핵심</div>
            <h2
              className="mt-2"
              style={{
                color: 'var(--app-ink)',
                fontSize: 'clamp(1.2rem, 5.2vw, 1.46rem)',
                fontWeight: 680,
                lineHeight: 1.55,
                wordBreak: 'keep-all',
              }}
            >
              {easyResultCopy(punchReading.verdict || report.headline)}
            </h2>
            {punchReading.personalPoints.length > 0 ? (
              <div className="mt-[0.95rem] flex flex-wrap gap-[0.45rem]">
                {punchReading.personalPoints.map((point) => (
                  <span
                    key={point}
                    className="rounded-full"
                    style={{
                      border: '1px solid rgba(216, 27, 114, 0.14)',
                      background: 'rgba(255, 255, 255, 0.76)',
                      padding: '0.38rem 0.62rem',
                      color: 'var(--app-pink-strong)',
                      fontSize: '0.73rem',
                      fontWeight: 690,
                    }}
                  >
                    {point}
                  </span>
                ))}
              </div>
            ) : null}
          </article>

          {isTimeUnknown ? (
            <p
              style={{
                border: '1px solid var(--app-pink-line)',
                borderRadius: '1.15rem',
                background: '#fff8fc',
                padding: '0.85rem 0.95rem',
                color: 'var(--app-copy)',
                fontSize: '0.86rem',
                fontWeight: 480,
                lineHeight: 1.65,
              }}
            >
              태어난 시간이 정확하지 않아 시간에 민감한 풀이는 조심해서 읽습니다.
            </p>
          ) : null}

          {/* 분야별 점수 board */}
          <article style={CARD_SURFACE_STYLE} aria-label="분야별 점수 요약">
            <div
              className="flex items-baseline justify-between"
              style={{ padding: '1rem 1.1rem 0.55rem' }}
            >
              <h2
                style={{
                  color: 'var(--app-ink)',
                  fontSize: '1rem',
                  fontWeight: 720,
                  lineHeight: 1.35,
                }}
              >
                분야별 흐름
              </h2>
              <span
                style={{
                  color: 'var(--app-copy-muted)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                }}
              >
                {scoreCards.length}개 영역
              </span>
            </div>
            <div className="grid gap-[0.55rem]" style={{ padding: '0 1.1rem 1.1rem' }}>
              {scoreCards.map((score, index) => (
                <div
                  key={score.key}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: '1.4rem 3.2rem 1fr 2.4rem 2.6rem' }}
                >
                  <span
                    style={{
                      color: 'var(--app-copy-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </span>
                  <strong
                    style={{
                      color: 'var(--app-ink)',
                      fontSize: '0.86rem',
                      fontWeight: 720,
                    }}
                  >
                    {score.displayLabel}
                  </strong>
                  <p
                    className="relative overflow-hidden rounded-full"
                    style={{
                      height: '0.5rem',
                      background: 'rgba(17, 17, 20, 0.06)',
                    }}
                  >
                    <i
                      className="absolute left-0 top-0 block h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, score.score))}%`,
                        background: score.color,
                      }}
                    />
                  </p>
                  <b
                    style={{
                      color: 'var(--app-ink)',
                      fontSize: '0.92rem',
                      fontWeight: 760,
                      textAlign: 'right',
                    }}
                  >
                    {score.score}
                  </b>
                  <em
                    style={{
                      color: 'var(--app-copy-muted)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      fontStyle: 'normal',
                      textAlign: 'right',
                    }}
                  >
                    {getScoreStatus(score.score)}
                  </em>
                </div>
              ))}
            </div>
          </article>

          {/* 분야 바로 보기 strip */}
          <div
            className="flex gap-2 overflow-x-auto"
            style={{ paddingInline: '0.2rem' }}
            aria-label="분야 바로 보기"
          >
            {scoreCards.slice(0, 5).map((score, index) => (
              <span
                key={score.key}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full"
                style={{
                  border: '1px solid var(--app-line)',
                  background: index === 0 ? 'var(--app-pink-soft)' : '#ffffff',
                  padding: '0.4rem 0.75rem',
                  color: index === 0 ? 'var(--app-pink-strong)' : 'var(--app-copy)',
                  fontSize: '0.76rem',
                  fontWeight: 680,
                }}
              >
                <i
                  className="block rounded-full"
                  style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    background: score.color,
                  }}
                />
                {score.displayLabel}
              </span>
            ))}
          </div>

          {/* Focus grid — 조심 / 행동 / 단서 */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: '조심', label: '오늘 줄일 것', items: buildCautionPatterns(report, punchReading) },
              { title: '행동', label: '오늘 해볼 것', items: buildFavorableChoices(report, punchReading) },
              { title: '단서', label: '더 볼 주제', items: buildKeyThemes(report, punchReading) },
            ].map((group) => (
              <article
                key={group.title}
                style={{
                  ...CARD_SURFACE_STYLE,
                  minHeight: '8.5rem',
                  padding: '1rem',
                }}
              >
                <div style={KICKER_STYLE}>{group.title}</div>
                <h3
                  className="mt-[0.42rem]"
                  style={{
                    color: 'var(--app-ink)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    lineHeight: 1.42,
                    wordBreak: 'keep-all',
                  }}
                >
                  {group.label}
                </h3>
                <ul className="mt-[0.7rem] grid gap-2">
                  {group.items.map((item) => (
                    <li
                      key={`${group.title}-${item}`}
                      className="relative"
                      style={{
                        paddingLeft: '0.85rem',
                        color: 'var(--app-copy)',
                        fontSize: '0.88rem',
                        fontWeight: 500,
                        lineHeight: 1.62,
                        wordBreak: 'keep-all',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute rounded-full"
                        style={{
                          left: 0,
                          top: '0.72em',
                          width: '0.28rem',
                          height: '0.28rem',
                          background: 'var(--app-pink)',
                        }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          {/* Action grid — 해볼 일 / 줄일 일 (jade + pink tone) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <article
              style={{
                ...CARD_SURFACE_STYLE,
                borderColor: 'rgba(34, 197, 94, 0.18)',
                background: 'linear-gradient(180deg, #f5fffa 0%, #ffffff 100%)',
                padding: '1.05rem',
              }}
            >
              <div style={KICKER_STYLE}>오늘 해볼 일</div>
              <h2
                className="mt-[0.42rem]"
                style={{
                  color: 'var(--app-ink)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  lineHeight: 1.42,
                  wordBreak: 'keep-all',
                }}
              >
                {easyResultCopy(report.primaryAction.title)}
              </h2>
              <p
                className="mt-[0.48rem]"
                style={{
                  color: 'var(--app-copy)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  lineHeight: 1.68,
                  wordBreak: 'keep-all',
                }}
              >
                {easyResultCopy(report.primaryAction.description, 2)}
              </p>
            </article>

            <article
              style={{
                ...CARD_SURFACE_STYLE,
                borderColor: 'var(--app-pink-line)',
                background: 'linear-gradient(180deg, #fff3f9 0%, #ffffff 100%)',
                padding: '1.05rem',
              }}
            >
              <div style={KICKER_STYLE}>오늘 줄일 일</div>
              <h2
                className="mt-[0.42rem]"
                style={{
                  color: 'var(--app-ink)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  lineHeight: 1.42,
                  wordBreak: 'keep-all',
                }}
              >
                {easyResultCopy(report.cautionAction.title)}
              </h2>
              <p
                className="mt-[0.48rem]"
                style={{
                  color: 'var(--app-copy)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  lineHeight: 1.68,
                  wordBreak: 'keep-all',
                }}
              >
                {easyResultCopy(report.cautionAction.description, 2)}
              </p>
            </article>
          </div>

          <div style={SECTION_TITLE_STYLE}>흐름을 조금 더 보면</div>
          <div className="grid gap-3">
            {report.timeline.map((item) => (
              <article key={item.label} style={{ ...CARD_SURFACE_STYLE, padding: '1rem' }}>
                <div style={KICKER_STYLE}>{item.label}</div>
                <h3
                  className="mt-[0.42rem]"
                  style={{
                    color: 'var(--app-ink)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    lineHeight: 1.42,
                    wordBreak: 'keep-all',
                  }}
                >
                  {easyResultCopy(item.headline)}
                </h3>
                <p
                  className="mt-[0.48rem]"
                  style={{
                    color: 'var(--app-copy)',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    lineHeight: 1.68,
                    wordBreak: 'keep-all',
                  }}
                >
                  {easyResultCopy(item.body, 2)}
                </p>
              </article>
            ))}
          </div>

          <div style={SECTION_TITLE_STYLE}>분야별로 짧게</div>
          <div className="grid grid-cols-2 gap-3">
            {scoreCards.map((score) => (
              <article
                key={score.key}
                style={{
                  ...CARD_SURFACE_STYLE,
                  minHeight: '7.25rem',
                  padding: '0.95rem',
                }}
              >
                <div
                  style={{
                    color: 'var(--app-pink-strong)',
                    fontSize: '0.8rem',
                    fontWeight: 760,
                    lineHeight: 1.25,
                  }}
                >
                  {score.displayLabel}
                </div>
                <p
                  className="mt-[0.48rem]"
                  style={{
                    color: 'var(--app-ink)',
                    fontSize: '0.9rem',
                    fontWeight: 620,
                    lineHeight: 1.5,
                    wordBreak: 'keep-all',
                  }}
                >
                  {score.summary}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Bottom actions — 무료 요약 / 보관함 */}
        <div className="mx-[0.85rem] grid gap-[0.65rem] sm:grid-cols-2">
          <Link
            href={`/saju/${encodeURIComponent(slug)}`}
            className="inline-flex min-h-[3.2rem] items-center justify-center rounded-[1.1rem] bg-white"
            style={{
              border: '1px solid var(--app-line)',
              color: 'var(--app-ink)',
              fontSize: '0.9rem',
              fontWeight: 680,
              boxShadow: '0 12px 28px -24px rgba(17, 17, 20, 0.32)',
            }}
          >
            무료 요약 다시 보기
          </Link>
          <Link
            href="/my/results"
            className="inline-flex min-h-[3.2rem] items-center justify-center rounded-[1.1rem]"
            style={{
              border: '1px solid var(--app-pink-line)',
              background: 'var(--app-pink)',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 680,
              boxShadow: '0 16px 34px -24px rgba(216, 27, 114, 0.46)',
            }}
          >
            보관함에서 다시 보기
          </Link>
        </div>

        <SafetyNotice variant="general" />
      </AppPage>
    </AppShell>
  );
}
