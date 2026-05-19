// Redesign 2026-05-13: 사주 sub-tab '성향' 페이지 — PR6~PR8 와 같은 디자인 언어.
// pink-soft hero + 일주 ZodiacChip + 핵심 chip + 2x2 생활 힌트 + ink-dark CTA.
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
import type { Element } from '@/lib/saju/types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
// 2026-05-15 cleanup — 총평 §1.5 일주 캐릭터 카드를 성향 탭으로 이전.
// "내 타고난 결" sixtyGapja 깊은 풀이는 성향 탭이 더 자연스러움 ("성향 = 타고난 결").
import { DayPillarCharacterCard } from '@/components/saju/day-pillar-character-card';

interface Props {
  params: Promise<{ slug: string }>;
}

const BRANCH_TO_ZODIAC: Record<string, ZodiacKey> = {
  子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake',
  午: 'horse', 未: 'sheep', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig',
};

const ZODIAC_KOR: Record<ZodiacKey, string> = {
  rat: '쥐띠', ox: '소띠', tiger: '범띠', rabbit: '토끼띠', dragon: '용띠', snake: '뱀띠',
  horse: '말띠', sheep: '양띠', monkey: '원숭이띠', rooster: '닭띠', dog: '개띠', pig: '돼지띠',
};

const NATURE_GUIDE: Record<
  Element,
  {
    strength: string;
    social: string;
    caution: string;
    support: string;
  }
> = {
  목: {
    strength: '사람과 일의 방향을 열고, 흐름을 바깥으로 자라게 하는 힘이 큽니다.',
    social: '아이디어를 먼저 꺼내거나 주변 사람을 북돋우는 자리에서 존재감이 살아납니다.',
    caution: '가능성을 넓게 보느라 해야 할 일을 너무 많이 벌리면 마무리가 흐려질 수 있습니다.',
    support: '우선순위를 먼저 좁히고, 하나를 끝낸 뒤 다음으로 넘어가면 장점이 더 또렷해집니다.',
  },
  화: {
    strength: '분위기를 밝히고 사람의 마음을 움직이게 하는 추진력이 분명합니다.',
    social: '감정을 실어 표현하거나 직접 앞장서는 순간에 힘이 빠르게 붙는 편입니다.',
    caution: '속도가 붙을수록 말이 먼저 나가거나 결론을 서둘러 단정할 수 있습니다.',
    support: '결정 전 한 템포 쉬고, 감정과 판단을 나눠 말하면 빛이 더 오래 갑니다.',
  },
  토: {
    strength: '사람과 일을 한가운데서 묶고 중심을 잡는 안정감이 강한 편입니다.',
    social: '누군가를 안심시키거나 흩어진 상황을 정리할 때 신뢰가 크게 붙습니다.',
    caution: '책임감이 커질수록 혼자 다 떠안거나, 변화 속도를 늦춰 답답함을 줄 수 있습니다.',
    support: '내가 맡을 몫과 내려둘 몫을 나누면 중심감은 살고 피로는 줄어듭니다.',
  },
  금: {
    strength: '정리하고, 결론을 또렷하게 만드는 힘이 가장 돋보입니다.',
    social: '모호한 장면에서 방향을 정리하거나, 필요한 선을 분명히 할 때 믿음을 줍니다.',
    caution: '판단이 날카로워질수록 사람의 감정보다 결과를 먼저 보고 차갑게 읽힐 수 있습니다.',
    support: '결론 앞에 맥락 한 줄을 먼저 두면 강한 판단이 부드럽게 받아들여집니다.',
  },
  수: {
    strength: '큰 흐름을 읽고 여지를 남기며 움직이는 포용력과 기획력이 살아 있습니다.',
    social: '사람의 속마음이나 상황의 결을 길게 읽을 때 오히려 더 정확해집니다.',
    caution: '생각이 깊어질수록 결론을 늦추거나 감정 표현을 아끼는 쪽으로 흐를 수 있습니다.',
    support: '머릿속 판단을 한 문장으로 먼저 꺼내는 습관이 기질의 장점을 더 빨리 살립니다.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '타고난 성향',
    description: '타고난 성향을 쉬운 말로 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

function getYearZodiac(data: SajuDataV1 | SajuDataV2): ZodiacKey {
  const branch = data.pillars.year.branch;
  return BRANCH_TO_ZODIAC[branch] ?? 'dragon';
}

export default async function SajuNaturePage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  const { input, sajuData, grounding } = reading;
  const personalizationContext = grounding?.personalizationContext ?? null;
  const sixtyGapjaProfile = personalizationContext?.sixtyGapja ?? null;
  const dayGanziKorean = personalizationContext?.dayGanziCode ?? '';
  const dayGanziHanja = personalizationContext?.dayGanziHanja ?? sajuData.pillars.day.ganzi;
  const metaphor = sajuData.dayMaster.metaphor ?? '자연의 상징';
  const description =
    sajuData.dayMaster.description ??
    '선생님의 기질은 자연의 리듬처럼 밝음과 고요함이 함께 흐르는 모습입니다.';
  const element = sajuData.dayMaster.element;
  const guide = NATURE_GUIDE[element];
  const traits = ELEMENT_INFO[element].traits.slice(0, 3);
  const seasonHints = ELEMENT_INFO[element].keywords.slice(0, 3).join(' · ');
  const elementColor = ELEMENT_INFO[element].color;
  const yearZodiac = getYearZodiac(sajuData);
  const yearZodiacLabel = ZODIAC_KOR[yearZodiac];
  const dayMasterPillar = `${sajuData.pillars.day.ganzi}일주`;

  const cards: Array<{ label: string; title: string; desc: string }> = [
    { label: '사람 앞에서는', title: '힘이 붙는 장면', desc: guide.social },
    { label: '흔들릴 때', title: '먼저 거칠어질 수 있어요', desc: guide.caution },
    { label: '균형 메모', title: '장점을 오래 쓰는 법', desc: guide.support },
    {
      label: '잘 맞는 분위기',
      title: ELEMENT_INFO[element].name,
      desc: seasonHints,
    },
  ];

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 sm:space-y-6">
        <div className="space-y-5 sm:space-y-6">
          <GangiPageHeader title="성향" backHref={`/saju/${slug}`} />
          <SajuScreenNav slug={slug} current="nature" />

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
                    {metaphor}처럼 드러나는 나
                  </h1>
                  <div className="mt-1 text-[11.5px] text-[var(--app-copy-soft)]">
                    {formatBirthSummary(input)}
                  </div>
                </div>
              </div>
            </article>

            {/* §1.5 일주 캐릭터 — 2026-05-15 cleanup. 총평 §1.5 이전.
                "내 타고난 결" 깊은 풀이. grounding.sixtyGapja 가 있을 때만 노출. */}
            <DayPillarCharacterCard
              profile={sixtyGapjaProfile}
              dayGanziHanja={dayGanziHanja}
              dayGanziKorean={dayGanziKorean}
            />

            {/* §2 핵심 장점 */}
            <section>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                핵심
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                내 장점이 살아나는 장면
              </h2>
              <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
                <div className="flex flex-wrap gap-1.5">
                  {traits.map((trait) => (
                    <span
                      key={trait}
                      className="rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
                      style={{ background: elementColor }}
                    >
                      {trait}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 text-[14px] leading-[1.65] text-[var(--app-copy)]">
                  {guide.strength}
                </p>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
                  {description}
                </p>
              </article>
            </section>

            {/* §3 생활 힌트 — 2x2 */}
            <section>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                생활 힌트
              </div>
              <h2 className="mt-1 text-[17px] font-extrabold text-[var(--app-ink)]">
                이렇게 쓰면 더 편해요
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {cards.map((card) => (
                  <article
                    key={card.label}
                    className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
                  >
                    <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">
                      {card.label}
                    </div>
                    <div className="mt-1 text-[13.5px] font-extrabold leading-snug text-[var(--app-ink)]">
                      {card.title}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]">
                      {card.desc}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            {/* §4 다음 단계 CTA */}
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
                다음
              </div>
              <h2 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-tight">
                기운 균형도 이어서 봐주세요
              </h2>
              <p
                className="mt-2 text-[12.5px] leading-[1.55]"
                style={{ opacity: 0.7 }}
              >
                강한 쪽과 채울 쪽을 원형 그래프로 한눈에 확인할 수 있어요.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/saju/${encodeURIComponent(slug)}/elements`}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(236,72,153,0.32)]"
                >
                  기운 균형 보기 →
                </Link>
                <Link
                  href={`/saju/${encodeURIComponent(slug)}`}
                  className="inline-flex items-center justify-center rounded-full border border-white/24 px-5 py-3 text-[13px] font-bold text-white/85"
                >
                  사주 총평으로
                </Link>
              </div>
            </article>
          </section>
        </div>
      </AppPage>
    </AppShell>
  );
}
