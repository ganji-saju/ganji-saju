// Redesign 2026-05-17 — design token + inline 패턴 완전 적용 (PR #198 saju/today-detail 와
// 동일 방향). 페이지가 이미 var(--app-pink) / var(--app-ink) / var(--app-pink-soft) 등
// 신스타일 token + inline style + Tailwind utility 광범위 사용 중 — audit-redesign-coverage
// 의 marker 누락 회귀만 fix. visual 측면은 sibling redesign 페이지들과 일관.
//
// 2026-05-15 cleanup — /saju/[slug]/deep 는 이전엔 "사주팔자 + 오행 + 십성 + 대운 timeline"
// 4개 섹션을 모아둔 화면이었으나 (a) 다른 탭과 콘텐츠 중복 (사주팔자→명식, 오행→오행)
// (b) "깊은" 이라는 라벨이 정작 가장 깊은 풀이인 8단 framework 를 노출하지 않아 모순.
//
// 이번에 화면을 "대운" 으로 재정의 — PR #93~99 에서 만든 buildLifetimeReport 의 cycle 8단
// (hook / chapterTitle / chapterBody / mental / relationship / wealthCareer /
// practicalActions / closingNote + 12운성·원진·교운기 metadata) 을 그대로 노출한다.
// AI 응답 없이 룰 기반으로도 풍부하게 채워지므로 무료 탭으로 두고, 더 자세한 AI 풀이는
// 평생리포트(상세 탭, 49,000원) 로 이끈다.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { LifetimeDeepCta } from '@/components/saju/lifetime-deep-cta';
import { Price, ComparePrice } from '@/components/payments/price-provider';
import { MOONLIGHT_FALLBACK_DISPLAY_NAME } from '@/lib/today-fortune/resolve-display-name';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
// 2026-05-16 — 대운 timeline 현재 위치 중앙 스크롤 client 컴포넌트.
import { DaewoonTimelineStrip } from '@/features/saju-detail/daewoon-timeline-strip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { resolveReading } from '@/lib/saju/readings';
import { buildLifetimeReport } from '@/domain/saju/report';
import type { LifetimeMajorLuckCycle } from '@/domain/saju/report/lifetime-types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
// 2026-05-16 — lifetime 결제 CTA 가 이미 구매한 사용자에게도 결제 button 으로 보여
//   중복 결제 진입을 유도하던 회귀. entitlement 확인 후 CTA 분기.
import { toSlug } from '@/lib/saju/pillars';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '대운 풀이',
    description: '10년 단위 큰 흐름과 시기별 8단 풀이 (현재·미래·과거 대운) 를 보여주는 화면입니다.',
    robots: { index: false, follow: false },
    alternates: { canonical: '/saju' },
  };
}

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake',
  午: 'horse', 未: 'sheep', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig',
};

const ZODIAC_KOR: Record<ZodiacKey, string> = {
  rat: '쥐띠', ox: '소띠', tiger: '범띠', rabbit: '토끼띠', dragon: '용띠', snake: '뱀띠',
  horse: '말띠', sheep: '양띠', monkey: '원숭이띠', rooster: '닭띠', dog: '개띠', pig: '돼지띠',
};

// 한자 ganzi → 한글 발음. "丁酉" → "정유".
const STEM_HANJA_TO_KOREAN: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const BRANCH_HANJA_TO_KOREAN: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
function ganziToKorean(ganzi: string): string {
  const stem = STEM_HANJA_TO_KOREAN[ganzi.charAt(0) ?? ''] ?? '';
  const branch = BRANCH_HANJA_TO_KOREAN[ganzi.charAt(1) ?? ''] ?? '';
  return `${stem}${branch}`;
}
function withKoreanGanzi(ganzi: string): string {
  const korean = ganziToKorean(ganzi);
  return korean ? `${korean}(${ganzi})` : ganzi;
}

function getYearZodiac(data: SajuDataV1 | SajuDataV2): ZodiacKey {
  return BRANCH_TO_ZODIAC[data.pillars.year.branch] ?? 'dragon';
}

function getCurrentAge(data: SajuDataV1 | SajuDataV2): number {
  const now = new Date();
  const birthYear = data.input.birth.year;
  const birthMonth = data.input.birth.month;
  const birthDay = data.input.birth.day;
  const beforeBirthday =
    now.getMonth() + 1 < birthMonth ||
    (now.getMonth() + 1 === birthMonth && now.getDate() < birthDay);
  return now.getFullYear() - birthYear - (beforeBirthday ? 1 : 0);
}

function formatBirthMeta(data: SajuDataV1 | SajuDataV2): string {
  const { year, month, day, hour } = data.input.birth;
  const cal = data.input.calendar === 'solar' ? '양력' : '음력';
  const hourLabel = hour !== null ? ` · ${hour}시` : '';
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} · ${cal}${hourLabel}`;
}

function CycleCard({ cycle, defaultOpen }: { cycle: LifetimeMajorLuckCycle; defaultOpen: boolean }) {
  const ganziLabel = withKoreanGanzi(cycle.ganzi);
  const phaseColor =
    cycle.phase === '성장기'
      ? 'var(--app-jade)'
      : cycle.phase === '전달기'
        ? 'var(--app-pink-strong)'
        : cycle.phase === '결정기'
          ? 'var(--app-amber)'
          : cycle.phase === '기반기'
            ? 'var(--app-indigo)'
            : cycle.phase === '준비기'
              ? 'var(--app-plum)'
              : 'var(--app-copy-muted)';
  const transitionChip =
    cycle.transitionPhase === 'entering'
      ? '교운기 진입'
      : cycle.transitionPhase === 'leaving'
        ? '교운기 마무리'
        : null;

  return (
    <details
      className="group rounded-[16px] border bg-white"
      style={{
        borderColor: cycle.isCurrent ? 'var(--app-pink-line)' : 'var(--app-line)',
        background: cycle.isCurrent ? 'var(--app-pink-soft)' : 'white',
      }}
      open={defaultOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5"
        style={{ outline: 'none' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[12.1px] font-extrabold uppercase tracking-[0.04em] text-white"
              style={{ background: phaseColor }}
            >
              {cycle.phase}
            </span>
            {cycle.isCurrent ? (
              <span
                className="rounded-full px-2 py-0.5 text-[12.1px] font-extrabold uppercase tracking-[0.04em] text-white"
                style={{ background: 'var(--app-pink)' }}
              >
                지금
              </span>
            ) : null}
            {transitionChip ? (
              <span
                className="rounded-full border px-2 py-0.5 text-[12.1px] font-bold"
                style={{
                  background: '#fff7e6',
                  borderColor: 'rgba(212,148,38,0.32)',
                  color: 'var(--app-amber)',
                }}
              >
                {transitionChip}
              </span>
            ) : null}
            {cycle.twelveStage ? (
              <span
                className="rounded-full border px-2 py-0.5 text-[12.1px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {cycle.twelveStage}지
              </span>
            ) : null}
            {cycle.wonjinWith && cycle.wonjinWith.length > 0 ? (
              <span
                className="rounded-full border px-2 py-0.5 text-[12.1px] font-bold text-[var(--app-coral)]"
                style={{ borderColor: 'rgba(220,79,79,0.22)' }}
              >
                원진 · {cycle.wonjinWith.join(', ')}
              </span>
            ) : null}
          </div>
          <div
            className="mt-1.5 text-[17.3px] font-extrabold leading-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {cycle.chapterTitle ?? `${ganziLabel} · ${cycle.ageLabel}`}
          </div>
          <div className="mt-0.5 text-[12.6px] font-bold text-[var(--app-copy-soft)]">
            {ganziLabel} · {cycle.ageLabel}
          </div>
        </div>
        <span
          className="text-[var(--app-copy-soft)] transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--app-line)] px-4 py-4">
        {cycle.hook ? (
          <p
            className="rounded-[12px] bg-white p-3 text-[15px] font-medium leading-[1.65] text-[var(--app-ink)]"
            style={{
              border: '1px solid var(--app-pink-line)',
              background: 'var(--app-pink-soft)',
              wordBreak: 'keep-all',
            }}
          >
            {cycle.hook}
          </p>
        ) : null}

        {cycle.chapterBody ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
              본문
            </div>
            <p
              className="mt-1.5 text-[15.5px] leading-[1.75] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.chapterBody}
            </p>
          </section>
        ) : null}

        {cycle.mental ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-indigo)]">
              멘탈 · 내면
            </div>
            <p
              className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.mental}
            </p>
          </section>
        ) : null}

        {cycle.relationship ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-coral)]">
              관계
            </div>
            <p
              className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.relationship}
            </p>
          </section>
        ) : null}

        {cycle.wealthCareer ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber)]">
              돈 · 커리어
            </div>
            <p
              className="mt-1.5 text-[15px] leading-[1.7] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {cycle.wealthCareer}
            </p>
          </section>
        ) : null}

        {cycle.practicalActions && cycle.practicalActions.length > 0 ? (
          <section>
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade)]">
              실천 4단 · 왜 / 무엇을 / 어떻게
            </div>
            <ul className="mt-2 grid gap-2">
              {cycle.practicalActions.map((action, idx) => (
                <li
                  key={idx}
                  className="rounded-[12px] border border-[var(--app-line)] bg-white p-3"
                >
                  <div
                    className="text-[13.8px] font-extrabold leading-tight text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {idx + 1}. {action.what}
                  </div>
                  <div
                    className="mt-1 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    <strong className="text-[var(--app-copy)]">왜 ·</strong> {action.reason}
                  </div>
                  <div
                    className="mt-0.5 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    <strong className="text-[var(--app-copy)]">어떻게 ·</strong> {action.how}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {cycle.closingNote ? (
          <p
            className="rounded-[12px] p-3 text-[14.4px] leading-[1.7] text-[var(--app-ink)]"
            style={{
              background: 'rgba(15,23,42,0.04)',
              border: '1px solid var(--app-line)',
              wordBreak: 'keep-all',
            }}
          >
            <strong className="text-[var(--app-pink-strong)]">마무리 ·</strong> {cycle.closingNote}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export default async function SajuDeepPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  const { input, sajuData } = reading;
  // 2026-05-16 — lifetime 결제 CTA 분기를 위한 entitlement 조회.
  const readingKey = toSlug(input);
  let hasLifetimeAccess = false;
  if (hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const entitlement = await getLifetimeReportEntitlement(user.id, readingKey, [slug]);
      if (entitlement) hasLifetimeAccess = true;
    }
  }
  // 2026-05-15 cleanup — 깊은 탭의 진짜 깊은 콘텐츠 = 대운 cycle 8단 풀이. 룰 기반으로
  // hook/body/mental/relationship/wealthCareer/practicalActions/closingNote 가 모두 채워진다.
  const lifetime = buildLifetimeReport(input, sajuData);
  const cycles = lifetime.majorLuckTimeline.cycles.filter(
    (cycle) => cycle.ganzi !== '대운 미산정'
  );
  const currentCycleIndex = cycles.findIndex((cycle) => cycle.isCurrent);
  const currentCycle = currentCycleIndex >= 0 ? cycles[currentCycleIndex] : null;

  const yearZodiac = getYearZodiac(sajuData);
  const yearZodiacLabel = ZODIAC_KOR[yearZodiac];
  const dayGanziHanja = sajuData.pillars.day.ganzi;
  const dayGanziLabel = withKoreanGanzi(dayGanziHanja);
  const birthMeta = formatBirthMeta(sajuData);
  const currentAge = getCurrentAge(sajuData);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
          <GangiPageHeader title={`${input.name ?? MOONLIGHT_FALLBACK_DISPLAY_NAME} · 대운 풀이`} backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="deep" />

          <section className="space-y-5 px-1">
            {/* §1 Hero — 일주 + 현재 만 나이 + 진행 중 대운 */}
            <article
              className="rounded-[18px] border border-[var(--app-line)] p-5"
              style={{ background: 'var(--app-pink-soft)' }}
            >
              <div className="flex items-center gap-3">
                <ZodiacChip kind={yearZodiac} size="lg" />
                <div className="min-w-0">
                  <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    {dayGanziLabel}일주 · {yearZodiacLabel}
                  </div>
                  <h1
                    className="mt-1 text-[20.7px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    10년 단위로 나뉘는 큰 흐름
                  </h1>
                  <div className="mt-1 text-[13.2px] text-[var(--app-copy-soft)]">
                    {birthMeta} · 현재 만 {currentAge}세
                  </div>
                </div>
              </div>
              {currentCycle ? (
                <p
                  className="mt-3 rounded-[12px] bg-white p-3 text-[14.4px] leading-[1.65] text-[var(--app-copy)]"
                  style={{
                    border: '1px solid var(--app-pink-line)',
                    wordBreak: 'keep-all',
                  }}
                >
                  지금은 <strong className="text-[var(--app-pink-strong)]">{withKoreanGanzi(currentCycle.ganzi)} 대운</strong> ·{' '}
                  {currentCycle.ageLabel} · <strong>{currentCycle.phase}</strong> 구간을 지나고 있어요.
                </p>
              ) : (
                <p className="mt-3 text-[14.4px] leading-[1.55] text-[var(--app-copy-muted)]">
                  태어난 시간이 비어 있어 대운 진행도를 정확히 잡지 못했어요. 아래 타임라인으로 큰 흐름만 살펴봐요.
                </p>
              )}
            </article>

            {/* §2 대운 timeline strip — 한눈에 보는 모든 대운.
                2026-05-16 — 현재 cycle 이 화면 오른쪽 끝에 있던 회귀.
                DaewoonTimelineStrip 으로 client 측에서 mount 시 active 카드
                중앙 정렬 scrollBy 처리. */}
            {cycles.length > 0 ? (
              <section>
                <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  大運 · 대운 흐름
                </div>
                <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
                  내 인생의 10년 단위 챕터
                </h2>
                <DaewoonTimelineStrip cycles={cycles} />
              </section>
            ) : null}

            {/* §3 cycle 8단 풀이 — 현재 cycle 은 펼친 상태, 나머지는 접힌 카드 */}
            {cycles.length > 0 ? (
              <section>
                <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  시기별 8단 풀이
                </div>
                <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
                  각 대운에서 일어나는 변화
                </h2>
                <p
                  className="mt-1.5 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  대운마다 8가지 시각 — 호명 · 챕터 제목 · 본문 · 멘탈 · 관계 · 돈/커리어 · 실천 4단 · 마무리 — 으로 풀었습니다.
                  카드를 눌러 펼쳐보세요.
                </p>
                <div className="mt-3 grid gap-2.5">
                  {cycles.map((cycle, idx) => (
                    <CycleCard
                      key={`${cycle.ganzi}-${cycle.ageLabel}-${idx}`}
                      cycle={cycle}
                      defaultOpen={cycle.isCurrent || (currentCycleIndex < 0 && idx === 0)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* §4 Premium upsell — 평생리포트 49,000원 (AI 깊은 풀이 + 세운 30년) */}
            <article
              className="rounded-[18px] p-5 text-white"
              style={{
                background: 'var(--app-ink)',
                boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11.5px] font-extrabold text-white"
                  style={{ background: 'var(--app-pink)' }}
                >
                  VIP
                </span>
                <span
                  className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ opacity: 0.7 }}
                >
                  PREMIUM
                </span>
              </div>
              <h2 className="mt-2 text-[21.8px] font-extrabold leading-snug tracking-tight">
                평생리포트로
                <br />
                AI 1:1 깊은 풀이까지
              </h2>
              <p
                className="mt-2 text-[14.4px] leading-[1.55]"
                style={{ opacity: 0.7 }}
              >
                대운 8단 + 세운 30년 + 십성 디테일 + PDF 보관 + 1:1 풀이 30분
              </p>
              <div className="mt-4 flex items-end gap-2.5">
                <div className="text-[26.5px] font-extrabold tracking-tight">
                  <Price priceKey="lifetime_report" />
                </div>
                <div
                  className="mb-1.5 text-[12.6px] line-through"
                  style={{ opacity: 0.5 }}
                >
                  <ComparePrice priceKey="lifetime_report" />
                </div>
                {/* 2026-05-16 A7 — LifetimeDeepCta 클라이언트 wrapper 로 통일.
                    서버에서 hasLifetimeAccess 계산 → initialEntitlement 로 전달 →
                    client hook 이 focus 시 자동 재요청 (다른 탭 결제 후 실시간 반영). */}
                <LifetimeDeepCta
                  slug={slug}
                  initialEntitlement={{
                    hasEntitlement: hasLifetimeAccess,
                    openHref: hasLifetimeAccess
                      ? `/saju/${encodeURIComponent(slug)}/premium`
                      : null,
                    reason: hasLifetimeAccess ? 'lifetime-purchased' : null,
                    hasLegacyCoins: false,
                    memberFreeEligible: false,
                  }}
                />

              </div>
            </article>

            {/* 추가 화면 링크 */}
            <div className="grid gap-2">
              <Link
                href={`/saju/${encodeURIComponent(slug)}`}
                className="rounded-[12px] border border-[var(--app-line)] bg-white px-4 py-3 text-center text-[15px] font-bold text-[var(--app-copy-muted)]"
              >
                ← 사주 총평으로 돌아가기
              </Link>
            </div>
          </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
