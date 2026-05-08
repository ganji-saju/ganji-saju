import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import {
  GangiActionRow,
  GangiIntro,
  GangiListLink,
  GangiMiniCard,
  GangiPageHeader,
  GangiSection,
} from '@/components/gangi/gangi-ui';
import { SAJU_BASIC_SECTIONS } from '@/content/moonlight';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import {
  formatBirthSummary,
  getPillarEntries,
} from '@/features/saju-detail/saju-screen-helpers';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { resolveReading } from '@/lib/saju/readings';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '내 사주',
    description: '내 사주를 쉬운 말로 먼저 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

const PILLAR_LABELS: Record<string, string> = {
  '년': '태어난 해',
  '월': '태어난 달',
  '일': '태어난 날',
  '시': '태어난 시간',
};

const BASIC_SECTION_COPY: Record<
  string,
  { title: string; desc: string; price: string; zodiac: 'rabbit' | 'dragon' | 'ox' }
> = {
  nature: {
    title: '타고난 기질',
    desc: '내 성향을 쉬운 말로 봅니다',
    price: '무료',
    zodiac: 'rabbit',
  },
  elements: {
    title: '기운 균형',
    desc: '강한 쪽과 채울 쪽을 봅니다',
    price: '무료',
    zodiac: 'dragon',
  },
  today: {
    title: '오늘 흐름',
    desc: '지금 조심할 것과 행동을 봅니다',
    price: '무료',
    zodiac: 'ox',
  },
};

const PREMIUM_OVERVIEW_ITEMS = [
  '타고난 성향',
  '올해 흐름',
  '돈과 일의 조언',
  '관계와 마음',
  '오늘부터 할 선택',
] as const;

export default async function SajuOverviewPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { input, sajuData } = reading;
  const pillars = getPillarEntries(sajuData);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-readable-page space-y-5 pb-24">
        <GangiPageHeader title="사주풀이" backHref={`/saju/${slug}`} />
        <SajuScreenNav slug={slug} current="overview" />

        <GangiIntro
          eyebrow="무료 기본 풀이"
          title="내 사주의 첫 느낌"
          description={
            <>
              타고난 기질과 오늘의 선택을 짧게 확인합니다.
              <br />
              <span>{formatBirthSummary(input)}</span>
            </>
          }
        />

        <GangiSection
          eyebrow="내 정보"
          title="내 안에서 먼저 보이는 기질"
          description="어려운 한자보다 생활에서 느껴지는 성향으로 먼저 보여드려요."
        >
          <div className="grid grid-cols-2 gap-3">
            {pillars.map(({ label, pillar }) => (
              <GangiMiniCard
                key={label}
                label={PILLAR_LABELS[label] ?? label}
                title={pillar ? ELEMENT_INFO[pillar.stemElement].name : '시간 미입력'}
                desc={
                  label === '일'
                    ? '나를 가장 잘 보여주는 자리'
                    : pillar
                      ? ELEMENT_INFO[pillar.branchElement].name
                      : '미입력'
                }
              />
            ))}
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-4 py-4 text-sm leading-7 text-[var(--app-copy)]">
            내 사주는 {sajuData.dayMaster.metaphor ?? '자연의 상징'}처럼 드러나는 기질을 중심으로 읽습니다.
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="무료"
          title="무료로 더 볼 수 있어요"
          description="필요한 부분만 가볍게 열어보세요."
        >
          <div className="grid gap-3">
            {SAJU_BASIC_SECTIONS.map((section, index) => (
              <GangiListLink
                key={section.slug}
                href={
                  section.slug === 'nature'
                    ? `/saju/${slug}/nature`
                    : section.slug === 'elements'
                      ? `/saju/${slug}/elements`
                      : `/saju/${slug}`
                }
                zodiac={BASIC_SECTION_COPY[section.slug]?.zodiac ?? 'dragon'}
                title={BASIC_SECTION_COPY[section.slug]?.title ?? section.title}
                desc={BASIC_SECTION_COPY[section.slug]?.desc ?? section.description}
                price={BASIC_SECTION_COPY[section.slug]?.price ?? `0${index + 1}`}
              />
            ))}
          </div>
        </GangiSection>

        <GangiSection
          tone="pink"
          eyebrow="깊은 풀이"
          title="더 자세히 보고 싶다면"
          description="성향, 올해 흐름, 돈·일·관계 조언을 한 번에 이어서 봅니다."
        >
          <div className="grid gap-2">
            {PREMIUM_OVERVIEW_ITEMS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-[1rem] border border-[var(--app-pink-line)] bg-white px-4 py-3 text-sm text-[var(--app-copy)]"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-pink)]" />
                {item}
              </div>
            ))}
          </div>

          <GangiActionRow className="mt-5">
            <Link href={`/saju/${slug}/premium`} className="gangi-primary-button">
              깊은 사주풀이 열기 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/membership" className="gangi-secondary-button">
              가격 보기
            </Link>
          </GangiActionRow>
        </GangiSection>

      </AppPage>
    </AppShell>
  );
}
