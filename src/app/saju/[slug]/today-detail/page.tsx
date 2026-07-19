// 2026-05-18 — /saju/[slug]/today-detail 와 /today-fortune/detail 의 UI/풀이 데이터 통일.
// 이전 (PR #206 redesign): 777줄 inline 렌더링 + buildSajuReport(input, sajuData, topic) 1회 호출.
// 이전 회귀: 사용자 보고 — 같은 today-detail 결제인데 사주/운세 진입 경로별로 풀이·디자인이 달랐음.
// 변경: TodayFortuneDetailClient 재사용. slug == sourceSessionId 동일 식별자.
//   - 동일한 컴포넌트 (TodayPremiumPanel + Summary/Score/Iljin/Category/Lucky/Chart/Daewoon 카드 6+개)
//   - 동일한 데이터 (POST /api/today-fortune/unlock → 5 topic buildSajuReport + iljin 점수 통합)
//   - backHref 만 /saju/{slug} 로 override 해서 사주 컨텍스트 유지.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneDetailClient } from '@/features/today-fortune/today-fortune-detail-client';
import { resolveReading } from '@/lib/saju/readings';
import { AppShell } from '@/shared/layout/app-shell';
import { topicProductForConcern } from '@/app/api/today-fortune/unlock/route-helpers';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string; concern?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '오늘 자세히 보기',
    description: '구매한 오늘 상세 풀이를 짧고 쉽게 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

export default async function SajuTodayDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { concern, topic } = await searchParams;
  // slug 가 존재하는 reading 인지 검증 — 잘못된 link 차단.
  const reading = await resolveReading(slug);
  if (!reading) notFound();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneDetailClient
        sourceSessionId={slug}
        concern={concern ?? topic}
        // 2026-07-19 — 주제 단품(재물·일)로 들어온 경우 그 상품으로 표기해야
        //   미로그인 복귀(`/login?next=...&paid=`)와 재구매 안내가 맞는 상품을 가리킨다.
        //   today-detail 로 고정돼 있으면 재물 단품 구매자가 오늘 상세 결제 화면으로 튄다.
        paidProduct={topicProductForConcern(concern ?? topic) ?? 'today-detail'}
        backHref={`/saju/${encodeURIComponent(slug)}`}
      />
    </AppShell>
  );
}
