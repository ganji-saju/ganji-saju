import Link from 'next/link';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { ReportList, type ReportBadgeKind, type ReportListItem } from '@/components/moonlight/ReportList';
import { MY_MENU_BLUEPRINT } from '@/content/moonlight';
import { getAccountDashboardData } from '@/lib/account';
import {
  getSubscriptionPlanLabel,
  getSubscriptionStatusLabel,
} from '@/lib/subscription';

function formatRenewalLabel(value: string | null) {
  if (!value) return '갱신일 미정';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function getPurchasedReportKind(productId: string): ReportBadgeKind {
  if (productId === 'saju_personality_mini') return 'saju-personality';
  if (productId === 'personality_compatibility_mini') return 'personality-compatibility';
  if (productId === 'love-question') return 'compatibility';
  if (productId === 'today-detail') return 'today';
  if (productId === 'ai_chat' || productId === 'dialogue') return 'dialogue';
  return 'saju';
}

export default async function MyPage() {
  const dashboard = await getAccountDashboardData('/my', {
    readingLimit: 4,
    transactionLimit: 4,
  });

  const mostRecentReading = dashboard.recentReadings[0];
  const planTitle = dashboard.subscription
    ? getSubscriptionPlanLabel(dashboard.subscription.plan)
    : '무료 이용 중';
  const planSummary = dashboard.subscription
    ? `${getSubscriptionStatusLabel(dashboard.subscription.status)} · ${formatRenewalLabel(
        dashboard.subscription.renewsAt
      )}`
    : '아직 가입한 멤버십이 없습니다';
  const reportRows: Array<ReportListItem & { createdAt: string }> = [
    ...dashboard.purchasedResults.map((report) => ({
      id: `purchased-${report.id}`,
      title: report.title,
      description: report.summary ?? `${formatSavedDate(report.createdAt)}에 열어본 리포트`,
      href: report.href === '/my/results' ? '/my#recent-reports' : report.href,
      kind: getPurchasedReportKind(report.productId),
      meta: '재열람',
      createdAt: report.createdAt,
    })),
    ...dashboard.recentReadings.map((reading) => ({
      id: `reading-${reading.id}`,
      title: reading.dayPillarLabel ? `${reading.dayPillarLabel} 사주 풀이` : '저장한 사주 풀이',
      description: `${formatSavedDate(reading.createdAt)} 저장 · 생년월일시는 목록에 표시하지 않습니다`,
      href: `/saju/${reading.id}`,
      kind: 'saju' as const,
      meta: '재열람',
      createdAt: reading.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const reportItems: ReportListItem[] = reportRows.map(({ createdAt: _createdAt, ...item }) => item);

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="MY"
        title="내 풀이와 결제, 여기서 이어봐요"
        description="보관함은 최근 리포트를 다시 여는 곳입니다. 목록에는 생년월일시와 성별을 직접 노출하지 않습니다."
        actions={
          <>
            <Link href="#recent-reports" className="gangi-primary-button">
              최근 리포트 보기
            </Link>
            <Link href="/my/profile" className="gangi-secondary-button">
              내 정보 관리
            </Link>
          </>
        }
      />

      <LightSection
        eyebrow="요약"
        title={mostRecentReading ? '최근 풀이를 바로 이어볼 수 있어요' : '첫 풀이를 저장해 보세요'}
        description="개인 입력값 대신 저장 개수, 코인, 플랜 상태만 요약합니다."
        surface="soft"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-4">
            <p className="text-xs font-bold text-[var(--gyeol-muted)]">보관</p>
            <strong className="mt-1 block text-xl text-[var(--gyeol-text)]">
              {dashboard.readingCount + dashboard.purchasedResults.length}개
            </strong>
            <span className="text-xs leading-5 text-[var(--gyeol-muted)]">저장/구매 리포트</span>
          </div>
          <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-4">
            <p className="text-xs font-bold text-[var(--gyeol-muted)]">코인</p>
            <strong className="mt-1 block text-xl text-[var(--gyeol-text)]">
              {dashboard.credits.total}개
            </strong>
            <span className="text-xs leading-5 text-[var(--gyeol-muted)]">
              기본 {dashboard.credits.balance} · 멤버십 {dashboard.credits.subscriptionBalance}
            </span>
          </div>
          <div className="rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-paper)] p-4">
            <p className="text-xs font-bold text-[var(--gyeol-muted)]">플랜</p>
            <strong className="mt-1 block text-xl text-[var(--gyeol-text)]">{planTitle}</strong>
            <span className="text-xs leading-5 text-[var(--gyeol-muted)]">{planSummary}</span>
          </div>
        </div>
      </LightSection>

      <LightSection eyebrow="바로가기" title="관리 메뉴">
        <FlowEntryList
          items={MY_MENU_BLUEPRINT.map((item) => ({
            id: item.title,
            title: item.title,
            description: item.description,
            href: item.href,
            meta: '이동',
          }))}
        />
      </LightSection>

      <LightSection
        eyebrow="보관함"
        title="최근 리포트"
        description="성향사주, 성향궁합, 사주, 궁합을 배지로 구분합니다."
        className="pb-5"
      >
        <div id="recent-reports">
          <ReportList
            items={reportItems}
            empty="아직 저장된 풀이가 없습니다. 사주나 성향사주를 본 뒤 MY에서 다시 확인할 수 있습니다."
          />
        </div>
      </LightSection>
    </div>
  );
}
