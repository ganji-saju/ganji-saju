// Redesign 2026-05-13 (Claude Design / screens-c.jsx ScreenSajuDeep):
// 신설 /saju/[slug]/deep — 사주팔자 detail · 오행 donut · 십성 detail · 대운 timeline
// · 평생리포트 upsell 을 long-scroll 한 페이지로 보여주는 깊은 풀이 화면.
// 라우팅/이벤트 무수정 — 데이터는 기존 resolveReading + buildSajuReport 재사용.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { TrackedLink } from '@/components/common/tracked-link';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { resolveReading } from '@/lib/saju/readings';
import { buildSajuReport } from '@/domain/saju/report';
import type { Element } from '@/lib/saju/types';
import type {
  SajuDataV1,
  SajuMajorLuckCycle,
  TenGodCode,
} from '@/domain/saju/engine/saju-data-v1';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '깊은 사주 풀이',
    description: '사주팔자, 오행, 십성, 대운까지 한 화면에서 깊이 들여다보는 화면입니다.',
    robots: { index: false, follow: false },
    alternates: { canonical: '/saju' },
  };
}

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat',
  丑: 'ox',
  寅: 'tiger',
  卯: 'rabbit',
  辰: 'dragon',
  巳: 'snake',
  午: 'horse',
  未: 'sheep',
  申: 'monkey',
  酉: 'rooster',
  戌: 'dog',
  亥: 'pig',
};

const BRANCH_TO_HOUR_KOR: Record<string, string> = {
  子: '자시',
  丑: '축시',
  寅: '인시',
  卯: '묘시',
  辰: '진시',
  巳: '사시',
  午: '오시',
  未: '미시',
  申: '신시',
  酉: '유시',
  戌: '술시',
  亥: '해시',
};

const TEN_GOD_DESCRIPTIONS: Record<TenGodCode, string> = {
  비견: '자존·독립·동등한 동료',
  겁재: '협업·경쟁자·재물 분담',
  식신: '표현·먹을복·여유',
  상관: '재능 표현·기교·반항',
  편재: '큰 재물·기회·유동성',
  정재: '안정적인 재물·근면',
  편관: '도전·경쟁·외부 압력',
  정관: '책임·명예·체계',
  편인: '독창적 학습·직관',
  정인: '배움·도움받음·어머니적 보호',
};

const TEN_GOD_COLORS: Record<TenGodCode, string> = {
  비견: 'var(--app-indigo)',
  겁재: 'var(--app-amber)',
  식신: 'var(--app-pink)',
  상관: 'var(--app-pink-strong)',
  편재: 'var(--app-amber)',
  정재: 'var(--app-jade)',
  편관: 'var(--app-coral)',
  정관: 'var(--app-jade)',
  편인: 'var(--app-plum)',
  정인: 'var(--app-jade)',
};

const COMPACT_ELEMENT_ORDER: Element[] = ['목', '화', '토', '금', '수'];

function getYearZodiac(data: SajuDataV1): ZodiacKey {
  const branch = data.pillars.year.branch;
  return BRANCH_TO_ZODIAC[branch] ?? 'dragon';
}

function getHourLabel(data: SajuDataV1): string | null {
  const hourPillar = data.pillars.hour;
  const hourValue = data.input.birth.hour;
  if (!hourPillar || hourValue === null) return null;
  const kor = BRANCH_TO_HOUR_KOR[hourPillar.branch];
  return kor ? `${hourValue}시 (${kor})` : `${hourValue}시`;
}

function getDayMasterPillarLabel(data: SajuDataV1): string {
  return `${data.pillars.day.ganzi}일주`;
}

function getZodiacKorLabel(zodiac: ZodiacKey): string {
  const map: Record<ZodiacKey, string> = {
    rat: '쥐띠',
    ox: '소띠',
    tiger: '범띠',
    rabbit: '토끼띠',
    dragon: '용띠',
    snake: '뱀띠',
    horse: '말띠',
    sheep: '양띠',
    monkey: '원숭이띠',
    rooster: '닭띠',
    dog: '개띠',
    pig: '돼지띠',
  };
  return map[zodiac];
}

function getCurrentAge(data: SajuDataV1): number {
  const now = new Date();
  const birthYear = data.input.birth.year;
  const birthMonth = data.input.birth.month;
  const birthDay = data.input.birth.day;
  const beforeBirthday =
    now.getMonth() + 1 < birthMonth ||
    (now.getMonth() + 1 === birthMonth && now.getDate() < birthDay);
  return now.getFullYear() - birthYear - (beforeBirthday ? 1 : 0);
}

function isCurrentLuckCycle(cycle: SajuMajorLuckCycle, currentAge: number): boolean {
  if (cycle.startAge === null) return false;
  if (cycle.endAge === null) return currentAge >= cycle.startAge;
  return currentAge >= cycle.startAge && currentAge <= cycle.endAge;
}

function formatBirthMeta(data: SajuDataV1): string {
  const { year, month, day } = data.input.birth;
  const cal = data.input.calendar === 'solar' ? '양력' : '음력';
  const hourLabel = getHourLabel(data);
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} · ${cal}${hourLabel ? ` · ${hourLabel}` : ''}`;
}

function getTenGodPercentages(
  byType: Record<TenGodCode, number> | null | undefined
): Array<{ name: TenGodCode; value: number }> {
  if (!byType) return [];
  const total = Object.values(byType).reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];
  return Object.entries(byType)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({
      name: name as TenGodCode,
      value: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function getDominantElement(data: SajuDataV1): Element | null {
  const byElement = data.fiveElements.byElement;
  let max: Element | null = null;
  let maxVal = -1;
  for (const el of COMPACT_ELEMENT_ORDER) {
    const value = byElement[el]?.percentage ?? 0;
    if (value > maxVal) {
      maxVal = value;
      max = el;
    }
  }
  return max;
}

function buildDonutGradient(data: SajuDataV1): string {
  const byElement = data.fiveElements.byElement;
  const sorted = COMPACT_ELEMENT_ORDER.map((el) => ({
    el,
    pct: byElement[el]?.percentage ?? 0,
    color: ELEMENT_INFO[el].color,
  })).sort((a, b) => b.pct - a.pct);

  let acc = 0;
  const stops = sorted
    .filter((item) => item.pct > 0)
    .map((item) => {
      const start = acc * 3.6;
      acc += item.pct;
      const end = acc * 3.6;
      return `${item.color} ${start}deg ${end}deg`;
    });

  if (stops.length === 0) return 'var(--app-line)';
  return `conic-gradient(${stops.join(', ')})`;
}

export default async function SajuDeepPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  const { input, sajuData } = reading;
  const report = buildSajuReport(input, sajuData);

  const yearZodiac = getYearZodiac(sajuData);
  const yearZodiacLabel = getZodiacKorLabel(yearZodiac);
  const dayMasterLabel = getDayMasterPillarLabel(sajuData);
  const birthMeta = formatBirthMeta(sajuData);

  // §2 사주팔자 detail — 4 pillars
  const pillars = [
    { label: '시주', pillar: sajuData.pillars.hour },
    { label: '일주', pillar: sajuData.pillars.day },
    { label: '월주', pillar: sajuData.pillars.month },
    { label: '연주', pillar: sajuData.pillars.year },
  ];

  // §3 오행 donut
  const dominantElement = getDominantElement(sajuData);
  const dominantColor = dominantElement ? ELEMENT_INFO[dominantElement].color : 'var(--app-ink)';
  const dominantPercent = dominantElement
    ? Math.round(sajuData.fiveElements.byElement[dominantElement].percentage)
    : 0;
  const donutGradient = buildDonutGradient(sajuData);

  // §4 십성 detail
  const tenGodList = getTenGodPercentages(sajuData.tenGods?.byType);

  // §5 대운 timeline
  const currentAge = getCurrentAge(sajuData);
  const majorLuck = sajuData.majorLuck ?? [];
  const currentCycle =
    sajuData.currentLuck?.currentMajorLuck ??
    majorLuck.find((cycle) => isCurrentLuckCycle(cycle, currentAge)) ??
    null;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
          <GangiPageHeader title={`${input.name ?? '달빛이'} · 깊은 풀이`} backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="deep" />

          <section className="space-y-5 px-1">
            {/* §1 Hero — sheep ZodiacChip + 갑신일주 · 양띠 eyebrow + 이름 */}
            <article
              className="rounded-[18px] border border-[var(--app-line)] p-5"
              style={{ background: 'var(--app-pink-soft)' }}
            >
              <div className="flex items-center gap-3">
                <ZodiacChip kind={yearZodiac} size="lg" />
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    {dayMasterLabel} · {yearZodiacLabel}
                  </div>
                  <h1 className="mt-1 text-[18px] font-extrabold tracking-tight text-[var(--app-ink)]">
                    {input.name ?? '달빛이'}님의 사주
                  </h1>
                  <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">{birthMeta}</div>
                </div>
              </div>
            </article>

            {/* §2 사주팔자(四柱八字) detail */}
            <section>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                四柱八字 · 사주팔자
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                네 기둥과 여덟 글자
              </h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {pillars.map((item) => {
                  const pillar = item.pillar;
                  const stemColor = pillar?.stemElement
                    ? ELEMENT_INFO[pillar.stemElement].color
                    : 'var(--app-ink)';
                  const branchColor = pillar?.branchElement
                    ? ELEMENT_INFO[pillar.branchElement].color
                    : 'var(--app-ink)';
                  const tenGod =
                    item.label === '일주' ? '일원' : (pillar?.stemTenGod ?? '—');
                  return (
                    <article
                      key={item.label}
                      className="overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white text-center"
                    >
                      <div
                        className="border-b border-[var(--app-line)] py-1.5 text-[10.5px] font-extrabold text-[var(--app-copy-soft)]"
                        style={{ background: 'var(--app-surface-muted, rgba(0,0,0,0.02))' }}
                      >
                        {item.label}
                      </div>
                      <div className="py-2.5">
                        <div
                          className="text-[22px] font-bold leading-none"
                          style={{ fontFamily: 'var(--font-han)', color: stemColor }}
                        >
                          {pillar?.stem ?? '-'}
                        </div>
                        <div className="mt-0.5 text-[9.5px] text-[var(--app-copy-soft)]">천간</div>
                      </div>
                      <div className="pb-3 pt-1">
                        <div
                          className="text-[22px] font-bold leading-none"
                          style={{ fontFamily: 'var(--font-han)', color: branchColor }}
                        >
                          {pillar?.branch ?? '-'}
                        </div>
                        <div className="mt-0.5 text-[9.5px] text-[var(--app-copy-soft)]">지지</div>
                      </div>
                      <div className="border-t border-[var(--app-line)] py-1.5 text-[9.5px] font-extrabold text-[var(--app-pink-strong)]">
                        {tenGod}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* §3 오행 균형 donut + 분포 */}
            <section>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    五行 · 오행 균형
                  </div>
                  <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                    {dominantElement
                      ? `${dominantElement}(${dominantElement === '목' ? '木' : dominantElement === '화' ? '火' : dominantElement === '토' ? '土' : dominantElement === '금' ? '金' : '水'})이 강한 사주`
                      : '오행 균형 보기'}
                  </h2>
                </div>
                {dominantElement ? (
                  <span
                    className="rounded-full border px-3 py-1 text-[11px] font-extrabold text-[var(--app-pink-strong)]"
                    style={{
                      background: 'var(--app-pink-soft)',
                      borderColor: 'var(--app-pink-line)',
                    }}
                  >
                    {dominantElement}왕
                  </span>
                ) : null}
              </div>

              <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="relative grid h-[124px] w-[124px] shrink-0 place-items-center rounded-full"
                    style={{ background: donutGradient }}
                  >
                    <div
                      className="absolute inset-3 grid place-items-center rounded-full bg-white"
                      aria-hidden="true"
                    >
                      <div className="text-center">
                        <div
                          className="text-[26px] font-bold leading-none"
                          style={{
                            fontFamily: 'var(--font-han)',
                            color: dominantColor,
                          }}
                        >
                          {dominantElement === '목'
                            ? '木'
                            : dominantElement === '화'
                              ? '火'
                              : dominantElement === '토'
                                ? '土'
                                : dominantElement === '금'
                                  ? '金'
                                  : dominantElement === '수'
                                    ? '水'
                                    : '—'}
                        </div>
                        <div className="text-[10px] text-[var(--app-copy-soft)]">
                          {dominantPercent}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <ul className="grid flex-1 gap-1.5" aria-label="오행 분포">
                    {COMPACT_ELEMENT_ORDER.map((el) => {
                      const pct = Math.round(sajuData.fiveElements.byElement[el]?.percentage ?? 0);
                      return (
                        <li key={el} className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: ELEMENT_INFO[el].color }}
                            aria-hidden="true"
                          />
                          <span
                            className="flex-1 text-[12px] font-bold text-[var(--app-copy)]"
                            style={{ fontFamily: 'var(--font-han)' }}
                          >
                            {el}({el === '목' ? '木' : el === '화' ? '火' : el === '토' ? '土' : el === '금' ? '金' : '水'})
                          </span>
                          <span className="text-[12px] font-extrabold text-[var(--app-ink)]">
                            {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {dominantElement ? (
                  <p
                    className="mt-3.5 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.55] text-[var(--app-pink-strong)]"
                    style={{ background: 'var(--app-pink-soft)' }}
                  >
                    <strong>해석</strong> · {dominantElement}이/가 강한 사주는{' '}
                    {dominantElement === '목'
                      ? '성장과 시작의 기운이 풍부하지만 마무리와 정리는 의식적으로'
                      : dominantElement === '화'
                        ? '표현력과 추진력이 좋지만 잠시 멈춰 식히는 시간이 필요'
                        : dominantElement === '토'
                          ? '안정감과 중재력이 강점이지만 새 시도는 작게 자주'
                          : dominantElement === '금'
                            ? '결단력과 추진력은 좋으나 안정감과 성장 속도는 조절 필요'
                            : '깊은 통찰과 계획에 강하지만 가벼운 표현도 필요'}
                    합니다.
                  </p>
                ) : null}
              </article>
            </section>

            {/* §4 십성 detail */}
            {tenGodList.length > 0 ? (
              <section>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  十星 · 십성
                </div>
                <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                  나를 둘러싼 열 가지 기운
                </h2>
                <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
                  {tenGodList.map((item, index) => {
                    const color = TEN_GOD_COLORS[item.name];
                    const isLast = index === tenGodList.length - 1;
                    const width = Math.max(2, Math.min(100, item.value * 2.5));
                    return (
                      <div
                        key={item.name}
                        className={`py-2.5 ${isLast ? '' : 'border-b border-[var(--app-line)]'}`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-[13px] font-bold text-[var(--app-ink)]">
                            {item.name}
                          </span>
                          <span className="text-[13px] font-extrabold" style={{ color }}>
                            {item.value}%
                          </span>
                        </div>
                        <div
                          className="relative mt-1.5 h-1.5 overflow-hidden rounded-full"
                          style={{ background: 'var(--app-line)' }}
                        >
                          <span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${width}%`, background: color }}
                          />
                        </div>
                        <div className="mt-1.5 text-[11px] text-[var(--app-copy-soft)]">
                          {TEN_GOD_DESCRIPTIONS[item.name]}
                        </div>
                      </div>
                    );
                  })}
                </article>
              </section>
            ) : null}

            {/* §5 대운 timeline */}
            {majorLuck.length > 0 ? (
              <section>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  大運 · 대운 흐름
                </div>
                <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                  10년 단위 큰 흐름
                </h2>
                <div
                  className="mt-3 flex gap-2 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {majorLuck.map((cycle) => {
                    const isCurrent = isCurrentLuckCycle(cycle, currentAge);
                    return (
                      <article
                        key={`${cycle.index}-${cycle.ganzi}`}
                        className={
                          isCurrent
                            ? 'shrink-0 rounded-[12px] px-3 py-2.5 text-center text-white'
                            : 'shrink-0 rounded-[12px] border border-[var(--app-line)] bg-white px-3 py-2.5 text-center text-[var(--app-ink)]'
                        }
                        style={
                          isCurrent
                            ? {
                                width: 72,
                                background: 'var(--app-pink)',
                                boxShadow: '0 8px 18px rgba(216,27,114,0.28)',
                              }
                            : { width: 72 }
                        }
                      >
                        <div
                          className="text-[10.5px] font-bold"
                          style={{ opacity: isCurrent ? 0.85 : 0.55 }}
                        >
                          {cycle.startAge ?? '—'}세
                        </div>
                        <div
                          className="mt-1 text-[19px] font-bold leading-none"
                          style={{ fontFamily: 'var(--font-han)' }}
                        >
                          {cycle.ganzi}
                        </div>
                        {isCurrent ? (
                          <div className="mt-1 text-[9px] font-extrabold tracking-[0.04em]">
                            지금
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {currentCycle ? (
                  <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--app-copy)]">
                    현재{' '}
                    <strong className="text-[var(--app-pink-strong)]">
                      {currentCycle.ganzi} 대운
                    </strong>{' '}
                    진행 중. 일주 {dayMasterLabel.replace('일주', '')}을 기준으로{' '}
                    10년 흐름이 잡혀 있어 큰 결정의 호흡을 길게 가져가면 좋습니다.
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* §6 Premium upsell — 평생리포트 49,000원 */}
            <article
              className="rounded-[18px] p-5 text-white"
              style={{
                background: 'var(--app-ink)',
                boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                  style={{ background: 'var(--app-pink)' }}
                >
                  VIP
                </span>
                <span
                  className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ opacity: 0.7 }}
                >
                  PREMIUM
                </span>
              </div>
              <h2 className="mt-2 text-[19px] font-extrabold leading-snug tracking-tight">
                평생리포트로
                <br />
                전체 인생 흐름 잡기
              </h2>
              <p
                className="mt-2 text-[12.5px] leading-[1.55]"
                style={{ opacity: 0.7 }}
              >
                대운 10주기 · 세운 30년 · 십성 디테일 · PDF 보관 · 1:1 풀이 30분
              </p>
              <div className="mt-4 flex items-end gap-2.5">
                <div className="text-[23px] font-extrabold tracking-tight">49,000원</div>
                <div
                  className="mb-1.5 text-[11px] line-through"
                  style={{ opacity: 0.5 }}
                >
                  69,000원
                </div>
                <TrackedLink
                  href={`/membership/checkout?plan=lifetime&slug=${encodeURIComponent(slug)}&from=saju-deep`}
                  eventName="report_deep_report_click"
                  eventParams={{
                    slug,
                    product: 'lifetime-report',
                    from: 'saju_deep_premium_cta',
                  }}
                  className="ml-auto inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-2.5 text-[13px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
                >
                  결제하기 →
                </TrackedLink>
              </div>
            </article>

            {/* 추가 화면 링크 */}
            <div className="grid gap-2">
              <Link
                href={`/saju/${encodeURIComponent(slug)}`}
                className="rounded-[12px] border border-[var(--app-line)] bg-white px-4 py-3 text-center text-[13px] font-bold text-[var(--app-copy-muted)]"
              >
                ← 사주 총평으로 돌아가기
              </Link>
            </div>
          </section>
        </div>
        {/* report 사용을 위한 더미 안전망 (lint warning 회피용 — 미래 PR 에서 풀이 본문 출력 시 활용) */}
        <span hidden>{report.focusBadge}</span>
      </AppPage>
    </AppShell>
  );
}
