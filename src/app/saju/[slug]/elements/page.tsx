// Redesign 2026-05-13: 사주 sub-tab '오행' 페이지 — PR6~PR9 와 같은 디자인 언어.
// pink-soft hero + donut conic-gradient + 분포 list + 습관 2x2 + ink-dark CTA.
// 데이터·라우팅 무수정. FiveElementOrbitChart 는 PR7 deep 의 donut 패턴으로 대체.
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
import type { Element } from '@/lib/saju/types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

const ELEMENT_ORDER: Element[] = ['목', '화', '토', '금', '수'];

const ELEMENT_HAN: Record<Element, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake',
  午: 'horse', 未: 'sheep', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig',
};

const ZODIAC_KOR: Record<ZodiacKey, string> = {
  rat: '쥐띠', ox: '소띠', tiger: '범띠', rabbit: '토끼띠', dragon: '용띠', snake: '뱀띠',
  horse: '말띠', sheep: '양띠', monkey: '원숭이띠', rooster: '닭띠', dog: '개띠', pig: '돼지띠',
};

const ELEMENT_SUPPORT_GUIDE: Record<
  Element,
  {
    label: string;
    support: string;
    habits: string[];
  }
> = {
  // 2026-05-16 — 한자 풀어 쓴 라벨이 본문과 매끄럽게 이어지도록 자연스러운 한국어로 교체.
  목: {
    label: '새로 시작하고 추진하는 힘',
    support: '막혀 있던 흐름을 다시 자라게 하는 축이 필요합니다.',
    habits: ['아침에 먼저 움직이는 약속 만들기', '할 일을 한 줄로 먼저 적기', '식물이나 나무 결이 있는 공간 가까이 두기'],
  },
  화: {
    label: '마음을 꺼내고 활력을 더하는 힘',
    support: '안에 쌓인 생각을 밖으로 꺼내고 분위기를 데우는 축이 더 필요합니다.',
    habits: ['결정 전 감정을 먼저 한 문장으로 말하기', '몸을 따뜻하게 깨우는 산책 넣기', '붉은 계열 포인트를 작은 소품으로 쓰기'],
  },
  토: {
    label: '흔들리지 않게 중심을 잡는 힘',
    support: '흐름을 한곳에 모으고 안정적으로 붙잡는 축을 보완해주면 좋습니다.',
    habits: ['일주일 루틴을 두세 개만 고정하기', '식사와 수면 시간을 흔들리지 않게 잡기', '책상과 서랍을 짧게라도 자주 정리하기'],
  },
  금: {
    label: '결단하고 매듭짓는 힘',
    support: '정리하고 마무리하는 축이 더해질수록 전체 리듬이 또렷해집니다.',
    habits: ['흰색·은색 소품을 가까이 두기', '서쪽 방향에서 잠깐 숨 고르기', '정리와 마감 시간을 하루 안에 따로 빼두기'],
  },
  수: {
    label: '깊이 사고하고 유연하게 흐르는 힘',
    support: '급하게 몰아가기보다 여지를 남기고 깊게 읽는 축을 채워주면 균형이 좋아집니다.',
    habits: ['하루에 조용한 혼자 시간 확보하기', '물을 자주 마시며 속도를 늦추기', '밤에 생각을 정리할 메모 습관 두기'],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '기운 균형',
    description: '다섯 기운의 균형을 쉽게 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

function getYearZodiac(data: SajuDataV1): ZodiacKey {
  const branch = data.pillars.year.branch;
  return BRANCH_TO_ZODIAC[branch] ?? 'dragon';
}

function buildDonutGradient(data: SajuDataV1): string {
  const byElement = data.fiveElements.byElement;
  const ordered = ELEMENT_ORDER.map((el) => ({
    el,
    pct: byElement[el]?.percentage ?? 0,
    color: ELEMENT_INFO[el].color,
  })).sort((a, b) => b.pct - a.pct);

  let acc = 0;
  const stops = ordered
    .filter((item) => item.pct > 0)
    .map((item) => {
      const start = acc * 3.6;
      acc += item.pct;
      const end = acc * 3.6;
      return `${item.color} ${start}deg ${end}deg`;
    });

  if (stops.length === 0) return 'var(--app-line)';
  return `conic-gradient(${stops.join(', ')})`;
}

export default async function SajuElementsPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  const { input, sajuData } = reading;
  const dominant = sajuData.fiveElements.dominant;
  const weakest = sajuData.fiveElements.weakest;
  const dominantPercent = Math.round(
    sajuData.fiveElements.byElement[dominant]?.percentage ?? 0
  );
  const dominantColor = ELEMENT_INFO[dominant].color;
  const donutGradient = buildDonutGradient(sajuData);
  const supportGuide = ELEMENT_SUPPORT_GUIDE[weakest];
  const yearZodiac = getYearZodiac(sajuData);
  const yearZodiacLabel = ZODIAC_KOR[yearZodiac];
  const dayMasterPillar = `${sajuData.pillars.day.ganzi}일주`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
          <GangiPageHeader title="오행" backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="elements" />

          <section className="space-y-5 px-1">
            {/* §1 Hero */}
            <article
              className="rounded-[18px] border border-[var(--app-line)] p-5"
              style={{ background: 'var(--app-pink-soft)' }}
            >
              <div className="flex items-center gap-3">
                <ZodiacChip kind={yearZodiac} size="lg" />
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    {dayMasterPillar} · {yearZodiacLabel}
                  </div>
                  <h1 className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
                    {ELEMENT_INFO[dominant].name}이 강하고,
                    <br />
                    {ELEMENT_INFO[weakest].name}을 채우면 편해요
                  </h1>
                  <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                    {formatBirthSummary(input)}
                  </div>
                </div>
              </div>
            </article>

            {/* §2 오행 donut + 분포 */}
            <section>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    五行 · 오행 균형
                  </div>
                  <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                    다섯 기운을 한눈에
                  </h2>
                </div>
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-extrabold text-[var(--app-pink-strong)]"
                  style={{
                    background: 'var(--app-pink-soft)',
                    borderColor: 'var(--app-pink-line)',
                  }}
                >
                  {dominant}왕
                </span>
              </div>
              <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="relative grid h-[124px] w-[124px] shrink-0 place-items-center rounded-full"
                    style={{ background: donutGradient }}
                  >
                    <div
                      className="absolute inset-3 grid place-items-center rounded-full bg-white"
                      aria-hidden="true"
                    >
                      <div className="text-center">
                        <div
                          className="text-[26px] font-bold leading-none"
                          style={{
                            fontFamily: 'var(--font-han)',
                            color: dominantColor,
                          }}
                        >
                          {ELEMENT_HAN[dominant]}
                        </div>
                        <div className="text-[10px] text-[var(--app-copy-soft)]">
                          {dominantPercent}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <ul className="grid flex-1 gap-1.5" aria-label="오행 분포">
                    {ELEMENT_ORDER.map((el) => {
                      const pct = Math.round(sajuData.fiveElements.byElement[el]?.percentage ?? 0);
                      return (
                        <li key={el} className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: ELEMENT_INFO[el].color }}
                            aria-hidden="true"
                          />
                          <span
                            className="flex-1 text-[12px] font-bold text-[var(--app-copy)]"
                            style={{ fontFamily: 'var(--font-han)' }}
                          >
                            {el}({ELEMENT_HAN[el]})
                          </span>
                          <span className="text-[12px] font-extrabold text-[var(--app-ink)]">
                            {pct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p
                  className="mt-3.5 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-[1.55] text-[var(--app-pink-strong)]"
                  style={{ background: 'var(--app-pink-soft)' }}
                >
                  <strong>해석</strong> · {ELEMENT_INFO[dominant].name}의 리듬이 먼저 서고,{' '}
                  {ELEMENT_INFO[weakest].name} 쪽은 상대적으로 비어 있어요. 채울 쪽을 의식하면
                  강한 쪽도 더 또렷이 살아납니다.
                </p>
              </article>
            </section>

            {/* §3 균형 메모 */}
            <section>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                균형 메모
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                이렇게 채우면 편해집니다
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--app-copy-muted)]">
                {supportGuide.support}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <article
                  className="rounded-[14px] border p-3.5"
                  style={{
                    background: 'var(--app-pink-soft)',
                    borderColor: 'var(--app-pink-line)',
                  }}
                >
                  <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">강한 쪽</div>
                  <div
                    className="mt-1 text-[15px] font-extrabold tracking-tight"
                    style={{ color: dominantColor }}
                  >
                    {ELEMENT_INFO[dominant].name}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]">
                    {ELEMENT_INFO[dominant].traits.slice(0, 2).join(' · ')} 쪽 장점이 먼저 드러납니다.
                  </p>
                </article>
                <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5">
                  <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">채울 쪽</div>
                  <div
                    className="mt-1 text-[15px] font-extrabold tracking-tight"
                    style={{ color: ELEMENT_INFO[weakest].color }}
                  >
                    {supportGuide.label}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]">
                    {ELEMENT_INFO[weakest].name}을 채우는 쪽으로 하루 리듬을 잡아보세요.
                  </p>
                </article>
                {supportGuide.habits.slice(0, 2).map((habit, index) => (
                  <article
                    key={habit}
                    className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                  >
                    <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">
                      작은 습관 {index + 1}
                    </div>
                    <p className="mt-1.5 text-[13px] font-bold leading-[1.5] text-[var(--app-ink)]">
                      {habit}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* §4 ink-dark CTA */}
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
                더 자세히
              </div>
              <h2 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-tight">
                10년 단위 큰 흐름을
                <br />
                대운 풀이에서 이어보세요
              </h2>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/saju/${encodeURIComponent(slug)}/deep`}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  대운 풀이 보기 →
                </Link>
                <Link
                  href={`/saju/${encodeURIComponent(slug)}/nature`}
                  className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
                >
                  성향으로 돌아가기
                </Link>
              </div>
            </article>
          </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
