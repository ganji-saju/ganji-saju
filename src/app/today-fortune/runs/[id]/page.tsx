import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneReplayView } from '@/features/today-fortune/today-fortune-replay-view';
import { buildSajuInterpretationGrounding, buildSajuReport } from '@/domain/saju/report';
import { createClient } from '@/lib/supabase/server';
import { resolveReading } from '@/lib/saju/readings';
import { getTodayFortuneRunById } from '@/lib/today-fortune/run-log';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '보관된 오늘운세 다시보기',
  description: '보관함에 담긴 그날의 오늘운세를 그대로 다시 확인합니다.',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TodayFortuneRunPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/today-fortune/runs/${id}`)}`);
  }

  const run = await getTodayFortuneRunById(user.id, id);
  if (!run) notFound();

  // 재현의 핵심: 생성 당시의 `now` 를 두 빌더에 동일하게 주입한다.
  //   이게 없으면 오늘 날짜의 일진으로 계산돼 "다시보기"가 새 운세가 된다.
  const now = new Date(run.generatedAt);
  const sajuData = buildFreshTodaySajuData(run.input, { now });

  // grounding/kasi 는 reading 행의 불변 데이터. 행이 없거나(게스트 slug fallback) 사라졌으면
  // API 와 동일한 식으로 재계산한다(route.ts 의 persistedGrounding 초기값과 같은 코드).
  const reading = run.readingId ? await resolveReading(run.readingId) : null;
  const grounding =
    reading?.grounding ??
    buildSajuInterpretationGrounding(
      run.input,
      sajuData,
      buildSajuReport(run.input, sajuData, 'today')
    );
  const kasiComparison = reading?.kasiComparison ?? null;

  // 표시 이름은 생성 시점 스냅샷을 쓴다(이후 프로필 변경과 무관하게 그날 화면을 재현).
  const enrichedInput = run.displayName ? { ...run.input, name: run.displayName } : run.input;

  const result = buildTodayFortuneFreeResult(enrichedInput, sajuData, {
    concernId: run.concernId,
    sourceSessionId: run.sourceSessionId,
    calendarType: run.calendarType,
    timeRule: run.timeRule,
    counselorId: run.counselorId,
    grounding,
    kasiComparison,
    now,
  });

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneReplayView result={result} />
    </AppShell>
  );
}
