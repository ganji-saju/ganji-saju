// 2026-09-26 — 2027 신년운세. 이용권(신년운세·평생)이 있으면 연간 패널(full 티어: 가족·학업·분기·기대/조심 포함)과
//   PDF 저장 버튼, 없으면 결정론 미리보기(키워드·한 줄 요약) + 결제 버튼. 전체 풀이 권한은 /api/interpret/yearly 가 다시 판정한다.
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import YearlyReportPanel from '@/components/ai/yearly-report-panel';
import { EntitlementRefresher } from '@/components/saju/entitlement-refresher';
import { buildYearlyReport } from '@/domain/saju/report';
import { formatWon, NEW_YEAR_TARGET_YEAR } from '@/lib/payments/catalog';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { resolveNewYearPreviewPrice } from '@/lib/new-year-preview-price';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string; year: string }>;
}

const LOCKED_CHAPTERS = [
  '2027 사주풀이 총론 · 상반기/하반기',
  '분야별 8가지 운 — 일·재물·연애·인간관계·건강·이동·가족·학업',
  '분기별 흐름 1~4분기',
  '월별 흐름 1~12월',
  '2027년에 기대할 일 · 조심할 일',
  '올해의 행동 지침',
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${NEW_YEAR_TARGET_YEAR} 신년운세`,
    description: `${NEW_YEAR_TARGET_YEAR}년 한 해의 총운과 분야별·월별 흐름, 기대할 일과 조심할 일을 정리합니다.`,
    robots: { index: false, follow: false },
  };
}

export default async function NewYearPage({ params }: Props) {
  const { slug, year } = await params;
  if (Number(year) !== NEW_YEAR_TARGET_YEAR) notFound();

  const { reading, user, hasAccess } = await resolveNewYearAccess(slug, NEW_YEAR_TARGET_YEAR);
  if (!reading) notFound();

  const encodedSlug = encodeURIComponent(slug);

  if (hasAccess) {
    return (
      <AppShell>
        <AppPage className="gangi-subpage saju-result-page space-y-5 py-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[23px] font-extrabold text-[var(--app-ink)]">{NEW_YEAR_TARGET_YEAR} 신년운세</h1>
            <Link
              href={`/saju/${encodedSlug}/new-year/${NEW_YEAR_TARGET_YEAR}/print`}
              className="rounded-[12px] border border-[var(--app-line)] bg-white px-4 py-2 text-[14.4px] font-bold text-[var(--app-ink)]"
            >
              PDF로 저장
            </Link>
          </header>
          <YearlyReportPanel slug={slug} targetYear={NEW_YEAR_TARGET_YEAR} />
        </AppPage>
      </AppShell>
    );
  }

  const report = buildYearlyReport(reading.input, reading.sajuData, NEW_YEAR_TARGET_YEAR);
  const price = await resolveNewYearPreviewPrice(user, (await headers()).get('host'));

  return (
    <AppShell>
      {/* 다른 탭에서 결제하고 돌아오면 이용권을 다시 확인해 전체 화면으로 바꾼다. */}
      <EntitlementRefresher productId="new-year" slug={slug} initialHasEntitlement={false} />
      <AppPage className="gangi-subpage saju-result-page space-y-5 py-6">
        <section
          className="rounded-[20px] border p-6"
          style={{ background: 'linear-gradient(180deg, #fdf6e7 0%, #fff 100%)', borderColor: 'rgba(184,122,20,0.22)' }}
        >
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[#b87a14]">
            {report.annualContext.yearGanji}년 · {NEW_YEAR_TARGET_YEAR}
          </div>
          <h1 className="mt-1 text-[24px] font-extrabold leading-snug text-[var(--app-ink)]">
            {NEW_YEAR_TARGET_YEAR} 신년운세
          </h1>
          <p className="mt-3 text-[17px] font-extrabold leading-[1.6] text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
            {report.oneLineSummary}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.coreKeywords.slice(0, 3).map((keyword) => (
              <span
                key={keyword.label}
                className="rounded-[12px] border bg-white px-3 py-1.5 text-[13.8px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {keyword.label}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border bg-white p-5" style={{ borderColor: 'var(--app-line)' }}>
          <h2 className="text-[17px] font-extrabold text-[var(--app-ink)]">결제하면 열리는 내용</h2>
          <ul className="mt-3 grid gap-2">
            {LOCKED_CHAPTERS.map((chapter) => (
              <li key={chapter} className="flex items-center gap-2 text-[14.4px] text-[var(--app-copy)]">
                <span aria-hidden="true">🔒</span>
                {chapter}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13.8px] text-[var(--app-copy-muted)]">
            한 번 결제하면 계속 다시 보고 PDF로 저장할 수 있습니다.
          </p>
        </section>

        <div className="space-y-2">
          {price.memberPercent > 0 ? (
            <p className="text-center text-[13.8px] text-[var(--app-copy-muted)]">
              <s>{formatWon(price.listAmount)}</s> → 프리미엄 멤버십 {price.memberPercent}% 할인
            </p>
          ) : null}
          <Link
            href={`/membership/checkout?product=new-year&slug=${encodedSlug}&from=new-year-preview`}
            className="flex h-12 items-center justify-center rounded-[12px] bg-[var(--app-pink)] text-[16.1px] font-extrabold text-white"
          >
            {formatWon(price.chargeAmount)}에 2027 신년운세 열기
          </Link>
        </div>
      </AppPage>
    </AppShell>
  );
}
