// 2026-05-14: 통합 검색 인덱스.
// /api/search 가 여기서 hits 를 가져온다. 메뉴 + 관련 풀이 + 꿈해몽 + 12간지/별자리.
// 모두 정적이므로 클라이언트가 무한 fetch 해도 비용은 거의 0.

import { DREAM_DICTIONARY } from '@/lib/dream-dictionary';

export type SearchCategory = '운세 메뉴' | '관련 풀이' | '꿈해몽' | '띠/별자리';

export interface SearchHit {
  category: SearchCategory;
  title: string;
  description: string;
  href: string;
  zodiacKey?: string; // ZodiacKey 문자열 (client 에서만 의미)
  keywords: string[];
}

const MENU_HITS: SearchHit[] = [
  {
    category: '운세 메뉴',
    title: '연애 마음 확인',
    description: '9,900원 · 작은 풀이',
    // /saju/new 는 love-question(연애/궁합 상품)을 처리하지 않음(saju 상품만). 궁합 입구로 연결.
    href: '/compatibility/input',
    zodiacKey: 'rabbit',
    keywords: ['연애', '사랑', '관계', '마음', '여친', '남친', '썸'],
  },
  {
    category: '운세 메뉴',
    title: '궁합 보기',
    description: '두 사람의 흐름 · 76점부터',
    href: '/compatibility/input',
    zodiacKey: 'sheep',
    keywords: ['궁합', '연애', '커플', '결혼', '약혼'],
  },
  {
    category: '운세 메뉴',
    title: '재회 타로',
    description: '관계가 다시 움직일 여지를 확인',
    href: '/tarot/daily',
    zodiacKey: 'rabbit',
    keywords: ['연애', '재회', '타로', '관계', '이별'],
  },
  {
    category: '운세 메뉴',
    title: '오늘운세',
    description: '오늘 한 줄과 조심할 것',
    href: '/today-fortune',
    zodiacKey: 'rooster',
    keywords: ['오늘', '오늘운세', '데일리', '하루'],
  },
  {
    category: '운세 메뉴',
    title: '돈이 새는 패턴',
    description: '9,900원 · 재물 흐름의 약한 지점',
    href: '/saju/new?product=money-pattern',
    zodiacKey: 'tiger',
    keywords: ['재물', '돈', '재테크', '소비', '저축'],
  },
  {
    category: '운세 메뉴',
    title: '일/직장 흐름',
    description: '9,900원 · 오늘의 말, 역할, 타이밍',
    href: '/saju/new?product=work-flow',
    zodiacKey: 'dragon',
    keywords: ['직장', '이직', '일', '업무', '커리어', '회사'],
  },
  {
    category: '운세 메뉴',
    title: '내 사주 풀이',
    description: '깊은 사주풀이 + PDF · 49,000원',
    href: '/saju/new',
    zodiacKey: 'dragon',
    keywords: ['사주', '명리', '갑신일주', '운명', '팔자'],
  },
  {
    category: '운세 메뉴',
    title: '띠운세',
    description: '12 띠별 오늘 한 줄',
    href: '/zodiac',
    zodiacKey: 'rooster',
    keywords: ['띠', '띠운세', '12간지', '쥐', '소', '호랑이'],
  },
  {
    category: '운세 메뉴',
    title: '별자리',
    description: '12 별자리 오늘 흐름',
    href: '/star-sign',
    zodiacKey: 'rabbit',
    keywords: ['별자리', '12궁', '점성술'],
  },
  {
    category: '운세 메뉴',
    title: '꿈해몽',
    description: '꿈 단어 사전',
    href: '/dream',
    keywords: ['꿈', '꿈해몽', '풀이'],
  },
  {
    category: '운세 메뉴',
    title: '1:1 상담 예약',
    description: '선생님과 30분 1:1 상담',
    href: '/dialogue/appointment',
    zodiacKey: 'tiger',
    keywords: ['상담', '예약', '1:1', '대화', '선생님', '명리호'],
  },
  // 관련 풀이
  {
    category: '관련 풀이',
    title: '연애운이 좋은 시기 알아보는 법',
    description: '명리 기본',
    href: '/saju/new',
    keywords: ['연애', '시기', '명리'],
  },
  {
    category: '관련 풀이',
    title: '갑신일주의 연애 스타일',
    description: '일주별 풀이',
    href: '/saju/new',
    keywords: ['갑신일주', '연애', '일주'],
  },
  {
    category: '관련 풀이',
    title: '궁합 점수가 낮을 때 보는 포인트',
    description: '궁합 가이드',
    href: '/compatibility/input',
    keywords: ['궁합', '점수', '관계'],
  },
  {
    category: '관련 풀이',
    title: '오늘 흐름이 가벼운 시간대 찾기',
    description: '데일리 가이드',
    href: '/today-fortune',
    keywords: ['오늘', '시간', '데일리'],
  },
];

const ZODIAC_HITS: SearchHit[] = [
  ['rat', '쥐', '子'],
  ['ox', '소', '丑'],
  ['tiger', '호랑이', '寅'],
  ['rabbit', '토끼', '卯'],
  ['dragon', '용', '辰'],
  ['snake', '뱀', '巳'],
  ['horse', '말', '午'],
  ['sheep', '양', '未'],
  ['monkey', '원숭이', '申'],
  ['rooster', '닭', '酉'],
  ['dog', '개', '戌'],
  ['pig', '돼지', '亥'],
].map(([key, name, han]) => ({
  category: '띠/별자리' as const,
  title: `${name}띠 운세`,
  description: `${han} · 12간지 ${name}띠 오늘 흐름`,
  href: `/zodiac/${key}`,
  zodiacKey: key,
  keywords: [name, `${name}띠`, han, '띠운세', '12간지'],
}));

const STAR_SIGN_HITS: SearchHit[] = [
  ['aries', '양자리', '3.21–4.19'],
  ['taurus', '황소자리', '4.20–5.20'],
  ['gemini', '쌍둥이자리', '5.21–6.21'],
  ['cancer', '게자리', '6.22–7.22'],
  ['leo', '사자자리', '7.23–8.22'],
  ['virgo', '처녀자리', '8.23–9.22'],
  ['libra', '천칭자리', '9.23–10.22'],
  ['scorpio', '전갈자리', '10.23–11.22'],
  ['sagittarius', '사수자리', '11.23–12.21'],
  ['capricorn', '염소자리', '12.22–1.19'],
  ['aquarius', '물병자리', '1.20–2.18'],
  ['pisces', '물고기자리', '2.19–3.20'],
].map(([slug, name, range]) => ({
  category: '띠/별자리' as const,
  title: `${name} 오늘 흐름`,
  description: `${range} · 별자리`,
  href: `/star-sign/${slug}`,
  keywords: [name, '별자리', '12궁', '점성술'],
}));

const DREAM_HITS: SearchHit[] = Object.values(DREAM_DICTIONARY).map((entry) => ({
  category: '꿈해몽' as const,
  title: `${entry.keyword} 꿈`,
  description: entry.summary.split('.')[0] + '.',
  href: `/dream?q=${encodeURIComponent(entry.keyword)}`,
  keywords: [entry.keyword, ...entry.related],
}));

const ALL_HITS: SearchHit[] = [
  ...MENU_HITS,
  ...ZODIAC_HITS,
  ...STAR_SIGN_HITS,
  ...DREAM_HITS,
];

export function runSearch(query: string): SearchHit[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [];

  return ALL_HITS.filter((hit) => {
    if (hit.title.toLowerCase().includes(q)) return true;
    if (hit.description.toLowerCase().includes(q)) return true;
    return hit.keywords.some((k) => k.toLowerCase().includes(q));
  });
}

export const TRENDING_KEYWORDS: Array<{ rank: number; keyword: string; up: boolean }> = [
  { rank: 1, keyword: '2026 신년운세', up: true },
  { rank: 2, keyword: '갑신일주 운명', up: true },
  { rank: 3, keyword: '재물운 좋은 날', up: false },
  { rank: 4, keyword: '궁합 보는 법', up: true },
  { rank: 5, keyword: '이직 타이밍', up: false },
];
