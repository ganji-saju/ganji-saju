'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { ResultShell } from '@/components/moonlight/ResultShell';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { FollowUpQuestionChips } from '@/components/today-fortune/follow-up-question-chips';
import { OpportunityRiskCards } from '@/components/today-fortune/opportunity-risk-cards';
import { PremiumLockCard } from '@/components/today-fortune/premium-lock-card';
import { SajuReasonSnippet } from '@/components/today-fortune/saju-reason-snippet';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayFortuneScoreGrid } from '@/components/today-fortune/today-fortune-score-grid';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { trackMoonlightEvent } from '@/lib/analytics';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type { ConcernId, TodayFortuneFreeResult } from '@/lib/today-fortune/types';

const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:';

const RELATED_LINKS: Record<ConcernId, Array<{ label: string; href: string; body: string }>> = {
  love_contact: [
    { label: '성향궁합으로 이어보기', href: '/compatibility/personality', body: '두 사람의 사주와 성향이 어디서 닮고 어긋나는지 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오늘 어떤 말투가 편한지 바로 이어 물어볼 수 있어요.' },
  ],
  money_spend: [
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '돈이 새는 습관과 선택 패턴을 사주×성향으로 이어봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오늘 지출 전 확인할 기준을 짧게 물어볼 수 있어요.' },
  ],
  work_meeting: [
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '일과 역할의 큰 흐름을 내 선택 습관까지 이어서 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '미팅에서 꺼낼 말과 줄일 말을 물어볼 수 있어요.' },
  ],
  relationship_conflict: [
    { label: '성향궁합으로 이어보기', href: '/compatibility/personality', body: '상대와 부딪히는 지점을 관계의 결로 같이 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오해를 줄이는 한마디를 바로 물어볼 수 있어요.' },
  ],
  energy_health: [
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '생활 리듬과 회복 패턴을 자기이해 관점으로 이어봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오늘 무리하지 않는 기준을 물어볼 수 있어요.' },
  ],
  general: [
    { label: '타로로 보완하기', href: '/tarot/daily', body: '지금 마음의 결을 카드 한 장으로 가볍게 봅니다.' },
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '오늘을 넘어서 내 기본 흐름과 선택 습관까지 이어봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '풀이가 남으면 대화방에서 바로 이어 물어보세요.' },
  ],
};

function readStoredResult(sourceSessionId: string | undefined) {
  if (!sourceSessionId) return null;

  try {
    const raw = window.sessionStorage.getItem(`${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TodayFortuneFreeResult;
    return parsed.sourceSessionId === sourceSessionId ? parsed : null;
  } catch {
    return null;
  }
}

function buildTodayDetailHref(result: TodayFortuneFreeResult) {
  const params = new URLSearchParams({
    sourceSessionId: result.sourceSessionId,
    concern: result.concernId,
  });

  return `/today-fortune/detail?${params.toString()}`;
}

export function TodayFortuneResultClient({
  sourceSessionId,
  concern,
}: {
  sourceSessionId?: string;
  concern?: string;
}) {
  const [freeResult, setFreeResult] = useState<TodayFortuneFreeResult | null>(null);
  const concernId = normalizeConcernId(concern);
  const relatedLinks = useMemo(() => RELATED_LINKS[freeResult?.concernId ?? concernId], [concernId, freeResult]);

  useEffect(() => {
    const stored = readStoredResult(sourceSessionId);
    if (!stored) return;

    setFreeResult(stored);
    trackMoonlightEvent('premium_teaser_viewed', {
      from: 'today-fortune-result',
      concern: stored.concernId,
      sourceSessionId: stored.sourceSessionId,
    });
  }, [sourceSessionId]);

  function handleUnlock() {
    if (!freeResult) return;
    window.location.href = buildTodayDetailHref(freeResult);
  }

  return (
    <div className="gangi-subpage gangi-responsive-page pb-8">
      <GangiPageHeader title="오늘운세 결과" backHref="/today-fortune" />
      <PageIntro
        eyebrow="오늘의 결"
        title="오늘 필요한 한 줄을 먼저 확인해요"
        description="무료 결과는 짧게 보고, 마음에 남는 부분만 성향사주나 12간지 대화로 이어가면 됩니다."
        className="px-4 pt-3 sm:px-0"
      />

      <div className="grid gap-6 px-4 py-6">
        {!freeResult ? (
          <LightSection
            eyebrow="결과를 다시 불러와 주세요"
            title="무료 결과가 이 브라우저에 남아 있지 않아요"
            description="개인정보가 담긴 결과라 공개 URL로 다시 불러오지 않습니다. 오늘운세에서 한 번 더 눌러주세요."
            surface="paper"
            className="gangi-responsive-result-panel text-center"
            actions={
              <Link href={`/today-fortune?concern=${concernId}`} className="gangi-primary-button">
                오늘운세 다시 보기
              </Link>
            }
          />
        ) : (
          <ResultShell
            title={freeResult.oneLine.headline}
            summary={freeResult.oneLine.body}
            keywords={[freeResult.concernLabel, '무료 오늘운세', '짧은 결과']}
          >
            <TodayScoreReveal result={freeResult} />
            <TodayFortuneSummaryCard result={freeResult} />
            <TodayFortuneScoreGrid result={freeResult} />
            <OpportunityRiskCards result={freeResult} />
            <SajuReasonSnippet result={freeResult} />

            <PremiumLockCard
              copy={freeResult.nextAction.copy}
              coinCost={freeResult.nextAction.coinCost}
              onUnlock={handleUnlock}
              loading={false}
              sourceSessionId={freeResult.sourceSessionId}
              concernId={freeResult.concernId}
            />

            <LightSection surface="paper">
              <FollowUpQuestionChips
                questions={freeResult.followUpQuestions}
                sourceSessionId={freeResult.sourceSessionId}
                concernId={freeResult.concernId}
              />
            </LightSection>

            <LightSection
              eyebrow="다음 흐름"
              title="궁금한 부분만 이어보세요"
              description="오늘운세는 빠른 체크입니다. 더 보고 싶을 때만 성향사주, 성향궁합, 12간지 대화로 이어가면 됩니다."
              surface="soft"
            >
              <FlowEntryList
                items={relatedLinks.map((item) => ({
                  id: item.href + item.label,
                  href: item.href,
                  title: item.label,
                  description: item.body,
                  meta: '이어보기',
                }))}
              />
            </LightSection>
            <SafetyNotice />
          </ResultShell>
        )}
      </div>
    </div>
  );
}
