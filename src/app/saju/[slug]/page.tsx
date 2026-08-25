import { Suspense, type ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import Link from 'next/link';
import type { Metadata } from 'next';
import { logPaywallImpression } from '@/lib/payments/funnel-log';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import { TrackedLink } from '@/components/common/tracked-link';
import { TodayDetailResultCta } from '@/components/saju/today-detail-result-cta';
import { SajuResultViewTracker } from '@/features/saju-detail/saju-result-view-tracker';
import { SajuNarrativeCard } from '@/components/saju/saju-narrative-card';
import { SajuTotalReviewNarrative } from '@/components/saju/saju-total-review-narrative';
import { SajuLifetimeKeysSection } from '@/components/saju/saju-lifetime-keys-section';
import { SituationReflectionCard } from '@/components/saju/situation-reflection-card';
import { buildSajuNarrative } from '@/domain/saju/report';
// 2026-05-21 — 총평 LLM 풀이 (flag 게이팅, 기본 OFF → 기존 narrative 유지).
import { generateTotalReview, type GenerateTotalReviewArgs } from '@/server/ai/saju-total-review-service';
import { isTotalReviewLLMEnabled } from '@/server/ai/total-review/total-review-cache';
// 2026-05-15 handoff PR-C: 52 m-reveal — 결과 카드 stagger 등장.
import { MotionResultReveal } from '@/components/motion/motion-primitives';
import '@/components/motion/motion-primitives.css';
// 2026-08-25 전면 개편 — 탭(총평/대운/상세/명식/성향/오행) 제거, 단일 페이지 합성(사용자 지시).
import { MyeongsikSection } from '@/features/saju-detail/sections/myeongsik-section';
import { NatureSection } from '@/features/saju-detail/sections/nature-section';
import { ElementsSection } from '@/features/saju-detail/sections/elements-section';
import { DaewoonSection } from '@/features/saju-detail/sections/daewoon-section';
import type { LifetimeMajorLuckCycle } from '@/domain/saju/report/lifetime-types';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getSajuTodayDetailEntitlement } from '@/lib/saju/today-detail-access';
import { MOONLIGHT_FALLBACK_DISPLAY_NAME } from '@/lib/today-fortune/resolve-display-name';
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
// 2026-05-16 PR #179 — 사주 페이지 ↔ 운세 페이지 점수 단일화.
//   buildSajuReport 의 자체 clampScore(48~92) 산식 대신 iljinScore.totalScore 기반으로 덮어쓴다.
import { computeSajuIljinScore } from '@/server/today-fortune/build-today-fortune';
import { unifyScoresWithIljinScore } from '@/lib/today-fortune/unify-saju-scores';
// 2026-05-16 PR #181 — 6 영역 카드 통일 (총운/직장/재물/연애/관계/컨디션).
//   사주 메인/상세 + 운세 페이지에서 공유하는 SajuAreaCardsSection 사용.
// 2026-05-22 Phase 2+3 스펙 — 사주 점수 컴포넌트(원형 점수 + 5요소 산출내역 + 오행 막대).
import { SajuScoreCard, ScoreBreakdownCard, ScoreLockGate } from '@/components/saju-score';
import { ComprehensiveToc } from '@/components/saju/comprehensive-toc';
import { TodayFortuneDetailClient } from '@/features/today-fortune/today-fortune-detail-client';
// 2026-08-25 Phase 2 — 수호신 배정: 연주 지지 → 자기 띠 수호신이 전담 해설자로.
import { GuardianAssignmentCard } from '@/components/saju/guardian-assignment-card';
import { guardianFromYearBranch } from '@/lib/guardians';
import { buildLifetimeReport } from '@/domain/saju/report';
import { computeSajuScoreFromData } from '@/lib/saju-score';
import { getScoreUnlockEntitlement } from '@/lib/saju/score-unlock-access';
import { getPriceDisplayMap } from '@/lib/payments/price-display';
import { compareLabelFromMap, priceLabelFromMap, type PriceKey } from '@/lib/payments/price-display-shared';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
// Task 8 — 카카오 친구추가 무료쿠폰 CTA(사주 결과 하단). slug 없이 렌더 —
// 휴면(KAKAO_FRIEND_COUPON_ENABLED off)이면 컴포넌트 자체가 아무것도 렌더하지 않는다.
// 서버 컴포넌트 안에서 'use client' 컴포넌트를 그대로 import+렌더 — client island.
import { KakaoFriendCouponCta } from '@/features/coupons/kakao-friend-coupon-cta';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
}

// 2026-05-22 — 총평 LLM 스트리밍: 느린 LLM 호출을 Suspense 경계 안으로 옮겨
//   페이지 셸·점수·분야별이 즉시 렌더되도록(새로고침 시 흰 화면 방지). 총평 자리엔 스켈레톤.
async function TotalReviewSection({
  args,
  fallbackNarrative,
}: {
  args: GenerateTotalReviewArgs;
  fallbackNarrative: ComponentProps<typeof SajuNarrativeCard>['narrative'];
}) {
  const totalReview = await generateTotalReview(args);
  if (totalReview.source === 'llm' || totalReview.source === 'cache') {
    return (
      <>
        <SajuTotalReviewNarrative
          summary={totalReview.output.one_line_summary}
          narrative={totalReview.output.main_narrative}
        />
        <SajuLifetimeKeysSection keys={totalReview.output.lifetime_keys} />
      </>
    );
  }
  return <SajuNarrativeCard narrative={fallbackNarrative} />;
}

function TotalReviewSkeleton() {
  return (
    <div
      className="rounded-[18px] border p-5"
      style={{
        background: 'linear-gradient(180deg, #fff 0%, #fbf7f1 100%)',
        borderColor: 'var(--app-line)',
      }}
      aria-busy="true"
      aria-label="사주 총평을 정리하는 중"
    >
      {/* 카드 외형을 본 카드(한 단락으로 정리)와 맞춰 어느 영역이 로딩 중인지 분명히. */}
      <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        한 단락으로 정리
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span
          // 스피너는 원형이어야 한다(모서리 둥근 사각형으로 바꾸면 회전이 어색해진다).
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--app-pink-line)] border-t-[var(--app-pink-strong)]"
          aria-hidden="true"
        />
        <p className="text-[16.1px] font-extrabold text-[var(--app-ink)]">
          사주 총평을 정리하고 있어요…
        </p>
      </div>
      <p className="mt-1 text-[13.2px] text-[var(--app-copy-soft)]">
        사주가 복잡할수록 조금 더 걸릴 수 있어요. 화면을 닫지 말고 잠시만 기다려 주세요.
      </p>
      <div className="mt-3.5 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-[var(--app-surface-muted)]" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-[var(--app-surface-muted)]" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--app-surface-muted)]" />
      </div>
    </div>
  );
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
  화: '말',
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
    화: '말 먼저',
    토: '정리부터',
    금: '원칙 세우기',
    수: '잠깐 멈춤',
  },
  love: {
    목: '가볍게 시작',
    화: '마음 말',
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
    화: '따뜻하게 말',
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
  if (/말/u.test(cleaned)) return '말해도 좋음';
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

  const { input, sajuData, grounding } = reading;
  // 2026-07-07 Phase 2 — 가격 표시 리졸버 맵(admin product_prices 반영).
  const priceMap = await getPriceDisplayMap();
  // 2026-05-21 Phase 6~7 — 사주 종합 점수(순수·서버, 비용 0).
  const sajuScore = computeSajuScoreFromData(sajuData);
  // 2026-06-07 — 점수 단일 언락(score-total). 미해제 시 점수 블록을 블러-락.
  //   가격은 리졸버가 렌더하므로 주석에 금액을 적지 않는다(2026-07-19 6,600원 인하 시 stale 이었음).
  //   grandfather: 과거 score-factor 5개/today-set 번들 보유자도 해제.
  const scoreUnlocked = await getScoreUnlockEntitlement(slug);

  // 2026-08-12 — 페이월 노출을 퍼널에 기록한다(migration 073).
  //   지금까지 퍼널의 첫 칸이 비어 있어 "결과를 본 사람 중 몇 %가 결제창까지 갔나"를
  //   계산할 수 없었다(무료 조회는 readings, 결제는 payment_funnel_events 로 테이블이 갈림).
  //   60일 실측상 실제로 팔리는 건 이 종합점수 언락 하나(결제 성공 9건 중 5건)라,
  //   여기 분모를 세우는 게 페이월 판단의 전제다.
  //   ⚠️ after() — 렌더 경로에서 await 하면 응답이 그만큼 느려진다.
  if (!scoreUnlocked) {
    after(() => {
      logPaywallImpression({ packageId: 'taste_score_total', surface: 'saju-result', slug });
      // 2026-08-24 Phase 1 — 간판(종합 리포트) 목차 노출도 같은 분모로 기록.
      logPaywallImpression({ packageId: 'bundle_comprehensive', surface: 'saju-result-toc', slug });
    });
  }
  const rawReport = buildSajuReport(input, sajuData, topic);
  // 2026-05-16 PR #179 — 오늘 운세 페이지와 점수 일치 보장.
  //   iljinScore 산출 가능하면 (시 입력 등) overall+영역별을 iljinScore.totalScore 바탕으로 통일.
  //   불가능하면 raw scores 유지 (안전 fallback).
  const iljinResult = computeSajuIljinScore(sajuData);
  const report: SajuReport = iljinResult
    ? { ...rawReport, scores: unifyScoresWithIljinScore(rawReport.scores, iljinResult.totalScore) }
    : rawReport;
  // 2026-05-15 cleanup — 사실 카드(일주 캐릭터 / 격국·용신·강약 / 합충·공망·신살)는 성향·명식 탭으로 이동.
  // 총평 narrative 만 남기고, personalizationContext 는 narrative 빌더에 그대로 전달.
  const personalizationContext = grounding?.personalizationContext ?? null;
  // PR #150 (B1) — userName 전달하면 narrative 가 "[직장인이신 김영민님, ]" prefix + closing 호명.
  const sajuNarrative = buildSajuNarrative(sajuData, personalizationContext, {
    userName: input.name?.trim() || null,
  });

  // 2026-08-24 Phase 1 — 종합 리포트 목차의 개인화 훅. 대운 타임라인(결정론, 무료 deep 챕터와
  //   동일 빌더)에서 '다음 대운 시작 나이'를 뽑는다. 연도 환산은 만나이/세는나이 모호성 때문에
  //   하지 않는다(ageLabel 그대로만 인용 — 틀린 숫자를 약속하지 않는 원칙).
  //   2026-08-25 단일 페이지화 — 같은 빌더 결과를 대운 섹션(DaewoonSection)도 쓰므로 1회만 계산.
  let lifetimeCycles: LifetimeMajorLuckCycle[] = [];
  try {
    lifetimeCycles = buildLifetimeReport(input, sajuData).majorLuckTimeline.cycles.filter(
      (cycle) => cycle.ganzi !== '대운 미산정'
    );
  } catch {
    lifetimeCycles = []; // 대운 섹션·훅은 장식 — 계산 실패가 페이지를 못 깨게 한다.
  }
  let comprehensiveHook: string | null = null;
  if (!scoreUnlocked) {
    const currentIdx = lifetimeCycles.findIndex((cycle) => cycle.isCurrent);
    const next = currentIdx >= 0 ? lifetimeCycles[currentIdx + 1] : null;
    const nextStartAge = next?.ageLabel?.match(/^(\d+)/)?.[1] ?? null;
    if (nextStartAge) {
      const who = input.name?.trim() ? `${input.name.trim()}님의` : '당신의';
      comprehensiveHook = `${who} 다음 대운 전환은 ${nextStartAge}세 — 그 10년의 흐름이 잠긴 항목 안에 있습니다.`;
    }
  }

  // 2026-05-22 — 총평 LLM 풀이는 아래 JSX 의 <TotalReviewSection>(Suspense 경계) 안에서 await 한다.
  //   여기서 직접 await 하면 LLM(수 초) 동안 페이지 전체 HTML 이 막혀 새로고침 시 흰 화면이 떴다.
  //   flag(OPENAI_INTERPRET_TOTAL_REVIEW) + personalizationContext 있을 때만 LLM, 아니면 결정론 narrative.
  const totalReviewLLMActive = isTotalReviewLLMEnabled() && Boolean(personalizationContext);

  const pillars = [
    { label: '년', pillar: sajuData.pillars.year },
    { label: '월', pillar: sajuData.pillars.month },
    { label: '일', pillar: sajuData.pillars.day },
    { label: '시', pillar: sajuData.pillars.hour },
  ];
  // 2026-08-25 Phase 2 — 수호신 배정. 띠는 연도 계산이 아니라 연주 지지에서 파생
  //   (입춘 경계를 엔진이 이미 처리). 매핑 실패 시 카드 생략(null 안전).
  const guardian = guardianFromYearBranch(sajuData.pillars.year.branch);
  const punchReading = buildPunchReading(report);
  const todayDetailEntitlement = await getSajuTodayDetailEntitlement(slug);
  const todayDetailHref = todayDetailEntitlement
    ? buildSajuTodayDetailHref(slug)
    : buildSajuTodayDetailCheckoutHref(slug);
  const compactResultCards = buildCompactResultCards(report);
  const overallScore = getOverallScore(report);
  const focusScore = report.scores.find((score) => score.key === report.focusScoreKey);
  const todayLabel = formatTodayLabel();

  // Redesign 2026-05-13 (Claude Design / screens-a.jsx ScreenSajuResult):
  // 5 핵심 섹션 — Summary / Pillars / Scores / Small picks / Next-step CTA. 데이터·라우팅 무수정.
  const summaryChips = punchReading.personalPoints.slice(0, 3);

  const SMALL_PICKS: Array<{
    label: string;
    price: string;
    priceKey?: PriceKey;
    href: string;
    desc: string;
    eventProduct: string;
  }> = [
    {
      label: '오늘 자세히 보기',
      price: '9,900원',
      priceKey: 'saju_entry',
      desc: '지금 흐름과 조심해야 할 시간대',
      href: todayDetailHref,
      eventProduct: 'today-detail',
    },
    {
      // 2026-07-09 — '깊은 사주 풀이'는 평생 리포트 풀팩(lifetime) 대표가로 매핑(사용자 확정).
      //   desc('큰 흐름 한 번에')와 일치. 청구가는 /premium 의 lifetime 결제 경로와 동일.
      label: '깊은 사주 풀이',
      price: '49,000원',
      priceKey: 'lifetime_report',
      desc: '성격·일·관계·재물의 큰 흐름 한 번에',
      href: `/saju/${encodeURIComponent(slug)}/premium`,
      eventProduct: 'saju-premium',
    },
    {
      label: '오행 균형 보기',
      price: '무료',
      desc: '나의 다섯 기운 분포와 보완점',
      href: `/saju/${encodeURIComponent(slug)}/elements`,
      eventProduct: 'elements',
    },
  ];

  // 2026-08-25 — 점수 섹션을 상수로: 미구매자는 목차 아래(잠금 게이트), 구매자는 결제 복귀
  //   직후 최상단(수호신·요약 바로 뒤)에서 본다("결제한 보람" — 사용자 확정 순서).
  const scoreSection = (
    <section className="space-y-4">
      <div>
        <div className="text-[13.8px] font-bold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          타고난 사주 점수
        </div>
        <h2 className="mt-1 text-[20.7px] font-extrabold text-[var(--app-ink)]">내 사주 종합 점수</h2>
        <p
          className="mt-1 text-[13.8px] leading-[1.5] text-[var(--app-copy-soft)]"
          style={{ wordBreak: 'keep-all' }}
        >
          타고난 사주 구조(일주·격국·용신·오행·관계)를 점수화한 값이에요.
        </p>
      </div>
      <ScoreLockGate isUnlocked={scoreUnlocked} slug={slug} gradeLabel={sajuScore.label.title}>
        <SajuScoreCard score={sajuScore} />
        <ScoreBreakdownCard score={sajuScore} />
      </ScoreLockGate>
    </section>
  );

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-12 sm:space-y-14">
        <SajuResultViewTracker slug={slug} />


        <div className="space-y-12 sm:space-y-14">
          {/* 2026-05-15 — 사용자 이름이 입력되어도 항상 "달빛이님 사주" 가 보이던 회귀 fix.
              input.name 이 있으면 그대로 사용, 없을 때만 "달빛이" fallback. */}
          <GangiPageHeader title={`${input.name ?? MOONLIGHT_FALLBACK_DISPLAY_NAME}님 사주`} backHref="/saju/new" />

          <section className="space-y-4 px-1">
            {/* 2026-05-15 handoff 52 m-reveal — 결과 카드 7개 stagger 등장.
                children 의 각 카드를 0.08s 간격으로 stagger reveal. useReducedMotion 자동 폴백. */}
            <MotionResultReveal staggerSeconds={0.08}>
            {/* §0 수호신 배정 — "내 띠의 수호신이 읽어주는 사주"(스펙 콘셉트)의 첫 카드. */}
            {guardian ? (
              <GuardianAssignmentCard
                guardian={guardian}
                viewerName={input.name ?? MOONLIGHT_FALLBACK_DISPLAY_NAME}
              />
            ) : null}
            {/* §1 Hero summary — ZodiacChip + "한 줄 요약" eyebrow + 헤드라인 + chips.
                chip 은 장식용 dragon 고정이었다가 2026-08-25 사용자 띠로 정렬. */}
            <article
              className="rounded-[18px] border border-[var(--app-line)] p-5"
              style={{ background: 'var(--app-pink-soft)' }}
            >
              <div className="flex items-center gap-2.5">
                <ZodiacChip kind={guardian?.key ?? 'dragon'} size="sm" />
                <div className="text-[13.8px] font-extrabold text-[var(--app-pink-strong)]">
                  한 줄 요약
                </div>
              </div>
              <h1 className="mt-3 text-[24.2px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
                {easyResultCopy(punchReading.verdict, 1)}
              </h1>
              {summaryChips.length > 0 ? (
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {summaryChips.map((point) => (
                    <span
                      key={point}
                      className="rounded-[12px] border border-[var(--app-pink-line)] bg-white px-3 py-1 text-[13.8px] font-bold text-[var(--app-pink-strong)]"
                    >
                      {point}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-[13.2px] leading-5 text-[var(--app-copy-muted)]">
                {formatBirthSummary(input)}
              </p>
            </article>

            {/* 2026-08-25 사용자 확정 — 결제 복귀 직후 "바로 보람": 구매자는 점수·대운·상세가
                최상단(요약 바로 뒤)에 온다. 상세는 오늘 자세히 화면과 동일 컴포넌트 인라인. */}
            {scoreUnlocked ? (
              <>
                {scoreSection}
                {lifetimeCycles.length > 0 ? (
                  <section id="daewoon" className="scroll-mt-24 space-y-4">
                    <h2 className="border-t border-[var(--app-line)] pt-6 text-[22.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      대운 — 10년 단위 큰 흐름
                    </h2>
                    <DaewoonSection cycles={lifetimeCycles} />
                  </section>
                ) : null}
                <section id="today-detail-inline" className="scroll-mt-24 space-y-4">
                  <h2 className="border-t border-[var(--app-line)] pt-6 text-[22.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                    상세 풀이 — 오늘 자세히
                  </h2>
                  <TodayFortuneDetailClient
                    sourceSessionId={slug}
                    concern={topic}
                    paidProduct="today-detail"
                    backHref={`/saju/${encodeURIComponent(slug)}`}
                    embedded
                  />
                </section>
              </>
            ) : null}

            {/* §1.55 PR #148 (Part B) — 사용자 입력 상황이 풀이에 반영됐음을 명시.
                personalizationContext.userSituation 이 있으면 chip 카드,
                없으면 amber CTA 카드로 "현재 상황 입력하기" 유도. */}
            <SituationReflectionCard
              situation={personalizationContext?.userSituation ?? null}
              fallbackInputHref="/saju/new"
            />

            {/* §1.6 narrative 카드 — 2026-05-15 P2. 일간 + 격국 + 용신 + 대운/세운을 한 단락
                narrative 로 엮어 사용자가 "이게 내 사주를 정리한 풀이" 라는 인과를 한 호흡에 받게 함.
                2026-05-15 cleanup: §1.5 일주 캐릭터 → 성향 탭, §1.7 격국·용신·강약 + §1.8 합충·공망·신살 → 명식 탭으로 이전.
                2026-05-21 — 총평 LLM(flag ON + source llm)이면 4단락 + 평생 활용 3카드, 아니면 기존 단락 카드. */}
            {totalReviewLLMActive && personalizationContext ? (
              <Suspense fallback={<TotalReviewSkeleton />}>
                <TotalReviewSection
                  args={{
                    sajuData,
                    personalizationContext,
                    userName: input.name?.trim() || null,
                    gender: input.gender === 'female' ? 'F' : input.gender === 'male' ? 'M' : null,
                  }}
                  fallbackNarrative={sajuNarrative}
                />
              </Suspense>
            ) : (
              <SajuNarrativeCard narrative={sajuNarrative} />
            )}

            {/* §2 4 pillars — 시·일·월·연 한자 + 한국명 + element color */}
            <section>
              <div className="mb-2.5 flex items-end justify-between">
                <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">사주팔자</h2>
                <Link
                  href={`/saju/${encodeURIComponent(slug)}/overview`}
                  className="text-[13.8px] font-bold text-[var(--app-pink-strong)]"
                >
                  도식 보기 →
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {pillars.map((item) => {
                  const pillar = item.pillar;
                  const stemColor = pillar?.stemElement
                    ? ELEMENT_INFO[pillar.stemElement].color
                    : 'var(--app-ink)';
                  return (
                    <article
                      key={item.label}
                      className="rounded-[14px] border border-[var(--app-line)] bg-white px-2.5 py-3 text-center"
                    >
                      <div className="text-[12.1px] font-bold text-[var(--app-copy-soft)]">
                        {item.label}주
                      </div>
                      <div
                        className="mt-1.5 text-[27.6px] font-bold leading-none tracking-wider"
                        style={{
                          fontFamily: 'var(--font-han)',
                          color: stemColor,
                        }}
                      >
                        {pillar?.stem ?? '-'}
                        {pillar?.branch ?? ''}
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="mt-2 text-[12.6px] leading-5 text-[var(--app-copy-soft)]">
                {report.focusBadge} 시점
              </p>
            </section>

            {/* §2.4 종합사주 리포트 목차 — Phase 1 간판(bundle_comprehensive) 업셀.
                만신령식 "무료 ✓ + 잠김 🔒" 리스트. 점수 미해제(=종합 미구매의 근사)일 때만.
                개인화 훅은 대운 타임라인(무료 deep 와 동일 결정론 빌더)에서 다음 전환 나이를 뽑는다. */}
            {/* 2026-08-25 단일 페이지 합성(사용자 확정 순서) — 무료 섹션(명식·성향·오행)을
                9,900 결제 영역(목차·점수 잠금) **위**에 둔다: 무료 가치를 다 보여준 뒤 결제.
                대운은 결제자 전용(아래) — 훅("그 10년의 흐름이 잠긴 항목 안에")과 정합.
                구 탭 라우트는 앵커로 리다이렉트(id 변경 시 리다이렉트도 같이). */}
            <section id="myeongsik" className="scroll-mt-24 space-y-4">
              <h2 className="border-t border-[var(--app-line)] pt-6 text-[22.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                명식 — 내 사주의 뼈대
              </h2>
              <MyeongsikSection sajuData={sajuData} grounding={grounding} />
            </section>

            <section id="nature" className="scroll-mt-24 space-y-4">
              <h2 className="border-t border-[var(--app-line)] pt-6 text-[22.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                성향 — 타고난 기질
              </h2>
              <NatureSection sajuData={sajuData} grounding={grounding} />
            </section>

            <section id="elements" className="scroll-mt-24 space-y-4">
              <h2 className="border-t border-[var(--app-line)] pt-6 text-[22.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                오행 — 기운의 균형
              </h2>
              <ElementsSection sajuData={sajuData} />
            </section>

            {!scoreUnlocked ? (
              <div id="comprehensive-toc">
                <ComprehensiveToc
                  slug={slug}
                  hookLine={comprehensiveHook}
                  priceLabel={priceLabelFromMap(priceMap, 'bundle_comprehensive')}
                  compareLabel={compareLabelFromMap(priceMap, 'bundle_comprehensive')}
                />
              </div>
            ) : null}

            {/* §2.5 사주 종합 점수 — 미구매자 위치(잠금 게이트+스티키 CTA). 구매자는 최상단. */}
            {!scoreUnlocked ? scoreSection : null}

            {/* 결제 동선(2026-08-25 확정) — 미구매자에겐 페이지 전체에서 가격 오퍼는
                9,900 종합 리포트 **하나**: 중간 목차(설득) + 하단 고정 CTA(기존
                ScoreLockGate 스티키 바 '17항목 전부 열기'가 담당 — 별도 레이어를 새로
                만들었다가 중복이라 제거했다). 상세(평생 리포트 49,000)는 **구매자에게만**
                다음 단계로 — 한 화면에 가격 하나 원칙. */}
            {scoreUnlocked ? (
              <article
                className="rounded-[18px] p-5 text-white"
                style={{ background: 'var(--app-ink)', boxShadow: '0 18px 44px rgba(15,23,42,0.18)' }}
              >
                <div
                  className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--app-pink)' }}
                >
                  다음 단계
                </div>
                <h2 className="mt-1.5 text-[20.7px] font-extrabold leading-snug tracking-tight">
                  상세 풀이 — 평생 소장 리포트
                </h2>
                <p className="mt-2 text-[14.4px] leading-[1.55]" style={{ opacity: 0.72 }}>
                  대운 8단 + 세운 30년 + 십성 디테일 + PDF 보관까지, 평생 다시 꺼내 보는 상세판.
                </p>
                <Link
                  href={`/saju/${encodeURIComponent(slug)}/premium`}
                  className="mt-4 inline-flex items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white no-underline"
                >
                  상세 풀이 보기 →
                </Link>
              </article>
            ) : null}


            {/* §4 더 보고 싶은 질문 — 가격 pill + 제목 + 한 줄 */}
            <section>
              <div className="text-[13.8px] font-bold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                작은 풀이
              </div>
              <h2 className="mt-1 text-[20.7px] font-extrabold text-[var(--app-ink)]">
                더 보고 싶은 질문
              </h2>
              <div className="mt-3 grid gap-2.5">
                {SMALL_PICKS.map((pick) => (
                  <TrackedLink
                    key={pick.eventProduct}
                    href={pick.href}
                    eventName="report_deep_report_click"
                    eventParams={{
                      slug,
                      product: pick.eventProduct,
                      from: 'result_small_picks',
                    }}
                    className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                  >
                    {/* 2026-07-19 — 가격 배지가 h-12 w-12 **고정 정사각**이라 글자가 박스를
                        벗어났다("49,000원"은 48px 안에 들어갈 수 없다). 전역 폰트 확대 이후
                        더 심해졌다. 폭을 내용에 맞추고(고정폭 제거) 세로 여백만 유지한다.
                        whitespace-nowrap 으로 금액이 줄바꿈되지 않게 한다. */}
                    <div
                      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] px-2.5 py-2 text-[13.8px] font-extrabold text-[var(--app-pink-strong)]"
                      style={{
                        background: 'var(--app-pink-soft)',
                        border: '1px solid var(--app-pink-line)',
                      }}
                    >
                      {pick.priceKey ? priceLabelFromMap(priceMap, pick.priceKey) : pick.price}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[16.7px] font-extrabold tracking-tight text-[var(--app-ink)]">
                        {pick.label}
                      </div>
                      <div className="mt-0.5 text-[13.8px] text-[var(--app-copy-soft)]">
                        {pick.desc}
                      </div>
                    </div>
                    <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
                      ›
                    </span>
                  </TrackedLink>
                ))}
              </div>
            </section>

            {/* §5 Next-step CTA — ink-dark "선생님과 대화하기" */}
            <article
              className="rounded-[18px] p-5 text-white"
              style={{
                background: 'var(--app-ink)',
                boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
              }}
            >
              <div
                className="text-[13.8px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink)' }}
              >
                다음 단계
              </div>
              <h2 className="mt-1.5 text-[20.7px] font-extrabold leading-snug tracking-tight">
                깊은 풀이와 대화로
                <br />
                이어가 보세요
              </h2>
              {/* 2026-07-19 — 가로 배치에서 버튼이 눌려 **글자가 버튼 안에서 두 줄로 꺾이던** 문제.
                  버튼은 내용 폭을 지키고(shrink-0 + nowrap), 자리가 부족하면 글자가 아니라
                  **버튼 단위로** 줄바꿈되게 flex-wrap 을 준다. */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <TrackedLink
                  href="/dialogue"
                  eventName="report_deep_report_click"
                  eventParams={{
                    slug,
                    product: 'dialogue',
                    from: 'result_next_step',
                  }}
                  className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  선생님과 대화하기 →
                </TrackedLink>
                {/* 2026-05-16 A7 — TodayDetailResultCta 클라이언트 wrapper.
                    서버 todayDetailEntitlement 를 initialEntitlement 로 전달 →
                    focus 시 자동 재요청 (다른 탭 결제 후 실시간 반영). */}
                <TodayDetailResultCta
                  slug={slug}
                  initialEntitlement={{
                    hasEntitlement: Boolean(todayDetailEntitlement),
                    openHref: todayDetailEntitlement
                      ? buildSajuTodayDetailHref(slug)
                      : null,
                    reason: todayDetailEntitlement ? 'product-purchased' : null,
                    hasLegacyCoins: false,
                    memberFreeEligible: false,
                  }}
                  unpaidHref={buildSajuTodayDetailCheckoutHref(slug)}
                  unpaidLabel={`오늘 자세히 · ${priceLabelFromMap(priceMap, 'saju_entry')}`}
                  ownedLabel="구매한 풀이 열기"
                  className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] border border-white/24 px-5 py-3 text-[15px] font-bold text-white/85"
                />
                {/* Task 7 — 크로스링크: 저장된 공통 프로필로 재입력 없이 오늘운세로 전환.
                    위 TodayDetailResultCta 와 동일한 ghost pill 스타일. */}
                <Link
                  href="/today-fortune"
                  className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] border border-white/24 px-5 py-3 text-[15px] font-bold text-white/85"
                >
                  이 정보로 오늘의 운세 보기
                </Link>
              </div>
            </article>
            {/* 2026-05-15 handoff 52 m-reveal 닫음 — §1 ~ §5 카드만 stagger. 하단 details 는 접힘 기본이라 모션 대상 외. */}
            </MotionResultReveal>

            {/* 2026-07-20 — '더 들여다볼 곳'(탭 안내 카드) 제거(사용자 요청).
                바로 아래 PaidFunnelGrid 가 메뉴 리스트를 이미 보여주고 있어 역할이 겹쳤다.
                탭 자체는 상단 탭바에 그대로 있으므로 진입 경로는 잃지 않는다. */}
          </section>

          {/* 2026-07-19 — 하단 추천을 8개 메뉴 전 화면에 동일 노출(사용자 요청).
              from="saju" 가 목록에서 사주 자신을 제외한다. */}
          <PaidFunnelGrid from="saju" tone="light" className="mt-6" />

          {/* Task 8 — 카카오 친구추가 무료쿠폰 CTA. 사주 결과 화면 맨 아래. */}
          <div className="px-1">
            <KakaoFriendCouponCta />
          </div>
        </div>
      </AppPage>
    </AppShell>
  );
}
