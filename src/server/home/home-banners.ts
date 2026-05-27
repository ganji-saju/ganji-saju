import { unstable_cache } from 'next/cache';
import type { GangiHomeBanner } from '@/content/gangi-market';
import { STAR_SIGN_FORTUNES, ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { generateAiText } from '@/server/ai/openai-text';

const SEOUL_TIME_ZONE = 'Asia/Seoul';

const zodiacKeyMap = {
  rat: 'rat',
  ox: 'ox',
  tiger: 'tiger',
  rabbit: 'rabbit',
  dragon: 'dragon',
  snake: 'snake',
  horse: 'horse',
  goat: 'sheep',
  monkey: 'monkey',
  rooster: 'rooster',
  dog: 'dog',
  pig: 'pig',
} as const;

const dailyFallbacks = [
  {
    title: '작은 선택이 하루의 방향을 바꾸는 날',
    description: '크게 벌리기보다 지금 필요한 한 가지를 먼저 골라보세요.',
  },
  {
    title: '마음을 가볍게 정리하면 운이 붙는 날',
    description: '오늘은 복잡한 생각보다 바로 할 수 있는 행동 하나가 중요해요.',
  },
  {
    title: '천천히 확인할수록 흐름이 선명해지는 날',
    description: '서두른 결정은 줄이고, 연락과 약속은 한 번 더 살펴보세요.',
  },
  {
    title: '기분 좋은 신호를 놓치지 말아야 할 날',
    description: '작은 제안이나 메시지 안에 다음 선택의 힌트가 들어올 수 있어요.',
  },
  {
    title: '오늘은 정리와 시작이 함께 오는 날',
    description: '미뤄둔 일을 하나 끝내면 새로운 흐름이 훨씬 가볍게 열립니다.',
  },
] as const;

function getSeoulDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

function getKoreanDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function hash(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

function pickByDate<T>(items: readonly T[], dateKey: string, salt: string) {
  return items[hash(`${dateKey}:${salt}`) % items.length] ?? items[0];
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function compactText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildFallbackDailyCopy(dateKey: string) {
  const fallback = pickByDate(dailyFallbacks, dateKey, 'daily-line');
  const dateLabel = getKoreanDateLabel(dateKey);

  return {
    title: `${dateLabel}, ${fallback.title}`,
    description: fallback.description,
  };
}

async function buildDailyCopy(dateKey: string) {
  const fallback = buildFallbackDailyCopy(dateKey);
  const result = await generateAiText({
    feature: 'home_banner',
    instructions: [
      '간지사주 홈 메인 배너에 들어갈 오늘의 운세 한 줄을 씁니다.',
      '사용자는 모바일에서 빠르게 운세를 눌러보는 일반 사용자입니다.',
      '어려운 명리 용어, 공포 문구, AI 메타 설명, 과장된 적중률 문구을 쓰지 않습니다.',
      'JSON만 출력합니다. 키는 title, description 두 개만 씁니다.',
      'title은 반드시 날짜로 시작합니다. 예: "5월 6일, ..."',
      'title은 34자 이내, description은 44자 이내로 씁니다.',
    ].join('\n'),
    input: JSON.stringify({
      date: getKoreanDateLabel(dateKey),
      service: '간지사주',
      tone: '짧고 따뜻한 모바일 운세',
    }),
    fallbackText: JSON.stringify(fallback),
    maxOutputTokens: 160,
    timeoutMs: 8000,
  });

  try {
    const parsed = JSON.parse(stripJsonFence(result.text)) as Record<string, unknown>;
    const title = compactText(parsed.title, 42);
    const description = compactText(parsed.description, 54);

    if (title && description) {
      return { title, description };
    }
  } catch {
    // fallback below
  }

  return fallback;
}

function buildZodiacBanner(dateKey: string): GangiHomeBanner {
  const selected = pickByDate(ZODIAC_FORTUNES, dateKey, 'zodiac-banner');
  const zodiac = zodiacKeyMap[selected.slug as keyof typeof zodiacKeyMap] ?? 'rooster';

  return {
    id: `zodiac-${selected.slug}`,
    kicker: '오늘의 띠',
    title: `${selected.label}, ${selected.todayFocus}`,
    description: selected.action,
    cta: `${selected.label} 운세 보기`,
    href: `/zodiac/${selected.slug}`,
    zodiac,
    tone: 'soft',
  };
}

function buildStarBanner(dateKey: string): GangiHomeBanner {
  const selected = pickByDate(STAR_SIGN_FORTUNES, dateKey, 'star-banner');

  return {
    id: `star-${selected.slug}`,
    kicker: '오늘의 별자리',
    title: `${selected.label}, ${selected.todayFocus}`,
    description: selected.action,
    cta: `${selected.label} 보기`,
    href: `/star-sign/${selected.slug}`,
    tone: 'night',
  };
}

const getCachedHomeBanners = unstable_cache(
  async (dateKey: string): Promise<readonly GangiHomeBanner[]> => {
    const dailyCopy = await buildDailyCopy(dateKey);

    return [
      {
        id: `today-flow-${dateKey}`,
        kicker: '오늘의 한 줄',
        title: dailyCopy.title,
        description: dailyCopy.description,
        cta: '오늘운세 보러가기',
        href: '/today-fortune?concern=general',
        tone: 'pink',
      },
      buildZodiacBanner(dateKey),
      buildStarBanner(dateKey),
    ];
  },
  ['home-banners-v1'],
  {
    revalidate: 60 * 60 * 24,
  }
);

export async function getHomeBanners(now = new Date()) {
  const dateKey = getSeoulDateKey(now);
  return getCachedHomeBanners(dateKey);
}
