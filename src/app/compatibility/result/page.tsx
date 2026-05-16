import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiIntro, GangiMiniCard, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import { CompatibilityResultView } from '@/features/compatibility/compatibility-result-view';
import { ManualCompatibilityResultClient } from '@/features/compatibility/manual-compatibility-result-client';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
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
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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
    description: '두 사람의 명식을 비교해 관계의 결을 읽는 궁합 결과 화면입니다.',
  };
}

export default async function CompatibilityResultPage({ searchParams }: Props) {
  const { relationship, familyId, source, paid } = await searchParams;

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
        hasLoveQuestionPurchase={paid === 'love-question' || manualLoveEntitlement}
      />
    );
  }

  const selectedRelationship = relationship
    ? COMPATIBILITY_RELATIONSHIPS.find((item) => item.slug === relationship)?.slug
    : undefined;
  const redirectPath = `/compatibility/result${relationship || familyId ? `?${new URLSearchParams({ ...(relationship ? { relationship } : {}), ...(familyId ? { familyId } : {}) }).toString()}` : ''}`;
  const data = await getProfileSettingsData(redirectPath);
  const hasLoveQuestionPurchase =
    paid === 'love-question' ||
    (data.user.id
      ? Boolean(await getTasteProductEntitlement(data.user.id, 'love-question'))
      : false);
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

  const compatibility = buildCompatibilityInterpretation(
    selected.slug,
    {
      name: displayName,
      birthInput: toBirthInputFromProfile(data.profile),
    },
    {
      name: selectedFamily.label,
      birthInput: toBirthInputFromProfile(selectedFamily),
    }
  );

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
          hasLoveQuestionPurchase={hasLoveQuestionPurchase}
        />
      </AppPage>
    </AppShell>
  );
}
