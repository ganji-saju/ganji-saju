// Redesign 2026-05-17 — server wrapper. UI 는 CompatibilityResultView /
// ManualCompatibilityResultClient 안에 있고 이 page 는 entitlement check + profile
// resolve + view 렌더만 (사실상 thin wrapper).
import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiIntro, GangiMiniCard, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import { CompatibilityResultView } from '@/features/compatibility/compatibility-result-view';
import { ManualCompatibilityResultClient } from '@/features/compatibility/manual-compatibility-result-client';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  buildCompatibilityCoupleKey,
  buildCompatibilityInterpretation,
  inferCompatibilityRelationshipSlug,
  resolveProfileDisplayName,
} from '@/lib/compatibility';
import {
  getProfileSettingsData,
  hasCoreBirthProfile,
  toBirthInputFromProfile,
  type BirthProfileFields,
} from '@/lib/profile';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  hasCompatibilityAccess,
  isCompatibilityPerCouplePricingEnabled,
  tryConsumeMemberCompatAccess,
} from '@/lib/payments/compatibility-access';
import { isCompatibilityInterpretationLLMEnabled } from '@/server/ai/compatibility/compatibility-interpretation-cache';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';
import { buildCompatibilityShareSlug } from '@/lib/compatibility/share-slug';

interface Props {
  searchParams: Promise<{ relationship?: string; familyId?: string; source?: string; paid?: string }>;
}

function formatBirthSummary(profile: BirthProfileFields) {
  if (!hasCoreBirthProfile(profile)) {
    return '생년월일이 아직 완성되지 않았습니다.';
  }

  const timeLabel =
    profile.birthHour === null
      ? '시간 미입력'
      : `${profile.birthHour}시${profile.birthMinute === null ? '' : ` ${String(profile.birthMinute).padStart(2, '0')}분`}`;
  const genderLabel =
    profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '성별 미입력';
  const locationLabel = profile.birthLocationLabel
    ? ` · ${profile.birthLocationLabel}${profile.solarTimeMode === 'longitude' ? ' 경도 보정' : ''}`
    : '';

  return `${profile.birthYear}.${profile.birthMonth}.${profile.birthDay} · ${timeLabel} · ${genderLabel}${locationLabel}`;
}

function SetupState({
  relationshipHref,
  body,
}: {
  relationshipHref: string;
  body: string;
}) {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="궁합" backHref="/compatibility/input" />
        <GangiIntro
          eyebrow="궁합 준비"
          title={
            <>
              두 사람 정보를
              <br />
              먼저 채워주세요
            </>
          }
          description={body}
        />
        <section className="px-4 pb-8 sm:px-0">
          <div className="gangi-pink-panel p-4">
            <GangiMiniCard
              label="바로 보기"
              title="저장된 사람이 없어도 됩니다"
              desc="내 정보와 상대 정보를 함께 입력하면 바로 궁합 결과로 이어집니다."
            />
            <div className="mt-4 grid gap-2">
              <Link href={relationshipHref} className="gangi-primary-button">
                두 사람 정보 입력하기
              </Link>
              <Link href="/my/profile" className="gangi-secondary-button">
                MY 프로필 열기
              </Link>
            </div>
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '궁합 결과',
    description: '두 사람의 명식을 비교해 관계의 흐름을 읽는 궁합 결과 화면입니다.',
    // 개인 결과(쿼리에 생년 정보) — 공유 스냅샷과 동일하게 meta noindex 로 처리.
    robots: { index: false, follow: false },
  };
}

export default async function CompatibilityResultPage({ searchParams }: Props) {
  // 2026-07-03 — paid 쿼리는 접근 판정에서 제거(위조 가능). destructure 에서도 미사용 정리.
  const { relationship, familyId, source } = await searchParams;

  if (source === 'manual') {
    // 2026-05-16 — manual 분기도 URL paid 만 의존하지 않고 server 측 entitlement 도 확인.
    //   이미 love-question 구매한 사용자가 manual 결과 화면에서 다시 결제 link 보지 않게.
    const manualData = await getProfileSettingsData(`/compatibility/result?source=manual${relationship ? `&relationship=${relationship}` : ''}`).catch(() => null);
    const manualLoveEntitlement = manualData?.user.id
      ? Boolean(await getTasteProductEntitlement(manualData.user.id, 'love-question'))
      : false;
    return (
      <ManualCompatibilityResultClient
        relationship={relationship}
        // 2026-07-03 보안 — URL ?paid= 쿼리 단락 제거(위조 가능 페이월 우회).
        //   서버 entitlement(getTasteProductEntitlement)만 신뢰. 결제 confirm 이
        //   entitlement 를 동기 기록하므로 결제 직후에도 이 값이 곧바로 true.
        hasLoveQuestionPurchase={manualLoveEntitlement}
        deepLlmEnabled={isCompatibilityInterpretationLLMEnabled()}
        perCouplePricingEnabled={isCompatibilityPerCouplePricingEnabled()}
      />
    );
  }

  const selectedRelationship = relationship
    ? COMPATIBILITY_RELATIONSHIPS.find((item) => item.slug === relationship)?.slug
    : undefined;
  const redirectPath = `/compatibility/result${relationship || familyId ? `?${new URLSearchParams({ ...(relationship ? { relationship } : {}), ...(familyId ? { familyId } : {}) }).toString()}` : ''}`;
  const data = await getProfileSettingsData(redirectPath);
  const displayName = resolveProfileDisplayName(data.profile.displayName, data.user.email);
  const selectedFamily = data.familyProfiles.find((profile) => profile.id === familyId) ?? null;
  const resolvedRelationship =
    selectedRelationship ??
    (selectedFamily ? inferCompatibilityRelationshipSlug(selectedFamily.relationship) : 'lover');
  const selected =
    COMPATIBILITY_RELATIONSHIPS.find((item) => item.slug === resolvedRelationship) ??
    COMPATIBILITY_RELATIONSHIPS[0];

  if (!selectedFamily) {
    return (
      <SetupState
        relationshipHref={`/compatibility/input?relationship=${selected.slug}`}
        body="궁합을 볼 사람을 아직 고르지 않았습니다. 저장된 사람을 선택하거나, 두 사람 정보를 직접 입력하면 실제 두 명식을 비교해서 읽어드립니다."
      />
    );
  }

  if (!hasCoreBirthProfile(data.profile)) {
    return (
      <SetupState
        relationshipHref={`/compatibility/input?relationship=${selected.slug}`}
        body="내 생년월일이 비어 있어 저장된 사람과의 궁합 계산을 시작할 수 없습니다. 직접 입력으로 바로 보거나 MY 프로필에서 내 정보를 먼저 저장해 주세요."
      />
    );
  }

  if (!hasCoreBirthProfile(selectedFamily)) {
    return (
      <SetupState
        relationshipHref={`/compatibility/input?relationship=${selected.slug}`}
        body={`${selectedFamily.label}님의 생년월일이 아직 완성되지 않았습니다. 직접 입력으로 바로 보거나 저장된 사람 정보에서 생년월일을 먼저 보완해 주세요.`}
      />
    );
  }

  const selfBirthInput = toBirthInputFromProfile(data.profile);
  const partnerBirthInput = toBirthInputFromProfile(selectedFamily);
  const compatibility = buildCompatibilityInterpretation(
    selected.slug,
    {
      name: displayName,
      birthInput: selfBirthInput,
    },
    {
      name: selectedFamily.label,
      birthInput: partnerBirthInput,
    }
  );

  // ① per-couple 게이트(grandfather 포함). 플래그 OFF 환경에선 compat-reading 구매가 없어
  //   사실상 love-question 글로벌 = 기존 동작과 동일.
  const coupleKey = buildCompatibilityCoupleKey(selfBirthInput, partnerBirthInput);
  // 구매(글로벌/커플) > 멤버 월 무료(premium 3/plus 1, 커플별 멱등) 순으로 접근 판정.
  // tryConsumeMemberCompatAccess 가 내부에서 tier 자가 판별하므로 사전 isPremiumMember 체크 불필요.
  // 2026-07-03 보안 — URL ?paid= 쿼리 단락 제거: 쿼리만 붙이면 무결제 열람되는 위조 가능
  //   페이월 우회였음. 결제 confirm 이 entitlement 를 동기 기록하므로 결제 직후에도
  //   hasCompatibilityAccess 가 곧바로 true → 정상 흐름 영향 없음.
  const hasDeepReadingAccess =
    (data.user.id ? await hasCompatibilityAccess(data.user.id, coupleKey) : false) ||
    (data.user.id ? await tryConsumeMemberCompatAccess(data.user.id, coupleKey) : false);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <CompatibilityResultView
          selected={selected}
          compatibility={compatibility}
          selfName={displayName}
          partnerName={selectedFamily.label}
          selfBirthSummary={formatBirthSummary(data.profile)}
          partnerBirthSummary={formatBirthSummary(selectedFamily)}
          retakeHref={`/compatibility/input?relationship=${selected.slug}`}
          hasLoveQuestionPurchase={hasDeepReadingAccess}
          selfBirthInput={selfBirthInput}
          partnerBirthInput={partnerBirthInput}
          deepLlmEnabled={isCompatibilityInterpretationLLMEnabled()}
          compatibilityCoupleKey={coupleKey}
          perCouplePricingEnabled={isCompatibilityPerCouplePricingEnabled()}
        />

        {/* 친구에게 공유 — 2026-07-03 공개 스냅샷: 두 사람 생년을 slug 로 인코딩한
            /compatibility/share/[slug] 공개 뷰(로그인 불필요·결정론 재계산·familyId 미노출).
            수신자가 이 결과 그대로 열람. 본인 재방문용 redirectPath(로그인 next)는 별개 유지. */}
        {(() => {
          const shareSlug = buildCompatibilityShareSlug(
            selected.slug,
            selfBirthInput,
            partnerBirthInput
          );
          const shareNameQuery = new URLSearchParams({
            a: displayName,
            b: selectedFamily.label,
          }).toString();
          const sharePath = `/compatibility/share/${shareSlug}?${shareNameQuery}`;
          return (
            <section className="px-1">
              <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">친구에게 공유</h2>
              <ShareActions
                text={`${displayName} × ${selectedFamily.label} 궁합 — ${compatibility.label}`}
                url={getCanonicalUrl(sharePath)}
                className="mt-2.5"
                kakao={buildKakaoShare({
                  title: `${displayName} × ${selectedFamily.label} 궁합`,
                  description: compatibility.summary,
                  path: sharePath,
                  buttonTitle: '궁합 결과 보기',
                })}
              />
            </section>
          );
        })()}
      </AppPage>
    </AppShell>
  );
}
