import { Badge } from '@/components/ui/badge';
import ProfileManager from '@/components/my/profile-manager';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { getProfileSettingsData } from '@/lib/profile';
import { PageHero } from '@/shared/layout/app-shell';

function formatBirthSummary(profile: {
  calendarType: 'solar' | 'lunar';
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  birthMinute: number | null;
  birthLocationLabel?: string;
}) {
  if (!profile.birthYear || !profile.birthMonth || !profile.birthDay) {
    return '생년월일을 아직 입력하지 않았습니다.';
  }

  const calendarLabel = profile.calendarType === 'lunar' ? '음력' : '양력';
  const hourLabel =
    profile.birthHour === null
      ? '시간 미입력'
      : `${profile.birthHour}시${
          profile.birthMinute === null
            ? ''
            : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const locationLabel = profile.birthLocationLabel ? ` · ${profile.birthLocationLabel}` : '';
  const timeRuleLabel =
    profile.timeRule === 'trueSolarTime'
      ? ' · 진태양시'
      : profile.timeRule === 'nightZi'
        ? ' · 야자시'
        : profile.timeRule === 'earlyZi'
          ? ' · 조자시'
          : '';

  return `${calendarLabel} ${profile.birthYear}.${profile.birthMonth}.${profile.birthDay} · ${hourLabel}${locationLabel}${timeRuleLabel}`;
}

export default async function MyProfilePage() {
  const data = await getProfileSettingsData('/my/profile');

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          <Badge
            key="family"
            className="border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 text-[var(--app-jade)]"
          >
            가족 사주
          </Badge>,
          <Badge
            key="shared"
            className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
          >
            오늘운세 · 사주 시작하기 · 궁합 공통 입력
          </Badge>,
        ]}
        title="내 정보와 가족 정보"
      />

      <section className="grid gap-6">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="저장 정보"
            title="현재 저장된 정보"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={2} className="mt-6">
            <FeatureCard
              surface="soft"
              eyebrow="내 기본 프로필"
              title={data.profile.displayName || '이름 미입력'}
              description={formatBirthSummary(data.profile)}
            />
            <FeatureCard
              surface="soft"
              eyebrow="등록된 가족 수"
              title={data.familyProfiles.length}
              description="궁합과 가족 리포트에서 바로 이어볼 수 있습니다."
            />
          </ProductGrid>
        </SectionSurface>
      </section>

      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="수정"
          title="정보 수정하기"
          titleClassName="text-3xl"
        />

        <div className="mt-6">
          <ProfileManager
            initialProfile={data.profile}
            initialFamilyProfiles={data.familyProfiles}
          />
        </div>
      </SectionSurface>
    </div>
  );
}
