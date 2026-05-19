// Redesign 2026-05-13: 사주 sub-tab '명식' 페이지 — PR6/PR7 와 같은 디자인 언어 적용.
// pink-soft hero + ZodiacChip + 한자 element 색상 4-card + ink-dark premium upsell.
// 데이터·라우팅 무수정.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import { formatBirthSummary } from '@/features/saju-detail/saju-screen-helpers';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { resolveReading } from '@/lib/saju/readings';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
// 2026-05-15 cleanup — 총평 페이지에서 §1.7 격국·용신·강약 + §1.8 합충·공망·신살 카드를 명식 탭으로 이전.
// 사용자 피드백 ("사실 카드 5종은 다른 탭에서 보여주면 좋겠다") 반영. 데이터 출처는 동일.
import { SajuRelationsSymbolsCard } from '@/components/saju/saju-relations-symbols-card';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '내 사주 명식',
    description: '내 사주의 네 기둥과 여덟 글자를 한눈에 보여주는 화면입니다.',
    robots: { index: false, follow: false },
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

const PILLAR_LABELS: Array<{ key: '시' | '일' | '월' | '년'; label: string; meaning: string }> = [
  { key: '시', label: '시주', meaning: '자식·말년·결과' },
  { key: '일', label: '일주', meaning: '나·배우자·중심' },
  { key: '월', label: '월주', meaning: '직장·부모·현재' },
  { key: '년', label: '연주', meaning: '조상·어린 시절' },
];

const LINKED_CARDS: Array<{
  key: string;
  href: (slug: string) => string;
  zodiac: ZodiacKey;
  price: string;
  title: string;
  desc: string;
}> = [
  {
    key: 'nature',
    href: (slug) => `/saju/${slug}/nature`,
    zodiac: 'rabbit',
    price: '무료',
    title: '타고난 성향',
    desc: '내 기질을 생활 언어로 풀어봅니다',
  },
  {
    key: 'elements',
    href: (slug) => `/saju/${slug}/elements`,
    zodiac: 'dragon',
    price: '무료',
    title: '오행 균형',
    desc: '강한 쪽과 채울 쪽을 확인합니다',
  },
  {
    key: 'today',
    href: (slug) => `/saju/${slug}`,
    zodiac: 'horse',
    price: '무료',
    title: '오늘 흐름',
    desc: '지금 조심할 것과 해볼 행동',
  },
];

const PREMIUM_BENEFITS = [
  '타고난 성향 깊이 보기',
  '올해 흐름과 월별 안내',
  '돈·일·관계 핵심 조언',
  '결정의 우선순위 정리',
  '오늘부터 할 실천 카드',
] as const;

function getYearZodiac(data: SajuDataV1 | SajuDataV2): ZodiacKey {
  const branch = data.pillars.year.branch;
  return BRANCH_TO_ZODIAC[branch] ?? 'dragon';
}

export default async function SajuOverviewPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  const { input, sajuData, grounding } = reading;
  const yearZodiac = getYearZodiac(sajuData);
  const yearZodiacLabel = ZODIAC_KOR[yearZodiac];
  const dayMaster = sajuData.pillars.day;
  const dayMasterLabel = `${dayMaster.ganzi}일주`;
  const metaphor = sajuData.dayMaster.metaphor ?? '자연의 상징';
  // 2026-05-15 cleanup — 총평 §1.7 fact card 를 명식 탭으로 이동.
  const patternName = sajuData.pattern?.name ?? null;
  const yongsinPrimary = sajuData.yongsin?.primary?.label ?? null;
  const strengthLevel = sajuData.strength?.level ?? null;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
          <GangiPageHeader title="명식" backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="overview" />

          <section className="space-y-5 px-1">
            {/* §1 Hero — 일주 + 띠 + 이름 */}
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
                    {input.name ?? '달빛이'}님의 명식
                  </h1>
                  <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                    {formatBirthSummary(input)}
                  </div>
                </div>
              </div>
            </article>

            {/* §2 4 pillars 명식 도식 — 각 기둥의 의미와 한자 */}
            <section>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                四柱八字 · 네 기둥
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                내 사주 도식
              </h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {PILLAR_LABELS.map((item) => {
                  const pillar =
                    item.key === '시'
                      ? sajuData.pillars.hour
                      : item.key === '일'
                        ? sajuData.pillars.day
                        : item.key === '월'
                          ? sajuData.pillars.month
                          : sajuData.pillars.year;
                  const stemColor = pillar?.stemElement
                    ? ELEMENT_INFO[pillar.stemElement].color
                    : 'var(--app-ink)';
                  const branchColor = pillar?.branchElement
                    ? ELEMENT_INFO[pillar.branchElement].color
                    : 'var(--app-ink)';
                  return (
                    <article
                      key={item.key}
                      className="overflow-hidden rounded-[14px] border border-[var(--app-line)] bg-white text-center"
                    >
                      <div
                        className="border-b border-[var(--app-line)] py-1.5 text-[10.5px] font-extrabold text-[var(--app-copy-soft)]"
                        style={{ background: 'rgba(0,0,0,0.02)' }}
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
                      <div className="border-t border-[var(--app-line)] py-1.5 text-[9.5px] font-extrabold text-[var(--app-copy-muted)]">
                        {item.meaning}
                      </div>
                    </article>
                  );
                })}
              </div>
              <article
                className="mt-3 rounded-[14px] border p-4"
                style={{
                  background: 'var(--app-pink-soft)',
                  borderColor: 'var(--app-pink-line)',
                }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  일주 해석
                </div>
                <p className="mt-1.5 text-[14px] font-medium leading-[1.55] text-[var(--app-ink)]">
                  내 사주는 <strong>{metaphor}</strong>처럼 드러나는 기질을 중심으로 읽습니다.
                </p>
              </article>
            </section>

            {/* §2.5 격국·용신·강약 사실 카드 — 2026-05-15 cleanup. 총평 §1.7 이전.
                "반복되는 삶의 역할 / 잘 풀리게 도와주는 기운 / 지금 흐르는 기운" 을
                명리 용어로 함께 노출. sajuData 동일 출처라 총평 narrative 와 일치. */}
            {(patternName || yongsinPrimary || strengthLevel) ? (
              <section
                className="rounded-[18px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  사주 핵심 키
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div
                    className="rounded-[12px] border p-3 text-center"
                    style={{
                      background: 'var(--app-pink-soft)',
                      borderColor: 'var(--app-pink-line)',
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                      격국
                    </div>
                    <div className="mt-1 text-[14px] font-extrabold leading-tight text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                      {patternName ?? '미정'}
                    </div>
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--app-copy-soft)]" style={{ wordBreak: 'keep-all' }}>
                      반복되는 역할 후보
                    </div>
                  </div>
                  <div
                    className="rounded-[12px] border p-3 text-center"
                    style={{
                      background: '#fff7e6',
                      borderColor: 'rgba(212,148,38,0.22)',
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-amber)]">
                      용신
                    </div>
                    <div className="mt-1 text-[14px] font-extrabold leading-tight text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                      {yongsinPrimary ?? '미정'}
                    </div>
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--app-copy-soft)]" style={{ wordBreak: 'keep-all' }}>
                      잘 풀리게 도와주는 기운
                    </div>
                  </div>
                  <div
                    className="rounded-[12px] border p-3 text-center"
                    style={{
                      background: '#e8f5ee',
                      borderColor: 'rgba(45,135,88,0.22)',
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--app-jade)]">
                      강약
                    </div>
                    <div className="mt-1 text-[14px] font-extrabold leading-tight text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                      {strengthLevel ?? '미정'}
                    </div>
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--app-copy-soft)]" style={{ wordBreak: 'keep-all' }}>
                      지금 흐르는 기운
                    </div>
                  </div>
                </div>
                <p
                  className="mt-2.5 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {patternName && yongsinPrimary
                    ? `${patternName}에 ${yongsinPrimary}을 보완점으로 잡고 풀이를 구성했습니다.`
                    : '사주 구조와 보완점을 함께 보며 풀이를 구성했습니다.'}
                </p>
              </section>
            ) : null}

            {/* §2.6 합충·공망·신살 — 2026-05-15 cleanup. 총평 §1.8 이전. */}
            {grounding ? <SajuRelationsSymbolsCard grounding={grounding} /> : null}

            {/* §3 무료 풀이 3종 링크 */}
            <section>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                무료 풀이
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                먼저 가볍게 열어볼 만한 것
              </h2>
              <div className="mt-3 grid gap-2.5">
                {LINKED_CARDS.map((card) => (
                  <Link
                    key={card.key}
                    href={card.href(slug)}
                    className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                  >
                    <ZodiacChip kind={card.zodiac} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                        {card.title}
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--app-copy-soft)]">
                        {card.desc}
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--app-pink-strong)]"
                      style={{
                        background: 'var(--app-pink-soft)',
                        border: '1px solid var(--app-pink-line)',
                      }}
                    >
                      {card.price}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {/* §4 Premium upsell — ink-dark */}
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
                대운 풀이
              </div>
              <h2 className="mt-1.5 text-[19px] font-extrabold leading-snug tracking-tight">
                10년 단위 큰 흐름을
                <br />
                시기별 8단으로 풀어보세요
              </h2>
              <ul className="mt-3 grid gap-1.5">
                {PREMIUM_BENEFITS.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[12.5px]"
                    style={{ color: 'rgba(255,255,255,0.82)' }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'var(--app-pink)' }}
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/saju/${encodeURIComponent(slug)}/deep`}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  대운 풀이 열기 →
                </Link>
                <Link
                  href="/membership"
                  className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
                >
                  멤버십 가격 보기
                </Link>
              </div>
            </article>
          </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
