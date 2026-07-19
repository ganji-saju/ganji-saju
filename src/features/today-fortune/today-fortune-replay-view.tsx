'use client';

// 2026-07-10 — 보관함 '다시보기' 전용 읽기 뷰(/today-fortune/runs/[id]).
//
// TodayFortuneResultClient 를 재사용하지 않는 이유:
//   (1) 그 화면의 PremiumLockCard.onUnlock 은 /today-fortune/detail 로 보내는데,
//       상세는 항상 '오늘'을 기준으로 계산한다 → 과거 날짜 재현 화면에서 언락을 띄우면
//       사용자는 지난 날짜를 눌러 오늘 결과를 결제하게 된다.
//   (2) 결과 본문을 sessionStorage 에서 읽는 구조라 서버에서 재계산한 결과를 넣을 자리가 없다.
//   (3) 푸시 권한 prompt·ML 피드백 카드는 '방금 본 운세' 전제라 과거 재현엔 부적절하다.
// 결정론 본문(점수·일진·카테고리·행운·명식)만 그대로 보여준다.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { SituationReflectionCard } from '@/components/saju/situation-reflection-card';
import { TodayCategoryReadings } from '@/components/today-fortune/today-category-readings';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { TodayIljinBreakdownCard } from '@/components/today-fortune/today-iljin-breakdown-card';
import { TodayLuckyPackageCard } from '@/components/today-fortune/today-lucky-package-card';
import { TodaySajuChartCard } from '@/components/today-fortune/today-saju-chart-card';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import type { TodayFortuneFreeResult } from '@/lib/today-fortune/types';

function formatOccurredOn(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export function TodayFortuneReplayView({ result }: { result: TodayFortuneFreeResult }) {
  return (
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="보관된 오늘의 운세" backHref="/my/results" />

      <div className="grid gap-4 px-4 py-5">
        <p className="rounded-2xl border border-[var(--app-line)] bg-[var(--app-cream,#fff9f3)] px-4 py-3 text-[15px] leading-6 text-[var(--app-copy)]">
          {formatOccurredOn(result.dateKey)}에 본 오늘의 운세를 그대로 다시 계산해 보여드립니다. 새로
          풀이하지 않으니 결과는 그날과 같습니다.
        </p>

        <TodayFortuneSummaryCard result={result} />

        {result.userSituation ? (
          <div className="px-1">
            <SituationReflectionCard
              situation={result.userSituation}
              variant="compact"
              fallbackInputHref="/saju/new"
            />
          </div>
        ) : null}

        <TodayScoreReveal result={result} />

        {result.iljinScore ? (
          <TodayIljinBreakdownCard
            iljinScore={result.iljinScore}
            iljinMessages={result.iljinMessages ?? null}
          />
        ) : null}

        <TodayCategoryReadings result={result} />

        {result.luckyPackage ? <TodayLuckyPackageCard luckyPackage={result.luckyPackage} /> : null}

        {result.sajuChart ? <TodaySajuChartCard chart={result.sajuChart} /> : null}

        <Link
          href="/today-fortune"
          className="flex items-center justify-center gap-2 rounded-[12px] bg-[var(--app-pink)] px-5 py-4 text-[17px] font-extrabold text-white shadow-[0_14px_32px_rgba(216,27,114,0.28)]"
        >
          오늘의 운세 새로 보기
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
