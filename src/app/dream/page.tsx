// Redesign 2026-05-13 (Claude Design / screens-g.jsx ScreenDream):
// 신규 /dream — 꿈 단어 검색 + 풀이 + 상황별 + 관련 단어 + 카테고리 + 오늘 많이 본 꿈.
// 실제 꿈 사전 API 가 아직 없어 합성 데이터로 구성 (q state 기반 placeholder).
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface DreamMeaning {
  keyword: string;
  hanja: string;
  summary: string;
  situations: Array<{ label: string; meaning: string }>;
  related: string[];
}

const DREAM_MEANINGS: Record<string, DreamMeaning> = {
  이빨: {
    keyword: '이빨',
    hanja: '齒',
    summary:
      '이빨이 빠지는 꿈은 흔히 변화의 시기를 알리는 신호로 해석됩니다. 가까운 가족·친구와의 관계 변화, 일에서의 전환점, 혹은 건강 관리 신호로 보는 경우가 많아요.',
    situations: [
      { label: '윗니가 빠지면', meaning: '손윗사람과의 거리감·이별 암시' },
      { label: '아랫니가 빠지면', meaning: '손아랫사람·후배·자녀 관련 변화' },
      { label: '피가 함께 나면', meaning: '재물 손실 가능성. 큰 지출 주의' },
      { label: '아프지 않으면', meaning: '오히려 좋은 변화의 신호' },
    ],
    related: ['치아', '입', '얼굴', '머리카락', '병원', '거울', '피', '죽음'],
  },
  뱀: {
    keyword: '뱀',
    hanja: '蛇',
    summary:
      '뱀이 등장하는 꿈은 재물·변화·다산의 상징으로 자주 해석됩니다. 다만 색·크기·행동에 따라 의미가 크게 갈리니 세부 상황을 함께 보세요.',
    situations: [
      { label: '흰 뱀을 보면', meaning: '큰 재물·임신·성공 신호' },
      { label: '뱀에게 물리면', meaning: '걱정거리 해소·발전의 전환점' },
      { label: '여러 마리가 나오면', meaning: '재물·인간관계 확장' },
      { label: '뱀이 도망가면', meaning: '기회를 놓칠 수 있음, 주의' },
    ],
    related: ['용', '구렁이', '도마뱀', '독', '땅', '물'],
  },
  물: {
    keyword: '물',
    hanja: '水',
    summary:
      '물 꿈은 감정과 무의식, 흐름을 상징합니다. 맑은지 흐린지, 잠기는지 떠오르는지에 따라 길흉이 달라져요.',
    summary_extra: '',
    situations: [
      { label: '맑은 물을 보면', meaning: '재물·기회·정화' },
      { label: '흐린 물에 잠기면', meaning: '걱정·감정 정체 주의' },
      { label: '바다에서 헤엄치면', meaning: '큰 도전·확장의 시기' },
      { label: '비가 내리면', meaning: '재물·풍요의 신호' },
    ],
    related: ['바다', '강', '비', '눈물', '얼음', '수영'],
  } as DreamMeaning,
  돈: {
    keyword: '돈',
    hanja: '財',
    summary:
      '돈을 줍는 꿈은 반대로 손해의 암시일 수도 있어요. 돈의 출처·상태·기분을 함께 살피면 더 정확합니다.',
    situations: [
      { label: '큰 돈을 줍는다', meaning: '뜻밖의 지출·손실 가능성' },
      { label: '돈을 잃으면', meaning: '오히려 들어올 재물의 길조' },
      { label: '동전이 많으면', meaning: '작은 수익의 누적' },
      { label: '지폐가 새 것이면', meaning: '새 일의 시작' },
    ],
    related: ['지갑', '카드', '금', '시장', '은행', '도둑'],
  },
};

const FALLBACK_MEANING: DreamMeaning = {
  keyword: '검색어',
  hanja: '夢',
  summary:
    '입력한 단어에 대한 풀이가 아직 사전에 등록되지 않았어요. 인기 꿈 카테고리에서 비슷한 단어를 골라보거나, 다른 단어로 검색해 보세요.',
  situations: [
    { label: '맑은 꿈이면', meaning: '긍정적 신호로 해석' },
    { label: '뒤숭숭한 꿈이면', meaning: '마음 정리를 권하는 신호' },
    { label: '반복되는 꿈이면', meaning: '내가 지금 가장 신경 쓰는 일' },
  ],
  related: ['뱀', '이빨', '물', '돈'],
};

const CATEGORIES: Array<{
  label: string;
  hanja: string;
  color: string;
  count: number;
}> = [
  { label: '동물', hanja: '🐍', color: 'var(--app-jade)', count: 142 },
  { label: '사람', hanja: '人', color: 'var(--app-pink)', count: 89 },
  { label: '음식', hanja: '食', color: 'var(--app-amber)', count: 76 },
  { label: '자연', hanja: '山', color: 'var(--app-sky)', count: 64 },
  { label: '사물', hanja: '物', color: 'var(--app-indigo)', count: 110 },
  { label: '행동', hanja: '動', color: 'var(--app-coral)', count: 95 },
];

const TODAY_POPULAR: Array<{ rank: number; keyword: string; description: string }> = [
  { rank: 1, keyword: '뱀', description: '재물·변화·다산의 상징' },
  { rank: 2, keyword: '돈을 줍는', description: '손해의 암시일 수도' },
  { rank: 3, keyword: '시험을 보는', description: '평가와 자기점검' },
  { rank: 4, keyword: '물에 빠지는', description: '감정의 깊은 영역' },
  { rank: 5, keyword: '우는', description: '해소·정화' },
];

function getMeaning(q: string): DreamMeaning {
  if (!q.trim()) return DREAM_MEANINGS.이빨;
  for (const key of Object.keys(DREAM_MEANINGS)) {
    if (q.includes(key)) return DREAM_MEANINGS[key];
  }
  return { ...FALLBACK_MEANING, keyword: q };
}

export default function DreamPage() {
  const [query, setQuery] = useState('이빨');
  const meaning = getMeaning(query);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="꿈해몽" backHref="/" />

        <section className="space-y-5 px-1">
          {/* §1 헤드라인 */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              밤에 꾼 꿈, 무슨 뜻일까?
            </div>
            <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              한 단어로 검색해 보세요
            </h1>
          </div>

          {/* §2 검색 바 */}
          <div className="relative">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="예) 이빨, 뱀, 물, 죽음"
              className="h-[54px] w-full rounded-[14px] border border-[var(--app-line)] bg-white pl-11 pr-11 text-[15.5px] font-semibold text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
            />
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-[var(--app-pink-strong)]"
              aria-hidden="true"
            >
              ⌕
            </span>
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 grid h-[22px] w-[22px] -translate-y-1/2 place-items-center rounded-full bg-[var(--app-line)] text-[11px] text-white"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* §3 결과 카드 */}
          <article
            className="rounded-[18px] border p-5"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-[30px] font-bold leading-none"
                style={{
                  fontFamily: 'var(--font-han)',
                  color: 'var(--app-pink-strong)',
                }}
                aria-hidden="true"
              >
                {meaning.hanja}
              </span>
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  꿈 풀이
                </div>
                <div className="mt-0.5 text-[18px] font-extrabold tracking-tight text-[var(--app-ink)]">
                  &ldquo;{meaning.keyword}&rdquo; 꿈
                </div>
              </div>
            </div>

            <p className="mt-3.5 text-[13.5px] leading-[1.65] text-[var(--app-ink)]">
              {meaning.summary}
            </p>

            <article
              className="mt-3.5 rounded-[12px] border bg-white p-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                상황별 의미
              </div>
              <div className="mt-1.5 grid gap-1.5">
                {meaning.situations.map((s) => (
                  <div key={s.label} className="flex items-start gap-2.5 py-1">
                    <span className="min-w-[92px] text-[12px] font-extrabold text-[var(--app-ink)]">
                      {s.label}
                    </span>
                    <span className="flex-1 text-[11.5px] leading-[1.5] text-[var(--app-copy-muted)]">
                      {s.meaning}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </article>

          {/* §4 함께 본 꿈 */}
          <section>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              함께 본 꿈
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {meaning.related.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className="rounded-full border border-[var(--app-line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--app-copy-muted)] transition hover:border-[var(--app-pink-line)] hover:text-[var(--app-pink-strong)]"
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>

          {/* §5 인기 카테고리 */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">인기 꿈 카테고리</h2>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {CATEGORIES.map((cat) => (
                <article
                  key={cat.label}
                  className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
                >
                  <div
                    className="grid h-10 w-10 place-items-center rounded-[12px] text-[18px] font-bold text-white"
                    style={{
                      background: cat.color,
                      fontFamily: 'var(--font-han)',
                    }}
                    aria-hidden="true"
                  >
                    {cat.hanja}
                  </div>
                  <div className="text-[12px] font-extrabold text-[var(--app-ink)]">{cat.label}</div>
                  <div className="text-[9.5px] text-[var(--app-copy-soft)]">{cat.count}개</div>
                </article>
              ))}
            </div>
          </section>

          {/* §6 오늘 많이 본 꿈 */}
          <section>
            <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">오늘 많이 본 꿈</h2>
            <article className="mt-3 overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white">
              {TODAY_POPULAR.map((item, index) => (
                <button
                  key={item.rank}
                  type="button"
                  onClick={() => setQuery(item.keyword)}
                  className={
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--app-pink-soft)]' +
                    (index < TODAY_POPULAR.length - 1 ? ' border-b border-[var(--app-line)]' : '')
                  }
                >
                  <span
                    className="w-5 text-[14px] font-extrabold"
                    style={{
                      color: item.rank <= 3 ? 'var(--app-pink-strong)' : 'var(--app-copy-soft)',
                      fontFamily: 'var(--font-han)',
                    }}
                    aria-hidden="true"
                  >
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                      {item.keyword}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                      {item.description}
                    </div>
                  </div>
                  <span className="text-[13px] text-[var(--app-copy-soft)]" aria-hidden="true">
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
              className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              더 깊이
            </div>
            <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-tight">
              꿈이 자주 반복되나요?
            </h2>
            <p
              className="mt-2 text-[12.5px] leading-[1.55]"
              style={{ opacity: 0.75 }}
            >
              반복되는 꿈은 내가 지금 가장 신경 쓰는 일입니다. 내 사주 흐름으로 이어 봐주세요.
            </p>
            <Link
              href="/saju/new"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
            >
              사주 풀이로 이어보기 →
            </Link>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
