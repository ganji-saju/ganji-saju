import Link from 'next/link';
import type { Metadata } from 'next';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import {
  TAROT_CARD_KEYWORDS,
  TAROT_QUESTION_OPTIONS,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { getTarotSpreadForQuestion, getTodayTarotPreview } from '@/lib/tarot-api';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

const DAILY_TAROT_QUESTION = '오늘 하루 어떤 메시지가 있을까';

const TAROT_FLOW_POINTS = [
  '타로는 지금 눈앞의 감정과 장면을 빠르게 비춥니다.',
  '결과는 핵심 한 줄, 조심할 것, 오늘 해볼 행동으로 먼저 정리합니다.',
  '카드 결과가 마음에 남으면 같은 질문을 사주나 상담으로 이어갈 수 있습니다.',
] as const;

export const metadata: Metadata = {
  title: '타로',
  description:
    '질문을 고르고 카드 뽑기 화면으로 이어지는 달빛인생의 오늘의 타로 화면입니다.',
  alternates: {
    canonical: '/tarot/daily',
  },
};

export default async function DailyTarotPage() {
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);
  const featuredReading = await getTodayTarotPreview();
  const premiumSpread = await getTarotSpreadForQuestion(DAILY_TAROT_QUESTION);
  const sourceLabel = featuredReading.source === 'api' ? '78장 덱 기준' : '로컬 덱 기준';

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="tarot"
              className="border-[var(--app-plum)]/25 bg-[var(--app-plum)]/10 text-[var(--app-plum)]"
            >
              오늘의 타로
            </Badge>,
            <Badge
              key="free"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              빠른 무료 탐색
            </Badge>,
          ]}
          title="지금 마음에 가까운 질문을 먼저 고르세요"
          description="타로는 길게 읽기보다 지금 마음을 빨리 비추는 입구입니다. 질문을 고르고 한 장을 뽑으면, 핵심 한 줄과 오늘 해볼 행동을 먼저 보여드립니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="질문 고르기"
              title="무엇이 제일 마음에 걸리나요?"
              titleClassName="text-3xl"
              description="가장 가까운 질문을 고르면 바로 카드 뽑기로 이어집니다. 답은 짧게, 행동은 분명하게 보여드립니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <ProductGrid columns={2} className="mt-6">
              {TAROT_QUESTION_OPTIONS.map((question) => (
                <FeatureCard
                  key={question.label}
                  surface="soft"
                  eyebrow={
                    <span className="flex items-center gap-2">
                      <span className="font-hanja text-base text-[var(--app-gold-text)]">
                        {question.emoji}
                      </span>
                      <span>{question.intent}</span>
                    </span>
                  }
                  title={question.label}
                  description={question.description}
                  badge={
                    <span className="rounded-full border border-[var(--app-plum)]/25 bg-[var(--app-plum)]/10 px-2.5 py-1 text-[11px] text-[var(--app-plum)]">
                      {question.when}
                    </span>
                  }
                  footer={
                    <Link
                      href={{
                        pathname: '/tarot/daily/pick',
                        query: { question: question.label },
                      }}
                      className="inline-flex items-center gap-2 text-sm text-[var(--app-plum)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      이 질문으로 카드 뽑기
                    </Link>
                  }
                  />
              ))}
            </ProductGrid>

            <SectionHeader
              className="mt-8"
              eyebrow="직접 질문 쓰기"
              title="지금 마음에 떠오르는 문장을 그대로 적어도 좋습니다"
              titleClassName="text-2xl"
            />

            <form
              action="/tarot/daily/pick"
              className="mt-5 rounded-[1.25rem] border border-dashed border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4"
            >
              <label
                htmlFor="tarot-question"
                className="block text-xs tracking-[0.2em] text-[var(--app-copy-soft)]"
              >
                직접 질문 쓰기
              </label>
              <textarea
                id="tarot-question"
                name="question"
                rows={3}
                placeholder="예: 지금 마음을 전해도 괜찮을까요"
                className="mt-3 w-full resize-none rounded-[1rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-ivory)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-plum)]/45"
              />
              <ActionCluster className="mt-4">
                <button
                  type="submit"
                  className="moon-action-primary"
                >
                  카드 뽑기로 이어가기
                </button>
              </ActionCluster>
            </form>
          </SectionSurface>

          <SupportRail
            surface="lunar"
            eyebrow="무료 타로 흐름"
            title="카드 한 장으로 오늘 마음부터 봅니다"
            description="먼저 지금 마음을 짧게 확인하고, 더 궁금할 때만 사주나 대화로 이어갑니다."
          >
            <BulletList items={TAROT_FLOW_POINTS} />

            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="더 자세히 보기"
              title="연애 마음 확인 990원"
              description="한 장의 메시지가 마음에 남으면 현재 흐름, 숨은 마음, 오늘의 조언을 더 짧게 이어볼 수 있게 준비합니다."
            />

            <ProductGrid columns={3} className="mt-4">
              {premiumSpread.map(({ position, reading }) => (
                <FeatureCard
                  key={position}
                  surface="soft"
                  eyebrow={position}
                  description={reading.displayName}
                />
              ))}
            </ProductGrid>

            <ActionCluster className="mt-5">
              <Link
                href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}
                className="moon-action-secondary"
              >
                {readingSlug ? '이 질문을 내 사주 흐름과 함께 보기' : '사주와 함께 보기'}
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <SectionSurface surface="panel" size="lg" className="text-center">
            <SectionHeader
              eyebrow="오늘의 카드 미리보기"
              title="한 장의 그림이 먼저 건네는 말"
              titleClassName="text-3xl"
              descriptionClassName="mx-auto max-w-xl text-[var(--app-copy)]"
              description="질문을 바로 고르기 전에, 오늘의 카드가 어떤 온도로 말을 거는지 먼저 살펴보실 수 있습니다."
            />

            <div className="mt-6">
              <TarotCardArtwork
                cardId={featuredReading.card.name_short}
                shortName={featuredReading.shortName}
                displayName={featuredReading.displayName}
                cardMarker={featuredReading.cardMarker}
                arcanaLabel={featuredReading.arcanaLabel}
                className="mx-auto w-[min(14rem,72vw)]"
                priority
              />
            </div>
            <div className="mt-4 font-display text-2xl font-semibold text-[var(--app-ivory)]">
              {featuredReading.displayName}
            </div>
            <div className="mt-2 text-sm text-[var(--app-copy-muted)]">{sourceLabel}</div>
          </SectionSurface>

          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="오늘의 한마디"
              title={featuredReading.answer}
              titleClassName="text-3xl"
              description={featuredReading.guidance}
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <FeatureCard
              className="mt-6"
              surface="soft"
              eyebrow="질문의 속뜻"
              description={featuredReading.questionInsight}
            />

            <ActionCluster className="mt-6">
              <Link
                href={{
                  pathname: '/tarot/daily/result',
                  query: {
                    question: DAILY_TAROT_QUESTION,
                    cardId: featuredReading.card.name_short,
                    orientation: featuredReading.orientation,
                  },
                }}
                className="moon-cta-primary"
              >
                이 카드로 오늘 리딩 보기
              </Link>
            </ActionCluster>
          </SectionSurface>
        </section>

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="쉬운 문장"
            title="무섭게 말하지 않고, 오늘 할 수 있는 말로 바꿉니다"
            titleClassName="text-3xl"
            description="무료 타로에서도 공포성 표현보다 생활에 붙는 언어를 먼저 드립니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
            {TAROT_CARD_KEYWORDS.map(([name, copy]) => (
              <FeatureCard
                key={name}
                surface="soft"
                eyebrow={name}
                description={copy}
              />
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
