import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { SafetyNotice } from '@/components/common/safety-notice';
import { buildSajuReport } from '@/domain/saju/report';
import type { ReportScore, SajuReport } from '@/domain/saju/report';
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

function uniqueNonEmpty(items: Array<string | null | undefined>, max = 3) {
  return [...new Set(items.filter((item): item is string => Boolean(item && item.trim().length > 0)))].slice(0, max);
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

function buildKeyThemes(report: SajuReport) {
  return uniqueNonEmpty(report.summaryHighlights.map((item) => easyResultCopy(item)), 3);
}

function buildCautionPatterns(report: SajuReport) {
  return uniqueNonEmpty(
    [
      report.cautionAction.description,
      ...report.evidenceCards
        .filter((card) => ['relations', 'gongmang', 'specialSals'].includes(card.key))
        .map((card) => card.body),
    ],
    3
  ).map((item) => easyResultCopy(item));
}

function buildFavorableChoices(report: SajuReport) {
  return uniqueNonEmpty(
    [
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
      summary: easyResultCopy(score.summary),
    }));
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
          <section className="rounded-[1.8rem] border border-[var(--app-line)] bg-white p-6 text-center shadow-[0_14px_42px_rgba(15,23,42,0.06)]">
            <div className="text-sm font-bold text-[var(--app-pink-strong)]">구매 후 열람</div>
            <h1 className="mt-3 text-2xl font-semibold leading-9 text-[var(--app-ink)]">
              이 풀이는 550원 결제 후 열립니다
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
              이미 결제했다면 같은 계정으로 로그인한 뒤 다시 열어주세요.
            </p>
            <Link
              href={checkoutHref}
              className="mt-5 inline-flex rounded-full bg-[var(--app-pink)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(236,72,153,0.28)]"
            >
              550원 결제하고 열기
            </Link>
          </section>
        </AppPage>
      </AppShell>
    );
  }

  const { input, sajuData } = reading;
  const report = buildSajuReport(input, sajuData, topic);
  const isTimeUnknown = input.unknownTime === true || input.hour === undefined;
  const scoreCards = buildScoreCards(report);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="오늘 자세히 보기" backHref={`/saju/${encodeURIComponent(slug)}`} />

        <section className="rounded-[1.8rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] p-5 shadow-[0_14px_38px_rgba(236,72,153,0.10)]">
          <div className="text-sm font-bold text-[var(--app-pink-strong)]">구매한 풀이</div>
          <h1 className="mt-3 text-2xl font-semibold leading-9 text-[var(--app-ink)]">
            오늘은 이 부분만 더 보면 충분해요
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
            긴 설명보다 오늘 바로 써먹을 말과 행동만 짧게 정리했습니다.
          </p>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--app-line)] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
          <div className="text-sm font-bold text-[var(--app-pink-strong)]">한눈에 보는 핵심</div>
          <h2 className="mt-3 text-2xl font-semibold leading-9 text-[var(--app-ink)]">
            {easyResultCopy(report.headline)}
          </h2>
          {isTimeUnknown ? (
            <p className="mt-3 rounded-[1rem] bg-[var(--app-pink-soft)] px-4 py-3 text-sm leading-7 text-[var(--app-copy)]">
              태어난 시간이 정확하지 않아 시간에 민감한 풀이는 조심해서 읽습니다.
            </p>
          ) : null}
          <div className="mt-5 grid gap-3">
            {[
              { title: '조심할 것', items: buildCautionPatterns(report) },
              { title: '해볼 것', items: buildFavorableChoices(report) },
              { title: '더 볼 주제', items: buildKeyThemes(report) },
            ].map((group) => (
              <article key={group.title} className="rounded-[1.1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
                <div className="text-sm font-bold text-[var(--app-pink-strong)]">{group.title}</div>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--app-copy)]">
                  {group.items.map((item) => (
                    <li key={`${group.title}-${item}`}>• {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          <article className="rounded-[1.3rem] border border-[var(--app-line)] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-bold text-[var(--app-pink-strong)]">오늘 해볼 일</div>
            <h2 className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
              {easyResultCopy(report.primaryAction.title)}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">
              {easyResultCopy(report.primaryAction.description, 2)}
            </p>
          </article>

          <article className="rounded-[1.3rem] border border-[var(--app-line)] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-bold text-[var(--app-pink-strong)]">오늘 줄일 일</div>
            <h2 className="mt-3 text-xl font-semibold leading-8 text-[var(--app-ink)]">
              {easyResultCopy(report.cautionAction.title)}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">
              {easyResultCopy(report.cautionAction.description, 2)}
            </p>
          </article>
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-xl font-semibold text-[var(--app-ink)]">흐름을 조금 더 보면</h2>
          {report.timeline.map((item) => (
            <article
              key={item.label}
              className="rounded-[1.3rem] border border-[var(--app-line)] bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
            >
              <div className="text-sm font-bold text-[var(--app-pink-strong)]">{item.label}</div>
              <h3 className="mt-2 text-lg font-semibold leading-7 text-[var(--app-ink)]">
                {easyResultCopy(item.headline)}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">
                {easyResultCopy(item.body, 2)}
              </p>
            </article>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-xl font-semibold text-[var(--app-ink)]">분야별로 짧게</h2>
          <div className="grid grid-cols-2 gap-3">
            {scoreCards.map((score) => (
              <article
                key={score.key}
                className="rounded-[1.2rem] border border-[var(--app-line)] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
              >
                <div className="text-sm font-bold text-[var(--app-pink-strong)]">{score.displayLabel}</div>
                <p className="mt-3 text-sm font-semibold leading-7 text-[var(--app-ink)]">{score.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <SafetyNotice variant="general" />
      </AppPage>
    </AppShell>
  );
}
