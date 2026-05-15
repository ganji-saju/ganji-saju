// 2026-05-16 — 오늘 별자리 일진 다이제스트.
// 12 sign 의 오늘 운세를 한 번에 계산해 TOP 3 + 주의 1 + 원소 흐름 + 모드 분포로 요약.
// /notifications 페이지 카드 + 향후 push 알림 본문에서 사용.

import { STAR_SIGN_META } from '@/content/moonlight';
import { STAR_SIGN_FORTUNES } from '@/lib/free-content-pages';
import { getDailyFortune, toKstDateKey } from './daily-fortune';
import {
  STAR_SIGN_CONTENT,
  type SignElement,
  type StarSignSlug,
} from './sign-content';

export interface DigestSignEntry {
  slug: StarSignSlug;
  label: string;
  symbol: string;
  overall: number;
  highlight: string;
  element: SignElement;
}

export interface StarSignDailyDigest {
  dateKey: string;
  /** 상위 3 별자리 (총운 내림차순). */
  topThree: DigestSignEntry[];
  /** 가장 낮은 1 별자리. */
  caution: DigestSignEntry;
  /** 오늘 가장 점수가 높은 원소 (4 원소 평균 내 최고). */
  bestElement: { element: SignElement; label: string; averageScore: number };
  /** 12 sign 평균. */
  globalAverage: number;
  /** Mood 분포 — fire/calm/dynamic/sensitive 카운트. */
  moodDistribution: Record<'warm' | 'calm' | 'dynamic' | 'sensitive', number>;
  /** push notification body 후보 (3 가지). */
  notificationCandidates: string[];
}

const ELEMENT_LABEL: Record<SignElement, string> = {
  fire: '불',
  earth: '땅',
  air: '공기',
  water: '물',
};

/** 오늘 별자리 일진 산출 — KST 자정 기준. */
export function computeStarSignDailyDigest(dateKey: string = toKstDateKey()): StarSignDailyDigest {
  // 12 sign 일괄 계산.
  const entries: DigestSignEntry[] = STAR_SIGN_FORTUNES.map((item) => {
    const slug = item.slug as StarSignSlug;
    const content = STAR_SIGN_CONTENT[slug];
    const meta = STAR_SIGN_META[slug as keyof typeof STAR_SIGN_META];
    const fortune = getDailyFortune(slug, dateKey);
    return {
      slug,
      label: item.label,
      symbol: meta?.symbol ?? '',
      overall: fortune.scores.overall,
      highlight: fortune.highlight,
      element: content.element,
    };
  });

  const sorted = [...entries].sort((a, b) => b.overall - a.overall);
  const topThree = sorted.slice(0, 3);
  const caution = sorted[sorted.length - 1]!;

  // 원소별 평균.
  const elementSum: Record<SignElement, { sum: number; count: number }> = {
    fire: { sum: 0, count: 0 },
    earth: { sum: 0, count: 0 },
    air: { sum: 0, count: 0 },
    water: { sum: 0, count: 0 },
  };
  for (const e of entries) {
    elementSum[e.element].sum += e.overall;
    elementSum[e.element].count += 1;
  }
  let bestElement: SignElement = 'fire';
  let bestAvg = -1;
  for (const el of Object.keys(elementSum) as SignElement[]) {
    const avg = elementSum[el].sum / Math.max(1, elementSum[el].count);
    if (avg > bestAvg) {
      bestAvg = avg;
      bestElement = el;
    }
  }

  const globalAverage = entries.reduce((acc, e) => acc + e.overall, 0) / entries.length;

  // mood 분포 — 각 sign 의 element 에서 결정.
  const ELEMENT_MOOD: Record<SignElement, 'warm' | 'calm' | 'dynamic' | 'sensitive'> = {
    fire: 'dynamic',
    earth: 'calm',
    air: 'warm',
    water: 'sensitive',
  };
  const moodDistribution = {
    warm: 0,
    calm: 0,
    dynamic: 0,
    sensitive: 0,
  };
  for (const e of entries) {
    moodDistribution[ELEMENT_MOOD[e.element]] += 1;
  }

  // notification body 후보 (KST 자정 기준 매일 변함).
  const notificationCandidates = [
    `오늘 가장 맑은 별자리는 ${topThree[0]!.label} (${topThree[0]!.overall}점). ${topThree[0]!.highlight}`,
    `${ELEMENT_LABEL[bestElement]} 원소 별자리 평균 ${bestAvg.toFixed(1)}점 — 오늘 ${ELEMENT_LABEL[bestElement]} 분위기가 가장 좋아요.`,
    `${caution.label}는 살짝 주의 (${caution.overall}점). ${caution.highlight}`,
  ];

  return {
    dateKey,
    topThree,
    caution,
    bestElement: {
      element: bestElement,
      label: ELEMENT_LABEL[bestElement],
      averageScore: Number(bestAvg.toFixed(1)),
    },
    globalAverage: Number(globalAverage.toFixed(1)),
    moodDistribution,
    notificationCandidates,
  };
}

/** 사용자 별자리 기준 push body 한 줄 (없으면 일반 후보). */
export function getStarSignPushBodyFor(
  slug: StarSignSlug | null,
  digest: StarSignDailyDigest = computeStarSignDailyDigest()
): string {
  if (!slug) return digest.notificationCandidates[0]!;
  const mine = [...digest.topThree, digest.caution].find((d) => d.slug === slug);
  if (mine) {
    return `${mine.label} 오늘 ${mine.overall}점 — ${mine.highlight}`;
  }
  // top 3 도 caution 도 아니면 정상 운세 — daily-fortune 에서 가져온 본인 데이터.
  const fortune = getDailyFortune(slug, digest.dateKey);
  const item = STAR_SIGN_FORTUNES.find((s) => s.slug === slug);
  return `${item?.label ?? '내 별자리'} 오늘 ${fortune.scores.overall}점 — ${fortune.highlight}`;
}
