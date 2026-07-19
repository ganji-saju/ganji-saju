import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportPrintActions } from '@/components/report/report-print-actions';
import { EntitlementRefresher } from '@/components/saju/entitlement-refresher';
import { ReportDocument, buildPdfModel } from '@/components/report/report-document';
import { buildLifetimeReport } from '@/domain/saju/report';
import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

// 2026-05-23 PDF 8페이지 정확 복제 리디자인 — 사용자 목업(8장 A4)을 픽셀 단위 복제.
//   인쇄(window.print) → 브라우저 "PDF로 저장" 플로우 그대로. 8페이지 문서 마크업은
//   src/components/report/report-document.tsx (ReportDocument) 로 분리해 /dev 미리보기와
//   동일 렌더를 공유한다. 데이터 갭은 src/lib/saju/pdf-report-maps.ts 결정적 매핑으로 채움.

function buildReportNumber(input: SajuDataV1['input']) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  const dd = String(new Date().getDate()).padStart(2, '0');
  const seed = `${input.birth.year}${input.birth.month}${input.birth.day}`.slice(-4);
  return `GS-${yy}${mm}${dd}-${seed}`;
}

/** 발행일 — "2026.05.23" 숫자 포맷. */
function issuedDateLabel() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}.${m}.${d}`;
}

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '깊은 사주풀이 PDF 저장',
    description: '평생 소장용 깊은 사주풀이를 PDF로 저장하기 위한 인쇄 화면입니다.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

async function resolvePdfAccess(slug: string) {
  const reading = await resolveReading(slug);
  if (!reading) return { reading: null, hasAccess: false, isOwner: false };

  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
    return { reading, hasAccess: false, isOwner: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { reading, hasAccess: false, isOwner: false };

  const isOwner = !reading.userId || reading.userId === user.id;
  if (!isOwner) return { reading, hasAccess: false, isOwner };

  const readingKey = toSlug(reading.input);
  const entitlement = await getLifetimeReportEntitlement(user.id, readingKey, [slug]);

  return {
    reading,
    hasAccess: Boolean(entitlement),
    isOwner,
  };
}

export default async function LifetimeReportPrintPage({ params }: Props) {
  const { slug } = await params;
  const { reading, hasAccess, isOwner } = await resolvePdfAccess(slug);

  if (!reading) notFound();

  const backHref = `/saju/${encodeURIComponent(slug)}/premium`;

  if (!hasAccess) {
    return (
      <AppShell>
        {/* 2026-05-16 A7 — 다른 탭에서 lifetime 결제 후 본 페이지로 돌아오면
            focus 시 entitlement 재확인 → 권한 획득 감지 시 router.refresh()
            로 PDF 전체 화면으로 자동 전환. */}
        <EntitlementRefresher
          productId="lifetime-report"
          slug={slug}
          initialHasEntitlement={false}
        />
        <AppPage className="gangi-subpage saju-result-page space-y-5 py-6">
          <section
            className="relative overflow-hidden rounded-[20px] border p-6"
            style={{
              background: 'linear-gradient(180deg, var(--app-pink-soft) 0%, #fff 100%)',
              borderColor: 'var(--app-pink-line)',
              boxShadow: '0 22px 50px -28px rgba(216,27,114,0.22)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,79,154,0.18), transparent 70%)' }}
            />

            <div className="relative flex items-start gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[25.3px] font-extrabold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                  boxShadow: '0 10px 22px rgba(216,27,114,0.32)',
                  fontFamily: 'var(--font-han)',
                }}
                aria-hidden="true"
              >
                干
              </span>
              <div className="min-w-0 flex-1">
                <span
                  className="rounded-[12px] border bg-white px-2.5 py-0.5 text-[12.1px] font-extrabold text-[var(--app-pink-strong)]"
                  style={{ borderColor: 'var(--app-pink-line)' }}
                >
                  🔒 PDF 저장 권한 필요
                </span>
                <h1
                  className="mt-2 text-[25.3px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  깊은 사주풀이 PDF는
                  <br />
                  소장권에서 열립니다
                </h1>
                <p
                  className="mt-2.5 text-[15.5px] leading-[1.78] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  PDF 저장본은 평생 소장 풀이 본문과 함께 제공됩니다. 풀이를 열면 같은 사주로 다시 들어와도
                  이 화면에서 PDF 저장을 이어갈 수 있어요.
                </p>
              </div>
            </div>

            {!isOwner ? (
              <div
                className="relative mt-4 rounded-[12px] border px-3.5 py-2.5 text-[14.4px] leading-[1.7]"
                style={{
                  background: '#fdecec',
                  borderColor: 'rgba(198,69,69,0.22)',
                  color: 'var(--app-ink)',
                }}
              >
                본인의 사주 결과가 아니면 PDF 저장 화면을 열 수 없습니다.
              </div>
            ) : null}

            <div className="relative mt-5 grid gap-2">
              <Link
                href={`/membership/checkout?plan=lifetime&slug=${encodeURIComponent(slug)}&from=pdf-print`}
                className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                깊은 사주풀이 열기 →
              </Link>
              <Link
                href={backHref}
                className="inline-flex h-12 items-center justify-center rounded-[12px] border bg-white px-5 text-[15px] font-extrabold text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                ← 풀이 화면으로 돌아가기
              </Link>
            </div>
          </section>
        </AppPage>
      </AppShell>
    );
  }

  const targetYear = new Date().getFullYear();
  // 2026-05-15 PR 2: userSituation 을 grounding 에서 추출해 대운 cycle 8단 sub-section 에 흘림.
  const userSituation = reading.grounding.personalizationContext.userSituation ?? null;
  const report = buildLifetimeReport(reading.input, reading.sajuData, targetYear, userSituation);
  const reportNo = buildReportNumber(reading.sajuData.input);
  const issuedAt = issuedDateLabel();
  // 2026-05-25 — 결제한 LLM 깊은 풀이(본편)를 PDF 본문에 반영. Phase 0a 캐시로 재열람 시 즉시 hit.
  //   cold miss/LLM 실패 시 내부 fallback(결정론) → PDF 는 항상 렌더(비차단).
  const interpretationResult = await generateLifetimeInterpretation({
    readingIdentifier: slug,
    targetYear,
    readingRecord: reading,
  });
  const interpretation = interpretationResult?.interpretation ?? null;
  const data = buildPdfModel(reading, report, reportNo, targetYear, interpretation);

  return (
    <AppShell>
      {/* 2026-05-16 A7 — lifetime 환불/만료 등으로 권한 잃은 경우 focus 시 감지 →
          router.refresh() 로 gated view 로 자동 전환. */}
      <EntitlementRefresher productId="lifetime-report" slug={slug} initialHasEntitlement />
      <AppPage className="pdf-report-page-wrap space-y-6 py-6">
        <ReportPrintActions slug={slug} backHref={backHref} />
        <ReportDocument data={data} issuedAt={issuedAt} />
      </AppPage>
    </AppShell>
  );
}
