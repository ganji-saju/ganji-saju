// Redesign 2026-05-13 (Claude Design / screens-e.jsx ScreenZodiacDetail):
// 띠 상세 — gradient hero + 한자 워터마크 + ZodiacChip + period tabs + 점수 + 키워드 + 분야별 + 다른 띠.
// 데이터(ZODIAC_FORTUNES / personalization)·라우팅 무수정.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { ZODIAC_META } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  ZODIAC_FORTUNES,
  type ZodiacByYearFortune,
  type ZodiacFortune,
} from '@/lib/free-content-pages';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug, buildZodiacSlugFromProfile } from '@/lib/profile-personalization';
import { ZODIAC_RELATIONS, type ZodiacFortuneSlug } from '@/lib/zodiac/zodiac-relations';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { buildContentPageMetadata } from '@/lib/seo/page-metadata';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  serializeStructuredData,
} from '@/lib/seo/structured-data';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { getKstParts, getKstStartOfDay } from '@/shared/utils/kst';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string; birthYear?: string }>;
}

// /zodiac/[slug] uses 'goat' for 양띠; ZodiacChip uses 'sheep'
const SLUG_TO_ZODIAC: Record<string, ZodiacKey> = {
  rat: 'rat', ox: 'ox', tiger: 'tiger', rabbit: 'rabbit',
  dragon: 'dragon', snake: 'snake', horse: 'horse', goat: 'sheep',
  monkey: 'monkey', rooster: 'rooster', dog: 'dog', pig: 'pig',
};

const ZODIAC_HANJA: Record<string, string> = {
  rat: '子', ox: '丑', tiger: '寅', rabbit: '卯',
  dragon: '辰', snake: '巳', horse: '午', goat: '未',
  monkey: '申', rooster: '酉', dog: '戌', pig: '亥',
};

const ZODIAC_GRADIENT: Record<string, string> = {
  rat: 'linear-gradient(135deg, #5b58d6 0%, #353399 100%)',
  ox: 'linear-gradient(135deg, #0f9f7a 0%, #07654c 100%)',
  tiger: 'linear-gradient(135deg, #ff6b6b 0%, #c4423a 100%)',
  rabbit: 'linear-gradient(135deg, #ff4f9a 0%, #d81b72 100%)',
  dragon: 'linear-gradient(135deg, #c04de0 0%, #9636af 100%)',
  snake: 'linear-gradient(135deg, #d99020 0%, #a06c14 100%)',
  horse: 'linear-gradient(135deg, #ff6b6b 0%, #c4423a 100%)',
  goat: 'linear-gradient(135deg, #0f9f7a 0%, #0d7a5e 100%)',
  monkey: 'linear-gradient(135deg, #d99020 0%, #a06c14 100%)',
  rooster: 'linear-gradient(135deg, #d81b72 0%, #a31354 100%)',
  dog: 'linear-gradient(135deg, #368ee8 0%, #1e6cbb 100%)',
  pig: 'linear-gradient(135deg, #5b58d6 0%, #353399 100%)',
};

const ZODIAC_ORDER: Array<{ slug: string; label: string; key: ZodiacKey }> = [
  { slug: 'rat', label: '쥐띠', key: 'rat' },
  { slug: 'ox', label: '소띠', key: 'ox' },
  { slug: 'tiger', label: '호랑이띠', key: 'tiger' },
  { slug: 'rabbit', label: '토끼띠', key: 'rabbit' },
  { slug: 'dragon', label: '용띠', key: 'dragon' },
  { slug: 'snake', label: '뱀띠', key: 'snake' },
  { slug: 'horse', label: '말띠', key: 'horse' },
  { slug: 'goat', label: '양띠', key: 'sheep' },
  { slug: 'monkey', label: '원숭이띠', key: 'monkey' },
  { slug: 'rooster', label: '닭띠', key: 'rooster' },
  { slug: 'dog', label: '개띠', key: 'dog' },
  { slug: 'pig', label: '돼지띠', key: 'pig' },
];

// 2026-05-15 — 기간 (today/week/month/year) 별로 다른 시드 → 진짜 다른 점수 노출.
// 기존엔 'today' 만 작동, 나머지 탭은 클릭 자체 안 됐던 회귀 fix.
// 2026-05-18 — Phase 2: raw new Date().getDate() (UTC) → getKstParts() (KST) 교체.
//   기존 코드는 Vercel UTC 기준이라 KST 00:00 ~ 09:00 사이에 어제 점수 노출 (audit P0 #3).
type ZodiacPeriod = 'today' | 'week' | 'month' | 'year';

function periodSeed(period: ZodiacPeriod): number {
  const parts = getKstParts();
  switch (period) {
    case 'today':
      return parts.day;
    case 'week': {
      // KST 1월 1일부터의 주차.
      const yearStart = getKstStartOfDay(new Date(Date.UTC(parts.year, 0, 1)));
      const todayStart = getKstStartOfDay();
      const daysFromYearStart = Math.floor(
        (todayStart.getTime() - yearStart.getTime()) / 86_400_000
      );
      return Math.floor(daysFromYearStart / 7);
    }
    case 'month':
      return parts.month;
    case 'year':
      return parts.year % 100;
    default:
      return parts.day;
  }
}

function getDailyScores(slug: string, period: ZodiacPeriod = 'today') {
  const seed = slug.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const periodValue = periodSeed(period);
  // 기간별 가중치 다르게 — 매주/매월/매해 다른 점수 보장.
  const periodWeight = period === 'today' ? 1 : period === 'week' ? 11 : period === 'month' ? 23 : 37;
  const base = (seed + periodValue * periodWeight) % 20;
  return {
    overall: 60 + ((seed * 7 + periodValue * periodWeight * 3) % 35),
    love: 60 + ((seed * 11 + periodValue * periodWeight * 5) % 35),
    wealth: 60 + ((seed * 13 + periodValue * periodWeight * 7) % 35),
    health: 60 + ((seed * 17 + periodValue * periodWeight) % 35),
    seed: base,
  };
}

const PERIOD_LABEL: Record<ZodiacPeriod, string> = {
  today: '오늘 한 줄',
  week: '이번 주 흐름',
  month: '이번 달 흐름',
  year: '올해 흐름',
};

// 카드 제목·라벨용 짧은 기간 이름(탭 라벨과 일치).
const PERIOD_SHORT: Record<ZodiacPeriod, string> = {
  today: '오늘',
  week: '이번 주',
  month: '이번 달',
  year: '올해',
};

const VALID_PERIODS: ZodiacPeriod[] = ['today', 'week', 'month', 'year'];

function normalizePeriod(value: string | undefined): ZodiacPeriod {
  return VALID_PERIODS.includes(value as ZodiacPeriod) ? (value as ZodiacPeriod) : 'today';
}

// 2026-05-24 — 연생(태어난 해)별 풀이. byYear 가 있는 띠만 ?birthYear=YYYY 로 분기.
//   - 정렬: 최근 출생연도부터(기존 years 표기 순서와 동일한 직관).
//   - 미선택/미존재 연도면 null → 기존 단일 띠 화면 그대로.
function getByYearEntries(item: ZodiacFortune): Array<[number, ZodiacByYearFortune]> {
  if (!item.byYear) return [];
  return Object.entries(item.byYear)
    .map(([year, fortune]) => [Number(year), fortune] as [number, ZodiacByYearFortune])
    .sort((a, b) => b[0] - a[0]);
}

function resolveSelectedYear(item: ZodiacFortune, raw: string | undefined): number | null {
  if (!item.byYear || !raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && item.byYear[parsed] ? parsed : null;
}

const LUCKY_COLOR_TABLE: Array<{ name: string; hex: string }> = [
  { name: '핑크', hex: '#ff4f9a' },
  { name: '코랄', hex: '#ff6b6b' },
  { name: '터쿼이즈', hex: '#0f9f7a' },
  { name: '하늘', hex: '#368ee8' },
  { name: '엠버', hex: '#d99020' },
  { name: '인디고', hex: '#5b58d6' },
  { name: '플럼', hex: '#c04de0' },
];

const LUCKY_DIRECTIONS = ['동', '서', '남', '북', '동남', '서남', '북동', '북서'] as const;
const LUCKY_TIMES = [
  '오전 7시',
  '오전 10시',
  '오후 12시',
  '오후 3시',
  '오후 6시',
  '오후 9시',
] as const;

function getZodiac(slug: string) {
  return ZODIAC_FORTUNES.find((item) => item.slug === slug);
}

export async function generateStaticParams() {
  return ZODIAC_FORTUNES.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getZodiac(slug);
  if (!item) return { title: '내 띠 운세' };
  return buildContentPageMetadata({
    title: `${item.label} 운세`,
    description: `${item.label}의 오늘 포인트와 가볍게 실천할 행동을 확인하는 간지사주 띠운세입니다.`,
    path: `/zodiac/${item.slug}`,
  });
}

export default async function ZodiacDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { period: rawPeriod, birthYear: rawBirthYear } = await searchParams;
  const period = normalizePeriod(rawPeriod);
  const item = getZodiac(slug);
  if (!item) notFound();

  // 2026-05-24 — 연생 풀이: byYear 가 있는 띠(12지 전체)만 칩 노출.
  const byYearEntries = getByYearEntries(item);
  const selectedYear = resolveSelectedYear(item, rawBirthYear);
  const selectedByYear = selectedYear !== null ? item.byYear?.[selectedYear] ?? null : null;

  const profile = await getOptionalSignedInProfile();
  const personalizedSlug = buildZodiacSlugFromProfile(profile);
  const readingSlug = buildProfileReadingSlug(profile);
  const personalizedItem =
    personalizedSlug ? ZODIAC_FORTUNES.find((entry) => entry.slug === personalizedSlug) ?? null : null;

  // 2026-05-15 — 사용자 프로필 띠로 강제 redirect 되던 회귀 fix.
  // 닭띠 프로필 사용자가 용띠 클릭해도 닭띠로 튕겨 가서 "다른 띠가 작동 안 함" 으로
  // 느낌. 사용자가 명시적으로 특정 띠 URL 을 열었으면 그 띠 페이지를 그대로 보여줌.
  // 내 띠와 일치하는지 여부는 isPersonalizedMatch 로만 표시.

  const isPersonalizedMatch = personalizedSlug === item.slug;
  const meta = ZODIAC_META[item.slug as keyof typeof ZODIAC_META];
  const zodiacKey = SLUG_TO_ZODIAC[item.slug] ?? 'dragon';
  const hanja = ZODIAC_HANJA[item.slug] ?? '辰';
  const gradient = ZODIAC_GRADIENT[item.slug] ?? ZODIAC_GRADIENT.dragon;
  const scores = getDailyScores(item.slug, period);
  const luckyColor = LUCKY_COLOR_TABLE[scores.seed % LUCKY_COLOR_TABLE.length];
  const luckyDirection = LUCKY_DIRECTIONS[scores.seed % LUCKY_DIRECTIONS.length];
  const luckyTime = LUCKY_TIMES[scores.seed % LUCKY_TIMES.length];
  const luckyNumber = ((scores.seed * 3) % 9) + 1;

  const scoreCells = [
    { label: '총운', value: scores.overall, color: 'var(--app-pink-strong)' },
    { label: '연애', value: scores.love, color: 'var(--app-coral)' },
    { label: '재물', value: scores.wealth, color: 'var(--app-amber)' },
    { label: '건강', value: scores.health, color: 'var(--app-jade)' },
  ];

  // 2026-05-20 Phase 8-A — JSON-LD Article + Breadcrumb schema for SERP rich result.
  const articleSchema = buildArticleSchema({
    headline: `${item.label} 운세`,
    description: `${item.label}의 오늘 포인트와 가볍게 실천할 행동을 확인하는 간지사주 띠운세입니다.`,
    path: `/zodiac/${item.slug}`,
    articleSection: '띠 운세',
  });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: '홈', path: '/' },
    { name: '띠운세', path: '/zodiac' },
    { name: item.label, path: `/zodiac/${item.slug}` },
  ]);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(articleSchema) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(breadcrumbSchema) }}
        />
        <GangiPageHeader title={`${item.label} 운세`} backHref="/zodiac" />

        <section className="space-y-5 px-1">
          {/* §1 Hero gradient */}
          <article
            className="relative overflow-hidden rounded-[22px] p-5 text-white"
            style={{ background: gradient }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -top-3 select-none leading-none"
              style={{
                fontFamily: 'var(--font-han)',
                fontSize: 180,
                fontWeight: 700,
                color: '#fff',
                opacity: 0.12,
              }}
            >
              {hanja}
            </div>

            <div
              className="relative text-[11px] font-extrabold uppercase tracking-[0.06em]"
              style={{ opacity: 0.85 }}
            >
              ZODIAC · {hanja} / {zodiacKey.toUpperCase()}
            </div>

            <div className="relative mt-2.5 flex items-end gap-3">
              <ZodiacChip kind={zodiacKey} size="xl" />
              <div>
                <div className="text-[22px] font-extrabold tracking-tight">{item.label}</div>
                <div className="mt-0.5 text-[12px]" style={{ opacity: 0.85 }}>
                  {item.years}
                </div>
              </div>
            </div>

            <div
              className="relative mt-4 rounded-[12px] p-3.5"
              style={{
                background: 'rgba(255,255,255,0.16)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <div
                className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                style={{ opacity: 0.85 }}
              >
                {PERIOD_LABEL[period]}
              </div>
              {/* 2026-05-25 — 라벨(오늘/이번주/이번달/올해)과 내용이 어긋나던 회귀 fix.
                  고정 summary → 기간별 한 줄(periodLines[period])로 교체. */}
              <p className="mt-1 text-[14px] font-bold leading-[1.55]">{item.periodLines[period]}</p>
            </div>

            {isPersonalizedMatch ? (
              <div
                className="relative mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                ★ 내 띠로 맞춤 표시
              </div>
            ) : null}
          </article>

          {/* §2 Period tabs — 2026-05-15: 4개 기간 모두 클릭 가능. searchParam 기반 활성. */}
          <div className="flex gap-1.5">
            {([
              { key: 'today', label: '오늘' },
              { key: 'week', label: '이번 주' },
              { key: 'month', label: '이번 달' },
              { key: 'year', label: '올해' },
            ] as Array<{ key: ZodiacPeriod; label: string }>).map((p) => {
              const isActive = p.key === period;
              // 2026-05-24 — 연생 선택 시 기간 탭 전환에도 birthYear 유지.
              const query = [
                p.key === 'today' ? null : `period=${p.key}`,
                selectedYear !== null ? `birthYear=${selectedYear}` : null,
              ].filter(Boolean);
              const href = query.length > 0 ? `/zodiac/${item.slug}?${query.join('&')}` : `/zodiac/${item.slug}`;
              return (
                <Link
                  key={p.key}
                  href={href}
                  // 2026-05-25 — 같은 화면 내 기간 탭 전환 시 스크롤 위치 유지(맨 위로 튐 방지).
                  scroll={false}
                  className="flex-1 rounded-full border px-2 py-1.5 text-center text-[12px] font-bold transition-transform active:scale-95"
                  style={
                    isActive
                      ? {
                          background: 'var(--app-pink)',
                          color: '#fff',
                          borderColor: 'var(--app-pink)',
                        }
                      : {
                          background: '#fff',
                          color: 'var(--app-copy-muted)',
                          borderColor: 'var(--app-line)',
                        }
                  }
                >
                  {p.label}
                </Link>
              );
            })}
          </div>

          {/* §3 점수 4-card grid */}
          <div className="grid grid-cols-4 gap-2">
            {scoreCells.map((cell) => (
              <article
                key={cell.label}
                className="rounded-[14px] border border-[var(--app-line)] bg-white p-3 text-center"
              >
                <div className="text-[11px] font-bold text-[var(--app-copy-soft)]">
                  {cell.label}
                </div>
                <div
                  className="mt-0.5 text-[22px] font-extrabold tracking-tighter"
                  style={{ color: cell.color }}
                >
                  {cell.value}
                </div>
                <div
                  className="mt-1.5 h-0.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--app-line)' }}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${cell.value}%`, background: cell.color }}
                  />
                </div>
              </article>
            ))}
          </div>

          {/* §4 운세 키워드 — pink-soft */}
          <article
            className="rounded-[14px] border p-4"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              {PERIOD_SHORT[period]} 운세 키워드
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                {
                  label: '행운의 색',
                  value: luckyColor.name,
                  swatch: luckyColor.hex,
                },
                { label: '행운의 숫자', value: String(luckyNumber) },
                { label: '행운의 방위', value: luckyDirection },
                { label: '행운의 시간', value: luckyTime },
                { label: `${PERIOD_SHORT[period]} 집중`, value: item.periodFocus[period] },
                { label: '권하는 행동', value: '메모해두기' },
              ].map((cell) => (
                <div key={cell.label}>
                  <div className="text-[10.5px] font-bold text-[var(--app-copy-soft)]">
                    {cell.label}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--app-ink)]">
                    {cell.swatch ? (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: cell.swatch }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="truncate">{cell.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* §5 분야별 카드 */}
          <section className="grid gap-2.5">
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                {PERIOD_SHORT[period]} 집중 포인트
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--app-ink)]">
                {item.periodFocus[period]}
              </p>
            </article>
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                행동 제안
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--app-ink)]">
                {item.periodAction[period]}
              </p>
            </article>
            {period === 'year' ? (
              <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  올해 흐름
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--app-ink)]">
                  {meta.yearlyMessage}
                </p>
              </article>
            ) : null}
          </section>

          {/* 연생 풀이 — 2026-05-26: 운세 콘텐츠(기간 탭·점수·집중 포인트) 아래로 이동.
              태어난 해 선택은 심화 정보라 메인 흐름을 먼저 보여준 뒤 노출한다. */}
          {byYearEntries.length > 0 ? (
            <section className="space-y-2.5">
              <div className="px-1 text-[13px] font-extrabold text-[var(--app-ink)]">
                태어난 해로 더 보기
              </div>
              <div className="flex flex-wrap gap-1.5">
                {byYearEntries.map(([year]) => {
                  const isActive = year === selectedYear;
                  const href = isActive
                    ? `/zodiac/${item.slug}${period === 'today' ? '' : `?period=${period}`}`
                    : `/zodiac/${item.slug}?birthYear=${year}${period === 'today' ? '' : `&period=${period}`}`;
                  return (
                    <Link
                      key={year}
                      href={href}
                      // 2026-05-25 — 같은 화면 내 연생 칩 전환 시 스크롤 위치 유지(맨 위로 튐 방지).
                      scroll={false}
                      aria-pressed={isActive}
                      className="rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-transform active:scale-95 no-underline"
                      style={
                        isActive
                          ? {
                              background: 'var(--app-pink)',
                              color: '#fff',
                              borderColor: 'var(--app-pink)',
                            }
                          : {
                              background: '#fff',
                              color: 'var(--app-copy-muted)',
                              borderColor: 'var(--app-line)',
                            }
                      }
                    >
                      {year}년생
                    </Link>
                  );
                })}
              </div>
              {selectedByYear ? (
                <article
                  className="rounded-[14px] border p-4"
                  style={{
                    background: 'var(--app-pink-soft)',
                    borderColor: 'var(--app-pink-line)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                      {selectedYear}년생 · {item.label}
                    </div>
                    <span
                      className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-[var(--app-pink-strong)] border"
                      style={{ borderColor: 'var(--app-pink-line)' }}
                    >
                      {selectedByYear.element}
                    </span>
                  </div>
                  <p
                    className="mt-2 text-[14px] font-bold leading-[1.55] text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {selectedByYear.summary}
                  </p>
                  <p
                    className="mt-1.5 text-[13px] leading-[1.65] text-[var(--app-copy-muted)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {selectedByYear.detail}
                  </p>
                  <div
                    className="mt-2.5 rounded-[10px] bg-white px-3 py-2.5"
                    style={{ border: '1px solid var(--app-pink-line)' }}
                  >
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                      이렇게 해보세요
                    </div>
                    <p
                      className="mt-1 text-[12.5px] leading-[1.6] text-[var(--app-ink)]"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {selectedByYear.action}
                    </p>
                  </div>
                </article>
              ) : (
                <p className="px-1 text-[12px] leading-[1.55] text-[var(--app-copy-soft)]">
                  태어난 해를 선택하면 같은 {item.label} 안에서도 조금씩 다른 기운의 흐름을 볼 수 있어요.
                </p>
              )}
            </section>
          ) : null}

          {/* §6 사주로 이어보기 CTA */}
          {/* 2026-05-20 Phase 8-C — §궁합/조심할 띠 (12지 전통 호환 매트릭스). */}
          {(() => {
            const relation = ZODIAC_RELATIONS[item.slug as ZodiacFortuneSlug];
            if (!relation) return null;
            const slugToLabel = (slug: ZodiacFortuneSlug) =>
              ZODIAC_FORTUNES.find((z) => z.slug === slug)?.label ?? slug;
            return (
              <article
                className="rounded-[18px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  💞 궁합과 조심
                </div>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-bold text-[var(--app-jade)]">
                      궁합 좋은 띠
                    </div>
                    <p
                      className="mt-1 text-[12.5px] leading-[1.55] text-[var(--app-copy-muted)]"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {relation.matchSummary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {relation.idealMatches.map((slug) => (
                        <Link
                          key={slug}
                          href={`/zodiac/${slug}`}
                          className="rounded-full bg-[var(--app-pink-soft)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-pink-strong)] border no-underline"
                          style={{ borderColor: 'var(--app-pink-line)' }}
                        >
                          {slugToLabel(slug)}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-[var(--app-coral)]">
                      조심할 띠
                    </div>
                    <p
                      className="mt-1 text-[12.5px] leading-[1.55] text-[var(--app-copy-muted)]"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {relation.bewareSummary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {relation.bewareMatches.map((slug) => (
                        <Link
                          key={slug}
                          href={`/zodiac/${slug}`}
                          className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--app-copy-soft)] border no-underline"
                          style={{ borderColor: 'rgba(220,79,79,0.22)' }}
                        >
                          {slugToLabel(slug)}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })()}

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
              내 사주로 더 자세히 봐주세요
            </h2>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
              <Link
                href={readingSlug ? `/saju/${readingSlug}?from=zodiac` : '/saju/new?from=zodiac'}
                className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
              >
                {readingSlug ? '내 사주로 이어보기' : '맞춤 사주로 이어보기'} →
              </Link>
              <Link
                href="/zodiac"
                className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
              >
                내 띠 다시 확인
              </Link>
            </div>
            {/* 2026-05-20 Phase 8-E — PaidFunnelGrid 공통 컴포넌트로 추출 (DRY). */}
            <PaidFunnelGrid from="zodiac" tone="dark" className="mt-3" />
          </article>

          {/* §7 다른 띠 보기 — horizontal scroll */}
          <section>
            <div className="px-1 text-[15px] font-extrabold text-[var(--app-ink)]">
              다른 띠도 보기
            </div>
            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {ZODIAC_ORDER.filter((z) => z.slug !== item.slug).map((z) => (
                <Link
                  key={z.slug}
                  href={`/zodiac/${z.slug}`}
                  className="flex w-[60px] shrink-0 flex-col items-center gap-1.5 rounded-[12px] py-2 text-center"
                >
                  <ZodiacChip kind={z.key} size="sm" />
                  <span className="text-[11px] font-bold text-[var(--app-copy-muted)]">
                    {z.label}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </AppPage>
    </AppShell>
  );
}
