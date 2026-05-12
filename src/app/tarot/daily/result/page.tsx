import Link from 'next/link';
import type { Metadata } from 'next';
import { Bookmark, RotateCcw } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { ResultShell } from '@/components/moonlight/ResultShell';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { TarotCardArtwork } from '@/components/tarot/tarot-card-artwork';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import {
  getTarotReadingForQuestion,
  normalizeQuestion,
} from '@/lib/tarot-api';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{
    question?: string;
    cardId?: string;
    orientation?: string;
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '타로 결과',
    description: '카드 의미와 사주 연결 해석을 함께 보여주는 달빛인생의 타로 결과 화면입니다.',
    alternates: {
      canonical: '/tarot/daily/result',
    },
  };
}

export default async function TarotResultPage({ searchParams }: Props) {
  const { question, cardId, orientation } = await searchParams;
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);
  const currentQuestion = normalizeQuestion(question);
  const reading = await getTarotReadingForQuestion({
    question: currentQuestion,
    cardId,
    orientation,
  });
  const pickHref = `/tarot/daily/pick?question=${encodeURIComponent(currentQuestion)}`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage gangi-tarot-result-page space-y-5">
        <GangiPageHeader title="타로 한 장" backHref={pickHref} />

        <ResultShell
          title={reading.answer}
          summary="오늘의 결을 카드 한 장으로 가볍게 확인한 결과입니다."
          keywords={[reading.displayName, reading.arcanaLabel, '타로 한 장']}
        >
          <section className="gangi-tarot-draw-result">
            <TarotCardArtwork
              cardId={reading.card.name_short}
              shortName={reading.shortName}
              displayName={reading.displayName}
              cardMarker={reading.cardMarker}
              arcanaLabel={reading.arcanaLabel}
              className="mx-auto gangi-tarot-result-art"
              priority
            />
            <p className="gangi-sub-eyebrow">뽑힌 카드</p>
            <h2>{reading.displayName}</h2>
            <span>{reading.arcanaLabel}</span>
          </section>

          <LightSection eyebrow="오늘의 조언" title={reading.answer} surface="soft">
            <p className="text-sm leading-7 text-[var(--gyeol-muted)]">{reading.action}</p>
          </LightSection>

          <section className="gangi-tarot-reading-stack" aria-label="타로 풀이">
            <article>
              <strong>마음에 둘 말</strong>
              <p>{reading.guidance}</p>
            </article>
            <article>
              <strong>사주와 이어보면</strong>
              <p>{reading.sajuBlend}</p>
            </article>
          </section>

          <div className="gangi-tarot-result-actions">
            <Link href={pickHref} className="gangi-secondary-button">
              <RotateCcw className="h-5 w-5" />
              다시 뽑기
            </Link>
            <Link href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'} className="gangi-primary-button">
              <Bookmark className="h-5 w-5" />
              사주로 이어보기
            </Link>
          </div>

          <LightSection
            eyebrow="다음 흐름"
            title="더 깊게 보고 싶을 때"
            description="타로는 지금 마음의 결을 짧게 보는 입구입니다. 더 남는 질문은 성향사주나 12간지 대화로 이어보세요."
          >
            <FlowEntryList
              items={[
                {
                  id: 'saju-personality',
                  href: '/saju/personality',
                  title: '성향사주로 이어보기',
                  description: '사주 네 기둥과 16유형 성향으로 내 선택 습관을 봅니다.',
                  meta: '깊이보기',
                },
                {
                  id: 'dialogue',
                  href: '/dialogue',
                  title: '12간지 캐릭터에게 이어 묻기',
                  description: '카드에서 남은 질문을 대화방에서 가볍게 이어갑니다.',
                  meta: '대화',
                },
              ]}
            />
          </LightSection>
          <SafetyNotice />
        </ResultShell>
      </AppPage>
    </AppShell>
  );
}
