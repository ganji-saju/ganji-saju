// Redesign 2026-05-13 (Claude Design / screens-e.jsx ScreenSearch):
// /search — 빈 입력 (최근 검색 + 실시간 인기 + 추천 카테고리) /
// 결과 (운세 메뉴 + 관련 풀이 + 꿈해몽 + 띠/별자리) / 결과 없음 (96px ? + 추천 칩 + CTA).
// 2026-05-14: /api/search 연동 — search-index.ts 가 단일 출처.
'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

type SearchCategory = '운세 메뉴' | '관련 풀이' | '꿈해몽' | '띠/별자리';

interface SearchHit {
  category: SearchCategory;
  title: string;
  description: string;
  href: string;
  zodiacKey?: string;
  keywords: string[];
}

interface SearchApiResponse {
  query: string;
  total: number;
  hits: SearchHit[];
  trending: Array<{ rank: number; keyword: string; up: boolean }>;
}

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

function isZodiacKey(value: string | undefined): value is ZodiacKey {
  return (
    value === 'rat' ||
    value === 'ox' ||
    value === 'tiger' ||
    value === 'rabbit' ||
    value === 'dragon' ||
    value === 'snake' ||
    value === 'horse' ||
    value === 'sheep' ||
    value === 'monkey' ||
    value === 'rooster' ||
    value === 'dog' ||
    value === 'pig'
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((json: SearchApiResponse | null) => {
          if (json) setData(json);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string } | null)?.name !== 'AbortError') {
            // ignore
          }
        });
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  const hits = data?.hits ?? [];
  const menuHits = hits.filter((h) => h.category === '운세 메뉴');
  const articleHits = hits.filter((h) => h.category === '관련 풀이');
  const dreamHits = hits.filter((h) => h.category === '꿈해몽');
  const zodiacHits = hits.filter((h) => h.category === '띠/별자리');
  const totalCount = data?.total ?? 0;
  const trending = data?.trending ?? [];

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

  function renderHitGroup(label: string, group: SearchHit[]) {
    if (group.length === 0) return null;
    return (
      <section key={label}>
        <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">{label}</h2>
        <div className="mt-2.5 grid gap-2">
          {group.map((hit) => (
            <Link
              key={`${hit.category}-${hit.title}`}
              href={hit.href}
              className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
            >
              {isZodiacKey(hit.zodiacKey) ? (
                <ZodiacChip kind={hit.zodiacKey} size="sm" />
              ) : null}
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
    );
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
              {renderHitGroup('운세 메뉴', menuHits)}
              {renderHitGroup('관련 풀이', articleHits)}
              {renderHitGroup('꿈해몽', dreamHits)}
              {renderHitGroup('띠/별자리', zodiacHits)}
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
                  {trending.map((item, index) => (
                    <button
                      key={item.rank}
                      type="button"
                      onClick={() => applyQuery(item.keyword)}
                      className={
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--app-pink-soft)]' +
                        (index < trending.length - 1
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
