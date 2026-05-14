// Redesign 2026-05-13 (Claude Design / screens-e.jsx ScreenSearch):
// 신규 /search — 빈 입력 (최근 검색 + 실시간 인기 + 추천 카테고리) /
// 결과 (운세 메뉴 + 관련 풀이 + 하이라이트) / 결과 없음 (96px ? + 추천 칩 + CTA).
// 실제 검색 API 가 없어 정적 매칭으로 구성.
'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface SearchHit {
  category: '운세 메뉴' | '관련 풀이';
  title: string;
  description: string;
  href: string;
  zodiac?: ZodiacKey;
  keywords: string[];
}

const STATIC_HITS: SearchHit[] = [
  {
    category: '운세 메뉴',
    title: '연애 마음 확인',
    description: '990원 · 작은 풀이',
    href: '/saju/new?product=love-question',
    zodiac: 'rabbit',
    keywords: ['연애', '사랑', '관계', '마음'],
  },
  {
    category: '운세 메뉴',
    title: '궁합 보기',
    description: '두 사람의 흐름 · 76점부터',
    href: '/compatibility/input',
    zodiac: 'sheep',
    keywords: ['궁합', '연애', '커플', '결혼'],
  },
  {
    category: '운세 메뉴',
    title: '재회 타로',
    description: '관계가 다시 움직일 여지를 확인',
    href: '/tarot/daily',
    zodiac: 'rabbit',
    keywords: ['연애', '재회', '타로', '관계'],
  },
  {
    category: '운세 메뉴',
    title: '오늘운세',
    description: '오늘 한 줄과 조심할 것',
    href: '/today-fortune',
    zodiac: 'rooster',
    keywords: ['오늘', '오늘운세', '데일리'],
  },
  {
    category: '운세 메뉴',
    title: '돈이 새는 패턴',
    description: '990원 · 재물 흐름의 약한 지점',
    href: '/saju/new?product=money-pattern',
    zodiac: 'tiger',
    keywords: ['재물', '돈', '재테크', '소비'],
  },
  {
    category: '운세 메뉴',
    title: '일/직장 흐름',
    description: '990원 · 오늘의 말, 역할, 타이밍',
    href: '/saju/new?product=work-flow',
    zodiac: 'dragon',
    keywords: ['직장', '이직', '일', '업무'],
  },
  {
    category: '운세 메뉴',
    title: '내 사주 풀이',
    description: '깊은 사주풀이 + PDF · 49,000원',
    href: '/saju/new',
    zodiac: 'dragon',
    keywords: ['사주', '명리', '갑신일주', '운명'],
  },
  {
    category: '운세 메뉴',
    title: '띠운세',
    description: '12 띠별 오늘 한 줄',
    href: '/zodiac',
    zodiac: 'rooster',
    keywords: ['띠', '띠운세', '12간지'],
  },
  {
    category: '운세 메뉴',
    title: '별자리',
    description: '12 별자리 오늘 흐름',
    href: '/star-sign',
    zodiac: 'rabbit',
    keywords: ['별자리', '12궁', '점성술'],
  },
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

const TRENDING_NOW: Array<{ rank: number; keyword: string; up: boolean }> = [
  { rank: 1, keyword: '2026 신년운세', up: true },
  { rank: 2, keyword: '갑신일주 운명', up: true },
  { rank: 3, keyword: '재물운 좋은 날', up: false },
  { rank: 4, keyword: '궁합 보는 법', up: true },
  { rank: 5, keyword: '이직 타이밍', up: false },
];

const RECOMMENDED: Array<{ label: string; zodiac: ZodiacKey; href: string }> = [
  { label: '오늘운세', zodiac: 'rooster', href: '/today-fortune' },
  { label: '연애 풀이', zodiac: 'rabbit', href: '/saju/new?product=love-question' },
  { label: '이직 타이밍', zodiac: 'tiger', href: '/saju/new?product=work-flow' },
  { label: '재물 흐름', zodiac: 'dragon', href: '/saju/new?product=money-pattern' },
];

const RECENT_FALLBACK = ['연애', '재물', '이직', '갑신일주', '5월 운세'];
const SUGGEST_CHIPS = ['오늘운세', '내 사주', '궁합', '재물운', '이직 타이밍'];

function highlight(text: string, q: string) {
  if (!q.trim()) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className="rounded-[3px] px-0.5"
        style={{
          background: 'var(--app-pink-soft)',
          color: 'var(--app-pink-strong)',
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function searchHits(query: string): SearchHit[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return STATIC_HITS.filter((hit) => {
    if (hit.title.toLowerCase().includes(q)) return true;
    if (hit.description.toLowerCase().includes(q)) return true;
    return hit.keywords.some((k) => k.toLowerCase().includes(q));
  });
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);

  const hits = useMemo(() => searchHits(query), [query]);
  const menuHits = hits.filter((h) => h.category === '운세 메뉴');
  const articleHits = hits.filter((h) => h.category === '관련 풀이');
  const totalCount = hits.length;

  const mode: 'empty-input' | 'empty-results' | 'results' = query.trim()
    ? totalCount === 0
      ? 'empty-results'
      : 'results'
    : 'empty-input';

  function applyQuery(next: string) {
    setQuery(next);
    const params = new URLSearchParams();
    if (next.trim()) params.set('q', next);
    router.replace(`/search${params.toString() ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page">
        {/* Sticky search bar */}
        <header
          className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-[var(--app-line)] bg-white/95 px-4 py-3 backdrop-blur"
        >
          <Link
            href="/"
            aria-label="뒤로"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--app-line)] bg-white"
          >
            ‹
          </Link>
          <div
            className="flex h-10 flex-1 items-center gap-2 rounded-[12px] px-3"
            style={{ background: 'rgba(0,0,0,0.04)' }}
          >
            <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
              ⌕
            </span>
            <input
              value={query}
              onChange={(event) => applyQuery(event.target.value)}
              placeholder="궁금한 것을 검색하세요"
              autoFocus
              className="flex-1 bg-transparent text-[14px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => applyQuery('')}
                className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[var(--app-line)] text-[11px] text-white"
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            ) : null}
          </div>
        </header>

        <section className="space-y-5 px-1 pt-4">
          {mode === 'results' ? (
            <>
              <div className="text-[11px] font-extrabold text-[var(--app-copy-soft)]">
                <span className="text-[var(--app-pink-strong)]">&ldquo;{query}&rdquo;</span>{' '}
                검색 결과 {totalCount}건
              </div>

              {menuHits.length > 0 ? (
                <section>
                  <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">운세 메뉴</h2>
                  <div className="mt-2.5 grid gap-2">
                    {menuHits.map((hit) => (
                      <Link
                        key={hit.title}
                        href={hit.href}
                        className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
                      >
                        {hit.zodiac ? <ZodiacChip kind={hit.zodiac} size="sm" /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                            {highlight(hit.title, query)}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
                            {hit.description}
                          </div>
                        </div>
                        <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
                          ›
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {articleHits.length > 0 ? (
                <section>
                  <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">관련 풀이</h2>
                  <div className="mt-2.5 grid gap-2">
                    {articleHits.map((hit) => (
                      <Link
                        key={hit.title}
                        href={hit.href}
                        className="block rounded-[14px] border border-[var(--app-line)] bg-white p-3"
                      >
                        <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                          {highlight(hit.title, query)}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--app-copy-soft)]">
                          {hit.description}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {mode === 'empty-input' ? (
            <>
              <section>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  최근 검색어
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {RECENT_FALLBACK.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => applyQuery(tag)}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--app-copy-muted)]"
                    >
                      {tag}
                      <span className="text-[10px] text-[var(--app-copy-soft)]" aria-hidden="true">
                        ✕
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  실시간 인기 검색
                </div>
                <article className="mt-2.5 overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white">
                  {TRENDING_NOW.map((item, index) => (
                    <button
                      key={item.rank}
                      type="button"
                      onClick={() => applyQuery(item.keyword)}
                      className={
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--app-pink-soft)]' +
                        (index < TRENDING_NOW.length - 1
                          ? ' border-b border-[var(--app-line)]'
                          : '')
                      }
                    >
                      <span
                        className="w-5 text-[14px] font-extrabold"
                        style={{
                          color:
                            item.rank <= 3
                              ? 'var(--app-pink-strong)'
                              : 'var(--app-copy-soft)',
                          fontFamily: 'var(--font-han)',
                        }}
                        aria-hidden="true"
                      >
                        {item.rank}
                      </span>
                      <span className="flex-1 text-[13px] font-bold text-[var(--app-ink)]">
                        {item.keyword}
                      </span>
                      <span
                        className="text-[10px] font-extrabold"
                        style={{
                          color: item.up
                            ? 'var(--app-pink-strong)'
                            : 'var(--app-copy-soft)',
                        }}
                        aria-hidden="true"
                      >
                        {item.up ? '▲' : '▼'}
                      </span>
                    </button>
                  ))}
                </article>
              </section>

              <section>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  추천 카테고리
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  {RECOMMENDED.map((cat) => (
                    <Link
                      key={cat.label}
                      href={cat.href}
                      className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
                    >
                      <ZodiacChip kind={cat.zodiac} size="sm" />
                      <span className="text-[13px] font-extrabold text-[var(--app-ink)]">
                        {cat.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {mode === 'empty-results' ? (
            <div className="px-8 pt-16 text-center">
              <div
                className="mx-auto grid h-24 w-24 place-items-center rounded-full text-[44px] font-bold"
                style={{
                  background: 'var(--app-pink-soft)',
                  color: 'var(--app-pink-strong)',
                  fontFamily: 'var(--font-han)',
                }}
                aria-hidden="true"
              >
                ?
              </div>
              <div className="mt-5 text-[17px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
                &ldquo;<span className="text-[var(--app-pink-strong)]">{query}</span>&rdquo;와 일치하는 풀이가 없어요
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-[var(--app-copy-soft)]">
                검색어를 다르게 표현해보거나,
                <br />
                아래 추천 메뉴에서 시작해보세요.
              </p>
              <article
                className="mt-6 rounded-[14px] border p-4 text-left"
                style={{
                  background: 'var(--app-pink-soft)',
                  borderColor: 'var(--app-pink-line)',
                }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  이런 검색은 어때요?
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {SUGGEST_CHIPS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => applyQuery(tag)}
                      className="rounded-full border border-[var(--app-pink-line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--app-pink-strong)]"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </article>
              <Link
                href="/saju/new"
                className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-6 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                사주 시작하기 →
              </Link>
            </div>
          ) : null}
        </section>
      </AppPage>
    </AppShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
          <AppPage className="gangi-subpage saju-result-page text-center">
            <p className="py-8 text-[12.5px] text-[var(--app-copy-muted)]">검색 준비 중입니다.</p>
          </AppPage>
        </AppShell>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
