// Redesign 2026-05-13 (Claude Design / screens-g.jsx ScreenDream):
// /dream — 꿈 단어 검색 + 풀이 + 상황별 + 관련 단어 + 카테고리 + 오늘 많이 본 꿈.
// 2026-05-14: /api/dream/search 연동 — 사전은 src/lib/dream-dictionary.ts 에서 단일 출처.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import type { DreamFortune, DreamMeaning } from '@/lib/dream-dictionary';

interface DreamApiResponse {
  query: string;
  match: DreamMeaning;
  suggestions: string[];
  exact: boolean;
  categories: Array<{ key: string; label: string; count: number }>;
}

const CATEGORY_DECOR: Record<
  string,
  { hanja: string; color: string }
> = {
  animal: { hanja: '🐍', color: 'var(--app-jade)' },
  person: { hanja: '人', color: 'var(--app-pink)' },
  food: { hanja: '食', color: 'var(--app-amber)' },
  nature: { hanja: '山', color: 'var(--app-sky)' },
  object: { hanja: '物', color: 'var(--app-indigo)' },
  action: { hanja: '動', color: 'var(--app-coral)' },
};

// 2026-05-24 꿈해몽 풍부화 phase 1 — fortune 뱃지 색/톤. 민속 상징 분류이며 단정 아님.
const FORTUNE_DECOR: Record<DreamFortune, { bg: string; border: string; text: string }> = {
  길몽: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.32)', text: '#15803d' },
  흉몽: { bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.30)', text: '#be123c' },
  중립: { bg: 'var(--app-line)', border: 'var(--app-line)', text: 'var(--app-copy-muted)' },
};

const TODAY_POPULAR: Array<{ rank: number; keyword: string; description: string }> = [
  { rank: 1, keyword: '뱀', description: '재물·변화·다산의 상징' },
  { rank: 2, keyword: '돈', description: '손해의 암시일 수도' },
  { rank: 3, keyword: '시험', description: '평가와 자기점검' },
  { rank: 4, keyword: '물', description: '감정의 깊은 영역' },
  { rank: 5, keyword: '우는', description: '해소·정화' },
];

export default function DreamPage() {
  // 2026-07-18 — 하루 1회 제한(20260718 PPTX slide3 "한 단어 꿈해몽 / 다 하루 1번으로 제한").
  //   기존엔 입력할 때마다 디바운스 검색이 나갔고 마운트 시 '이빨'을 자동 검색했다.
  //   그 구조에 제한을 걸면 **페이지를 여는 것만으로 오늘 기회가 소진**되므로,
  //   자동검색을 없애고 **명시적 제출(버튼/엔터) 1회**로 바꾼다. 제한 판정은 서버가 한다.
  const [query, setQuery] = useState('');
  const [data, setData] = useState<DreamApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // term 을 넘기면 그 단어로 즉시 조회(관련어·인기 꿈 칩). 없으면 입력창 값.
  //   칩은 setQuery 직후 state 가 아직 갱신 전이라 인자로 받아야 stale 값을 안 쓴다.
  async function runSearch(term?: string) {
    const word = (term ?? query).trim();
    if (!word || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setLimitMessage(null);

    try {
      const response = await fetch(`/api/dream/search?q=${encodeURIComponent(word)}`, {
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => null)) as
        | (DreamApiResponse & { error?: string })
        | null;

      if (response.status === 429) {
        setLimitMessage(json?.error ?? '오늘은 이미 꿈해몽을 보셨어요. 내일 다시 만나요.');
        return;
      }
      if (response.ok && json) setData(json);
    } catch (error: unknown) {
      if ((error as { name?: string } | null)?.name !== 'AbortError') {
        // 네트워크 에러는 조용히 무시 — placeholder 유지
      }
    } finally {
      setLoading(false);
    }
  }

  const meaning = data?.match;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="꿈해몽" backHref="/" />

        <section className="space-y-5 px-1">
          {/* §1 헤드라인 */}
          <div>
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              밤에 꾼 꿈, 무슨 뜻일까?
            </div>
            <h1 className="mt-1.5 text-[27.6px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              한 단어로 검색해 보세요
            </h1>
          </div>

          {/* §2 검색 바 — 명시적 제출. 엔터 또는 '풀이 보기' 버튼으로만 조회한다. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
            className="space-y-2.5"
          >
            <div className="relative">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="예) 이빨, 뱀, 물, 죽음"
                enterKeyHint="search"
                className="h-[54px] w-full rounded-[14px] border border-[var(--app-line)] bg-white pl-11 pr-11 text-[17.8px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[20.7px] text-[var(--app-pink-strong)]"
                aria-hidden="true"
              >
                ⌕
              </span>
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="입력 지우기"
                  className="absolute right-3.5 top-1/2 grid h-[22px] w-[22px] -translate-y-1/2 place-items-center rounded-full bg-[var(--app-line)] text-[12.6px] text-white"
                >
                  ✕
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="h-[52px] w-full rounded-[14px] bg-[var(--app-pink)] text-[17px] font-extrabold text-white disabled:opacity-45"
            >
              {loading ? '풀이 찾는 중…' : '꿈 풀이 보기'}
            </button>

            <p className="text-[13.2px] leading-[1.5] text-[var(--app-copy-soft)]">
              꿈해몽은 하루에 한 단어씩 볼 수 있어요.
            </p>
          </form>

          {limitMessage ? (
            <p
              className="rounded-[12px] border px-3.5 py-3 text-[14.4px] leading-[1.55] text-[var(--app-ink)]"
              style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
              role="status"
            >
              {limitMessage}
            </p>
          ) : null}

          {/* §3 결과 카드 */}
          {meaning ? (
            <article
              className="rounded-[18px] border p-5"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[34.5px] font-bold leading-tight"
                  style={{
                    fontFamily: 'var(--font-han)',
                    color: 'var(--app-pink-strong)',
                  }}
                  aria-hidden="true"
                >
                  {meaning.hanja}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    꿈 풀이
                    {data && !data.exact ? <span className="ml-1.5 text-[var(--app-copy-soft)]">· 근접 매칭</span> : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-[20.7px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      &ldquo;{meaning.keyword}&rdquo; 꿈
                    </span>
                    {meaning.fortune ? (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[12.6px] font-extrabold"
                        style={{
                          background: FORTUNE_DECOR[meaning.fortune].bg,
                          border: `1px solid ${FORTUNE_DECOR[meaning.fortune].border}`,
                          color: FORTUNE_DECOR[meaning.fortune].text,
                        }}
                      >
                        {meaning.fortune}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mt-3.5 text-[15.5px] leading-[1.65] text-[var(--app-ink)]">
                {meaning.summary}
              </p>

              <article
                className="mt-3.5 rounded-[12px] border bg-white p-3"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                <div className="text-[13.2px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  상황별 의미
                </div>
                <div className="mt-1.5 grid gap-1.5">
                  {meaning.situations.map((s) => (
                    <div key={s.label} className="flex items-start gap-2.5 py-1">
                      <span className="min-w-[92px] text-[13.8px] font-extrabold text-[var(--app-ink)]">
                        {s.label}
                      </span>
                      <span className="flex-1 text-[13.2px] leading-[1.5] text-[var(--app-copy-muted)]">
                        {s.meaning}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              {/* 행동 가이드 — 꿈을 떠올린 직후 가볍게 해볼 한 문장 */}
              {meaning.action ? (
                <div
                  className="mt-2.5 flex items-start gap-2 rounded-[12px] border bg-white px-3 py-2.5"
                  style={{ borderColor: 'var(--app-pink-line)' }}
                >
                  <span
                    className="mt-[3px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--app-pink)' }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-[13.8px] leading-[1.55] text-[var(--app-ink)]">
                    <span className="font-extrabold text-[var(--app-pink-strong)]">오늘 해볼 행동 · </span>
                    {meaning.action}
                  </span>
                </div>
              ) : null}

              {/* 검색↔상세 연결 — DREAM_CONTENT 에 풍부 상세가 있는 키워드면 상세 페이지 링크 */}
              {meaning.detailSlug ? (
                <Link
                  href={`/dream-interpretation/${meaning.detailSlug}`}
                  className="mt-2.5 flex items-center justify-between rounded-[12px] px-3.5 py-3 text-[14.4px] font-extrabold text-white transition"
                  style={{
                    background: 'var(--app-pink-strong)',
                    boxShadow: '0 10px 24px rgba(216, 27, 114, 0.28)',
                  }}
                >
                  <span>이 꿈 자세히 풀어보기</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ) : null}

              {/* 꿈해몽은 민속·상징 해석임을 부드럽게 안내 */}
              <p className="mt-2.5 text-[12.1px] leading-[1.5] text-[var(--app-copy-soft)]">
                꿈해몽은 민속·상징에 바탕한 해석으로, 단정적인 예언이 아닙니다. 마음의 신호로 가볍게 참고해 주세요.
              </p>
            </article>
          ) : (
            <div className="rounded-[18px] border border-[var(--app-line)] bg-white p-8 text-center text-[14.4px] text-[var(--app-copy-muted)]">
              {loading ? '풀이를 불러오는 중...' : '검색어를 입력하세요.'}
            </div>
          )}

          {/* §4 함께 본 꿈 */}
          {meaning ? (
            <section>
              <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                함께 본 꿈
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {meaning.related.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setQuery(tag);
                      void runSearch(tag);
                    }}
                    className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1.5 text-[13.8px] font-bold text-[var(--app-copy-muted)] transition hover:border-[var(--app-pink-line)] hover:text-[var(--app-pink-strong)]"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* §5 인기 카테고리 */}
          {data?.categories?.length ? (
            <section>
              <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">인기 꿈 카테고리</h2>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {data.categories.map((cat) => {
                  const decor = CATEGORY_DECOR[cat.key] ?? CATEGORY_DECOR.object;
                  return (
                    <article
                      key={cat.label}
                      className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
                    >
                      <div
                        className="grid h-10 w-10 place-items-center rounded-[12px] text-[20.7px] font-bold text-white"
                        style={{
                          background: decor.color,
                          fontFamily: 'var(--font-han)',
                        }}
                        aria-hidden="true"
                      >
                        {decor.hanja}
                      </div>
                      <div className="text-[13.8px] font-extrabold text-[var(--app-ink)]">{cat.label}</div>
                      <div className="text-[10.9px] text-[var(--app-copy-soft)]">{cat.count}개</div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* §6 오늘 많이 본 꿈 */}
          <section>
            <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">오늘 많이 본 꿈</h2>
            <article className="mt-3 overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white">
              {TODAY_POPULAR.map((item, index) => (
                <button
                  key={item.rank}
                  type="button"
                  onClick={() => {
                    setQuery(item.keyword);
                    void runSearch(item.keyword);
                  }}
                  className={
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--app-pink-soft)]' +
                    (index < TODAY_POPULAR.length - 1 ? ' border-b border-[var(--app-line)]' : '')
                  }
                >
                  <span
                    className="w-5 text-[16.1px] font-extrabold"
                    style={{
                      color: item.rank <= 3 ? 'var(--app-pink-strong)' : 'var(--app-copy-soft)',
                      fontFamily: 'var(--font-han)',
                    }}
                    aria-hidden="true"
                  >
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15.5px] font-extrabold text-[var(--app-ink)]">
                      {item.keyword}
                    </div>
                    <div className="mt-0.5 text-[12.6px] text-[var(--app-copy-soft)]">
                      {item.description}
                    </div>
                  </div>
                  <span className="text-[15px] text-[var(--app-copy-soft)]" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </article>
          </section>

          {/* §7 사주로 이어보기 (ink-dark) */}
          <article
            className="rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="text-[12.6px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              더 깊이
            </div>
            <h2 className="mt-1.5 text-[19.5px] font-extrabold leading-snug tracking-tight">
              꿈이 자주 반복되나요?
            </h2>
            <p
              className="mt-2 text-[14.4px] leading-[1.55]"
              style={{ opacity: 0.75 }}
            >
              반복되는 꿈은 내가 지금 가장 신경 쓰는 일입니다. 내 사주 흐름으로 이어 봐주세요.
            </p>
            <Link
              href="/saju/new"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
            >
              사주 풀이로 이어보기 →
            </Link>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
