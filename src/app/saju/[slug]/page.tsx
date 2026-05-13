import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { TrackedLink } from '@/components/common/tracked-link';
import { SajuResultViewTracker } from '@/features/saju-detail/saju-result-view-tracker';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getSajuTodayDetailEntitlement } from '@/lib/saju/today-detail-access';
import {
  buildSajuTodayDetailCheckoutHref,
  buildSajuTodayDetailHref,
} from '@/lib/saju/today-detail-links';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { Element } from '@/lib/saju/types';
import { resolveReading } from '@/lib/saju/readings';
import { buildPunchReading, buildSajuReport } from '@/domain/saju/report';
import type { ReportScore, SajuReport } from '@/domain/saju/report';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { formatPriceLabel } from '@/lib/payments/catalog';

// P1-2 fix (audit 2026-05-13): "오늘 자세히 보기 · 550원" 하드코딩 → catalog SSOT
const TODAY_DETAIL_PRICE = formatPriceLabel('taste_today_detail');

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
}

export async function generateMetadata(_: Props): Promise<Metadata> {
  return {
    title: '사주 분석 결과',
    description: '개인 사주 분석 결과 페이지입니다.',
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

function formatBirthSummary(input: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  gender?: 'male' | 'female';
  birthLocation?: { label: string } | null;
  solarTimeMode?: string;
}) {
  const minuteLabel =
    input.hour !== undefined && input.minute !== undefined
      ? ` ${String(input.minute).padStart(2, '0')}분`
      : '';
  const timeLabel = input.hour !== undefined ? `${input.hour}시${minuteLabel}` : '태어난 시간 미입력';
  const genderLabel = input.gender
    ? input.gender === 'male'
      ? '남성'
      : '여성'
    : '성별 미선택';
  const locationLabel = input.birthLocation?.label
    ? `${input.birthLocation.label}${input.solarTimeMode === 'longitude' ? ' 경도 보정' : ''}`
    : '출생 지역 미입력';
  return `${input.year}년 ${input.month}월 ${input.day}일 · ${timeLabel} · ${genderLabel} · ${locationLabel}`;
}

function easyResultCopy(value: string | null | undefined, maxSentences?: number) {
  const cleaned = simplifySajuCopy(value)
    .replace(/[甲乙丙丁戊己庚辛壬癸]\s*타고난 기질은/gu, '이 사주는')
    .replace(/[甲乙丙丁戊己庚辛壬癸]\s*타고난 기질/gu, '타고난 기질')
    .replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/gu, '')
    .replace(/사주 구조/gu, '내 사주')
    .replace(/타고난 역할 흐름/gu, '반복되는 역할')
    .replace(/보완 기운/gu, '보완할 점')
    .replace(/기운의 균형/gu, '컨디션 균형')
    .replace(/이번 달 흐름/gu, '이번 달 분위기')
    .replace(/올해 흐름/gu, '올해 분위기')
    .replace(/큰 흐름/gu, '긴 흐름')
    .replace(/(올해 분위기|이번 달 분위기|긴 흐름)이/gu, '$1가')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!maxSentences) return cleaned;

  const sentences = cleaned
    .split(/(?<=[.!?。])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length > 0 ? sentences.slice(0, maxSentences).join(' ') : cleaned;
}

const COMPACT_ELEMENT_ORDER: Element[] = ['목', '화', '토', '금', '수'];

const ELEMENT_PUBLIC_LABELS: Record<Element, string> = {
  목: '성장',
  화: '표현',
  토: '안정',
  금: '정리',
  수: '생각',
};

const FIELD_CARD_PHRASES: Record<
  ReportScore['key'] | 'health',
  Record<Element, string>
> = {
  overall: {
    목: '새 시작 작게',
    화: '표현 먼저',
    토: '정리부터',
    금: '기준 세우기',
    수: '잠깐 멈춤',
  },
  love: {
    목: '가볍게 시작',
    화: '마음 표현',
    토: '약속 지키기',
    금: '말투 부드럽게',
    수: '반응 기다리기',
  },
  wealth: {
    목: '새 지출 줄이기',
    화: '충동 결제 주의',
    토: '고정비 정리',
    금: '가격 비교 먼저',
    수: '자료 보고 결정',
  },
  career: {
    목: '새 제안 준비',
    화: '성과 드러내기',
    토: '할 일 고정',
    금: '우선순위 정리',
    수: '자료 확인',
  },
  relationship: {
    목: '먼저 안부',
    화: '따뜻하게 표현',
    토: '약속 확인',
    금: '선 넘지 않기',
    수: '조용히 듣기',
  },
  health: {
    목: '가볍게 움직이기',
    화: '과열 줄이기',
    토: '식사 리듬',
    금: '몸 정리하기',
    수: '수면 먼저',
  },
};

const COMPACT_RESULT_CARD_FALLBACKS: Array<{
  key: ReportScore['key'] | 'health';
  label: string;
  color: string;
  fallback: string;
  scoreKey?: ReportScore['key'];
}> = [
  { key: 'wealth', label: '재물', color: '#D59B2E', fallback: '지출 정리 먼저', scoreKey: 'wealth' },
  { key: 'love', label: '연애', color: '#E05298', fallback: '천천히 맞추기', scoreKey: 'love' },
  { key: 'career', label: '직업', color: '#3F8796', fallback: '말 정리부터', scoreKey: 'career' },
  { key: 'health', label: '건강', color: '#5C8A63', fallback: '수면 챙기기' },
];

function formatTodayLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
    .format(new Date())
    .replace(/\.\s?/g, '.')
    .replace(/\.\s*\(/u, ' (')
    .replace(/\s*\((.)\)/u, ' ($1)');
}

function getScoreStatus(score: number | null | undefined) {
  if (typeof score !== 'number') return '확인';
  if (score >= 75) return '좋음';
  if (score >= 60) return '무난';
  if (score >= 45) return '점검';
  return '천천히';
}

function getOverallScore(report: SajuReport) {
  return report.scores.find((score) => score.key === 'overall')?.score ?? null;
}

function toCompactCardPhrase(value: string | null | undefined, fallback: string) {
  const cleaned = easyResultCopy(value, 1)
    .replace(/입니다\.?$/u, '')
    .replace(/합니다\.?$/u, '')
    .replace(/좋습니다\.?$/u, '좋음')
    .replace(/괜찮은 흐름/u, '괜찮음')
    .trim();
  const firstChunk = cleaned.split(/[,.]/u)[0]?.trim() ?? '';

  if (firstChunk.length > 0 && firstChunk.length <= 16) return firstChunk;
  if (/지출|소비/u.test(cleaned)) return '지출 정리 먼저';
  if (/투자|보수/u.test(cleaned)) return '새 투자 천천히';
  if (/기회|수익/u.test(cleaned)) return '작은 기회 잡기';
  if (/표현/u.test(cleaned)) return '표현해도 좋음';
  if (/조율|거리감|분위기/u.test(cleaned)) return '분위기 조율';
  if (/성과|발표|제안/u.test(cleaned)) return '성과 보여주기';
  if (/커뮤니케이션|말|소통/u.test(cleaned)) return '말 정리부터';
  if (/속도|무리|피로|수면|생활/u.test(cleaned)) return '무리하지 않기';

  return fallback;
}

function getCompactScoreText(score: ReportScore | undefined, fallback: string) {
  return toCompactCardPhrase(score?.summary, fallback);
}

function getReportComputed(report: SajuReport) {
  return report.evidenceCards.find((card) => card.computed.fiveElementRatio || card.computed.dayMaster)?.computed;
}

function getSupportElement(report: SajuReport): Element | null {
  const yongsin = getReportComputed(report)?.yongsin?.[0];
  const matched = yongsin?.match(/[목화토금수]/u)?.[0] as Element | undefined;
  return matched ?? null;
}

function getWeakElement(report: SajuReport): Element | null {
  const ratio = getReportComputed(report)?.fiveElementRatio;
  if (!ratio) return null;

  const sorted = (Object.entries(ratio) as [Element, number][])
    .filter(([, value]) => Number.isFinite(value))
    .sort((a, b) => a[1] - b[1]);

  return sorted[0]?.[0] ?? null;
}

function getFieldCardValue(
  key: ReportScore['key'] | 'health',
  report: SajuReport,
  score: ReportScore | undefined,
  fallback: string
) {
  const element = key === 'health' ? getWeakElement(report) : getSupportElement(report);
  if (element) return FIELD_CARD_PHRASES[key][element];
  return getCompactScoreText(score, fallback);
}

function buildCompactResultCards(report: SajuReport) {
  const scoreByKey = new Map(report.scores.map((score) => [score.key, score]));
  const healthSource =
    report.cautionAction.description ||
    report.evidenceCards.find((card) => card.key === 'strength')?.practicalActions?.[0] ||
    report.evidenceCards.find((card) => card.key === 'yongsin')?.plainSummary;

  return COMPACT_RESULT_CARD_FALLBACKS.map((item) => ({
    ...item,
    value:
      item.key === 'health'
        ? getFieldCardValue(item.key, report, undefined, toCompactCardPhrase(healthSource, item.fallback))
        : getFieldCardValue(
            item.key,
            report,
            item.scoreKey ? scoreByKey.get(item.scoreKey) : undefined,
            item.fallback
          ),
  }));
}

export default async function SajuResultPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { topic } = await searchParams;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { input, sajuData } = reading;
  const report = buildSajuReport(input, sajuData, topic);

  const pillars = [
    { label: '년', pillar: sajuData.pillars.year },
    { label: '월', pillar: sajuData.pillars.month },
    { label: '일', pillar: sajuData.pillars.day },
    { label: '시', pillar: sajuData.pillars.hour },
  ];
  const punchReading = buildPunchReading(report);
  const todayDetailEntitlement = await getSajuTodayDetailEntitlement(slug);
  const todayDetailHref = todayDetailEntitlement
    ? buildSajuTodayDetailHref(slug)
    : buildSajuTodayDetailCheckoutHref(slug);
  const compactResultCards = buildCompactResultCards(report);
  const overallScore = getOverallScore(report);
  const focusScore = report.scores.find((score) => score.key === report.focusScoreKey);
  const todayLabel = formatTodayLabel();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <SajuResultViewTracker slug={slug} />

        <div className="space-y-5 sm:space-y-6">
        <GangiPageHeader title="사주" backHref="/saju/new" />
        <SajuScreenNav slug={slug} current="result" />

        <section className="space-y-4">
          <article className="gangi-result-pillars relative overflow-hidden rounded-[1.8rem] bg-[#28243b] p-5 text-white shadow-[0_18px_46px_rgba(40,36,59,0.18)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(255,211,76,0.28),transparent_18%),radial-gradient(circle_at_52%_8%,rgba(255,211,76,0.26),transparent_4%)]" />
            <div className="relative">
              <div className="text-sm font-semibold text-[#ffd24d]">{report.focusBadge} · 사주팔자</div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {pillars.map((item) => {
                  const pillar = item.pillar;
                  return (
                    <div
                      key={item.label}
                      className="rounded-[1.1rem] border border-white/14 bg-white/7 px-2 py-3 text-center"
                    >
                      <div className="text-xs font-semibold text-white/55">{item.label}주</div>
                      <div className="mt-3 text-3xl font-light leading-none text-white sm:text-4xl">
                        {pillar?.stem ?? '-'}
                      </div>
                      <div className="mt-3 text-3xl font-light leading-none text-white sm:text-4xl">
                        {pillar?.branch ?? '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-xs leading-5 text-white/58">{formatBirthSummary(input)}</p>
            </div>
          </article>

          <article className="gangi-result-summary-card rounded-[1.6rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] p-5 shadow-[0_14px_38px_rgba(236,72,153,0.10)]">
            <div className="gangi-result-date">{todayLabel}</div>
            <div className="text-sm font-medium text-[var(--app-pink-strong)]">한 줄 요약</div>
            <h1 className="mt-3 text-[1.42rem] font-medium leading-[1.5] tracking-[-0.01em] text-[var(--app-ink)] sm:text-[1.7rem]">
              {easyResultCopy(punchReading.verdict, 1)}
            </h1>
            {punchReading.personalPoints.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {punchReading.personalPoints.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-[var(--app-pink-line)] bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--app-pink-strong)]"
                  >
                    {point}
                  </span>
                ))}
              </div>
            ) : null}
          </article>

          <article className="gangi-result-score-strip" aria-label="오늘 점수와 키워드">
            <div>
              <span>오늘 점수</span>
              <strong>{overallScore ?? '--'}{overallScore !== null ? <em>점</em> : null}</strong>
            </div>
            <div>
              <span>상태</span>
              <strong>{getScoreStatus(overallScore)}</strong>
            </div>
            <div>
              <span>키워드</span>
              <strong>{focusScore?.label ?? report.focusBadge}</strong>
            </div>
          </article>

          <div className="gangi-result-quick-grid">
            {[
              { label: '왜', value: punchReading.why },
              { label: '조심', value: punchReading.caution },
              { label: '오늘 할 일', value: punchReading.action },
            ].map((item) => (
              <article
                key={item.label}
                className="rounded-[1.1rem] border border-[var(--app-line)] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
              >
                <div className="text-xs font-semibold text-[var(--app-pink-strong)]">{item.label}</div>
                <p className="mt-1 text-[0.95rem] font-medium leading-6 text-[var(--app-ink)]">
                  {easyResultCopy(item.value, 1)}
                </p>
              </article>
            ))}
          </div>

          <article className="gangi-result-elements-card rounded-[1.35rem] border border-[var(--app-line)] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--app-ink)]">오행 균형</h2>
              {getSupportElement(report) ? (
                <span className="rounded-full bg-[var(--app-pink-soft)] px-3 py-1 text-xs font-medium text-[var(--app-pink-strong)]">
                  오늘 힌트 {ELEMENT_PUBLIC_LABELS[getSupportElement(report)!]}
                </span>
              ) : null}
            </div>
            <div className="mt-5 grid grid-cols-5 gap-3">
              {COMPACT_ELEMENT_ORDER.map((element) => {
                const value = sajuData.fiveElements.byElement[element].percentage;
                const height = `${Math.max(18, Math.min(100, Math.round(value)))}%`;
                return (
                  <div key={element} className="flex flex-col items-center gap-2">
                    <div className="flex h-20 w-full items-end overflow-hidden rounded-xl bg-[var(--app-surface-muted)]">
                      <div
                        className="w-full rounded-xl"
                        style={{ height, backgroundColor: ELEMENT_INFO[element].color }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-[var(--app-ink)]">{element}</span>
                  </div>
                );
              })}
            </div>
          </article>

          <div className="grid grid-cols-2 gap-3">
            {compactResultCards.map((item) => (
              <article
                key={item.label}
                className="gangi-result-mini-card rounded-[1.2rem] border border-[var(--app-line)] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-copy)]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
                <p className="mt-3 text-lg font-semibold leading-7 text-[var(--app-ink)]">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="gangi-result-flow-strip" aria-label="풀이 흐름">
            <span data-active="true">총평</span>
            <span>상세</span>
            <span>명식</span>
          </div>

          <article className="gangi-result-next-step rounded-[1.55rem] bg-[var(--app-ink)] p-5 text-white shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
            <p className="text-sm font-semibold text-white/72">더 깊게 보고 싶다면</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">오늘 자세히 보기 · {TODAY_DETAIL_PRICE}</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              시간별로 무엇을 하면 좋을지만 짧게 정리해드려요.
            </p>
            <TrackedLink
              href={todayDetailHref}
              eventName="report_deep_report_click"
              eventParams={{
                slug,
                product: 'today-detail',
                from: 'result_compact_card',
                purchased: Boolean(todayDetailEntitlement),
              }}
              className="mt-5 inline-flex rounded-full bg-[var(--app-pink)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(236,72,153,0.28)]"
            >
              {todayDetailEntitlement ? '구매한 풀이 열기' : '풀이 열기'}
            </TrackedLink>
          </article>
        </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
