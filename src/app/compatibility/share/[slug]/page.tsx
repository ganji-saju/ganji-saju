// 2026-07-03 — 궁합 공개 공유 스냅샷 (docs/superpowers/specs/2026-07-03-share-snapshot-design.md).
// 공유 slug(관계--자기slug--상대slug)에서 두 사람 생년을 복원해 로그인 없이 결정론
// 재계산·렌더한다(사주 공개 slug 와 동일 패턴). 무료 화면 + 유료 CTA — 유료 심층은
// "수신자 본인"의 구매/멤버십으로만 열람. 개인 스코프 ID(familyId 등) 미포함.
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import { CompatibilityResultView } from '@/features/compatibility/compatibility-result-view';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  buildCompatibilityCoupleKey,
  buildCompatibilityInterpretation,
} from '@/lib/compatibility';
import { parseCompatibilityShareSlug } from '@/lib/compatibility/share-slug';
import {
  hasCompatibilityAccess,
  isCompatibilityPerCouplePricingEnabled,
} from '@/lib/payments/compatibility-access';
import { isCompatibilityInterpretationLLMEnabled } from '@/server/ai/compatibility/compatibility-interpretation-cache';
import { formatBirthSummary } from '@/features/saju-detail/saju-screen-helpers';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '궁합 결과 공유',
    description: '친구가 공유한 두 사람의 궁합 결과입니다.',
    // 생년 정보가 URL 에 담기므로 검색 비노출(사주 공유 페이지와 동일 정책).
    robots: { index: false, follow: false },
  };
}

function cleanName(raw: string | undefined, fallback: string): string {
  const name = (raw ?? '').trim().slice(0, 20);
  return name || fallback;
}

export default async function CompatibilitySharePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { a, b } = await searchParams;
  const parsed = parseCompatibilityShareSlug(decodeURIComponent(slug));
  if (!parsed) notFound();

  const selfName = cleanName(a, '나');
  const partnerName = cleanName(b, '상대');
  const selected =
    COMPATIBILITY_RELATIONSHIPS.find((item) => item.slug === parsed.relationship) ??
    COMPATIBILITY_RELATIONSHIPS[0];

  const compatibility = buildCompatibilityInterpretation(
    parsed.relationship,
    { name: selfName, birthInput: parsed.self },
    { name: partnerName, birthInput: parsed.partner }
  );
  const coupleKey = buildCompatibilityCoupleKey(parsed.self, parsed.partner);

  // 유료 심층은 "보는 사람 본인"의 구매로만. 멤버 월 무료(tryConsume)는 여기서 쓰지
  // 않는다 — 공유 링크를 여는 것만으로 수신자의 월 쿼터가 소모되면 안 됨.
  let viewerHasDeepAccess = false;
  if (hasSupabaseServerEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      viewerHasDeepAccess = await hasCompatibilityAccess(user.id, coupleKey);
    }
  }

  // 재공유 링크(수신자가 다시 공유해도 같은 결과) — 이름 쿼리 유지.
  const sharePath = `/compatibility/share/${slug}?${new URLSearchParams({
    a: selfName,
    b: partnerName,
  }).toString()}`;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        {/* 공유 유입 안내 배너 */}
        <article
          className="rounded-[14px] border px-4 py-3 text-[13.8px] leading-[1.55]"
          style={{ background: 'var(--app-pink-soft)', borderColor: 'var(--app-pink-line)' }}
        >
          <span className="font-extrabold text-[var(--app-pink-strong)]">공유받은 궁합</span>
          <span className="text-[var(--app-copy-muted)]">
            {' '}
            — {selfName}님과 {partnerName}님의 결과예요. 아래에서 내 궁합도 바로 볼 수 있어요.
          </span>
        </article>

        <CompatibilityResultView
          selected={selected}
          compatibility={compatibility}
          selfName={selfName}
          partnerName={partnerName}
          selfBirthSummary={formatBirthSummary(parsed.self)}
          partnerBirthSummary={formatBirthSummary(parsed.partner)}
          retakeHref={`/compatibility/input?relationship=${selected.slug}`}
          hasLoveQuestionPurchase={viewerHasDeepAccess}
          selfBirthInput={parsed.self}
          partnerBirthInput={parsed.partner}
          deepLlmEnabled={isCompatibilityInterpretationLLMEnabled()}
          compatibilityCoupleKey={coupleKey}
          perCouplePricingEnabled={isCompatibilityPerCouplePricingEnabled()}
        />

        {/* 내 궁합 CTA */}
        <section className="px-1">
          <Link
            href={`/compatibility/input?relationship=${selected.slug}`}
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-4 py-3 text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            우리 궁합도 보러가기 →
          </Link>
        </section>

        {/* 재공유 */}
        <section className="px-1">
          <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">친구에게 공유</h2>
          <ShareActions
            text={`${selfName} × ${partnerName} 궁합 — ${compatibility.label}`}
            url={getCanonicalUrl(sharePath)}
            className="mt-2.5"
            kakao={buildKakaoShare({
              title: `${selfName} × ${partnerName} 궁합`,
              description: compatibility.summary,
              path: sharePath,
              buttonTitle: '궁합 결과 보기',
            })}
          />
        </section>
      </AppPage>
    </AppShell>
  );
}
