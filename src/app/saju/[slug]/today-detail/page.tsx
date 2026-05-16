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
        <AppPage className="gangi-subpage today-detail-page space-y-5">
          <GangiPageHeader title="오늘 자세히 보기" backHref={`/saju/${encodeURIComponent(slug)}`} />
          <section className="gangi-today-detail-lock-card">
            <div className="gangi-detail-kicker">구매 후 열람</div>
            <h1>
              이 풀이는 550원 결제 후 열립니다
            </h1>
            <p>
              이미 결제했다면 같은 계정으로 로그인한 뒤 다시 열어주세요.
            </p>
            <Link
              href={checkoutHref}
              className="gangi-detail-primary-link"
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
      <AppPage className="gangi-subpage today-detail-page space-y-5">
        <GangiPageHeader title="오늘 자세히 보기" backHref={`/saju/${encodeURIComponent(slug)}`} />

        <div className="gangi-result-flow-strip" aria-label="풀이 흐름">
          <span>총평</span>
          <span data-active="true">상세</span>
          <span>보관</span>
        </div>

        <section className="gangi-today-detail-hero">
          <div>
            <div className="gangi-detail-kicker">구매한 풀이</div>
            <h1>오늘 바로 쓸 말과 행동만 정리했어요</h1>
            <p>긴 풀이 대신 지금 필요한 핵심, 조심할 점, 해볼 일을 카드로 나눠 보여드립니다.</p>
          </div>
          <span>550원 풀이</span>
        </section>

        <section className="gangi-today-detail-stack" aria-label="오늘 상세 풀이">
          <article className="gangi-today-detail-main-card">
            <div className="gangi-detail-kicker">한눈에 보는 핵심</div>
            <h2>{easyResultCopy(punchReading.verdict || report.headline)}</h2>
            {punchReading.personalPoints.length > 0 ? (
              <div className="gangi-detail-chip-row">
                {punchReading.personalPoints.map((point) => (
                  <span key={point}>{point}</span>
                ))}
              </div>
            ) : null}
          </article>

          {isTimeUnknown ? (
            <p className="gangi-today-detail-note">
              태어난 시간이 정확하지 않아 시간에 민감한 풀이는 조심해서 읽습니다.
            </p>
          ) : null}

          <article className="gangi-today-detail-score-board" aria-label="분야별 점수 요약">
            <div className="gangi-today-detail-score-board-head">
              <h2>분야별 흐름</h2>
              <span>{scoreCards.length}개 영역</span>
            </div>
            <div className="gangi-today-detail-score-bars">
              {scoreCards.map((score, index) => (
                <div key={score.key} className="gangi-today-detail-score-row">
                  <span>{index + 1}</span>
                  <strong>{score.displayLabel}</strong>
                  <p>
                    <i style={{ width: `${Math.max(0, Math.min(100, score.score))}%`, background: score.color }} />
                  </p>
                  <b>{score.score}</b>
                  <em>{getScoreStatus(score.score)}</em>
                </div>
              ))}
            </div>
          </article>

          <div className="gangi-today-detail-domain-strip" aria-label="분야 바로 보기">
            {scoreCards.slice(0, 5).map((score, index) => (
              <span key={score.key} data-active={index === 0}>
                <i style={{ background: score.color }} />
                {score.displayLabel}
              </span>
            ))}
          </div>

          <div className="gangi-today-detail-focus-grid">
            {[
              { title: '조심', label: '오늘 줄일 것', items: buildCautionPatterns(report, punchReading) },
              { title: '행동', label: '오늘 해볼 것', items: buildFavorableChoices(report, punchReading) },
              { title: '단서', label: '더 볼 주제', items: buildKeyThemes(report, punchReading) },
            ].map((group) => (
              <article key={group.title} className="gangi-today-detail-point-card">
                <div className="gangi-detail-kicker">{group.title}</div>
                <h3>{group.label}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={`${group.title}-${item}`}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="gangi-today-detail-action-grid">
            <article className="gangi-today-detail-action-card" data-tone="go">
              <div className="gangi-detail-kicker">오늘 해볼 일</div>
              <h2>{easyResultCopy(report.primaryAction.title)}</h2>
              <p>{easyResultCopy(report.primaryAction.description, 2)}</p>
            </article>

            <article className="gangi-today-detail-action-card" data-tone="stop">
              <div className="gangi-detail-kicker">오늘 줄일 일</div>
              <h2>{easyResultCopy(report.cautionAction.title)}</h2>
              <p>{easyResultCopy(report.cautionAction.description, 2)}</p>
            </article>
          </div>

          <div className="gangi-today-detail-section-title">흐름을 조금 더 보면</div>
          <div className="gangi-today-detail-timeline">
            {report.timeline.map((item) => (
              <article key={item.label}>
                <div className="gangi-detail-kicker">{item.label}</div>
                <h3>{easyResultCopy(item.headline)}</h3>
                <p>{easyResultCopy(item.body, 2)}</p>
              </article>
            ))}
          </div>

          <div className="gangi-today-detail-section-title">분야별로 짧게</div>
          <div className="gangi-today-detail-score-grid">
            {scoreCards.map((score) => (
              <article
                key={score.key}
                className="gangi-today-detail-score-card"
              >
                <div>{score.displayLabel}</div>
                <p>{score.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="gangi-paid-detail-actions">
          <Link href={`/saju/${encodeURIComponent(slug)}`}>무료 요약 다시 보기</Link>
          <Link href="/my/results" data-primary="true">보관함에서 다시 보기</Link>
        </div>

        <SafetyNotice variant="general" />
      </AppPage>
    </AppShell>
  );
}
