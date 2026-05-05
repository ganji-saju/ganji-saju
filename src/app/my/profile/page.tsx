import { Badge } from '@/components/ui/badge';
import ProfileManager from '@/components/my/profile-manager';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { FAMILY_PLAN_LIMITS } from '@/content/moonlight';
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
        title="내 정보와 가족 정보를 같은 기준으로 보관하세요"
        description="양력·음력, 시간 모름, 출생지, 시각 규칙을 한 번 정리해두면 오늘운세와 사주 시작하기, 궁합 흐름이 같은 기준으로 이어집니다."
      />

      <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="현재 저장 기준"
            title="프로필과 가족 정보는 같은 문법으로 이어집니다"
            titleClassName="text-3xl"
            description="입력 기준이 흔들리면 오늘운세, 궁합, 가족 리포트가 서로 다르게 보일 수 있습니다. 그래서 이 화면에서는 기준을 먼저 고정합니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
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
            <FeatureCard
              surface="soft"
              eyebrow="저장 기준"
              description="양력·음력, 시간 모름, 진태양시·야자시·조자시, 출생지와 위도·경도까지 함께 보관합니다."
            />
          </ProductGrid>
        </SectionSurface>

        <SupportRail
          surface="panel"
          eyebrow="이 정보로 이어지는 곳"
          title="한 번 저장해두면 같은 입력 기준으로 이어집니다"
          description="매번 다시 입력하지 않고, 저장된 정보를 여러 서비스가 같은 기준 위에서 이어받도록 정리했습니다."
        >
          <BulletList
            items={[
              '오늘운세에서 MY 프로필 불러오기',
              '사주 시작하기에서 같은 출생정보 이어받기',
              '궁합에서 가족·연인 정보를 바로 선택하기',
            ]}
          />
          <FeatureCard
            className="mt-5"
            surface="soft"
            eyebrow="플랜별 저장 범위"
            description={
              <BulletList
                items={FAMILY_PLAN_LIMITS}
                className="mt-0"
                itemClassName="text-[var(--app-copy)]"
              />
            }
          />
        </SupportRail>
      </section>

      <SectionSurface surface="panel" size="lg">
        <SectionHeader
          eyebrow="정보 관리"
          title="이제 실제 프로필을 수정하고 저장합니다"
          titleClassName="text-3xl"
          description="저장한 가족 프로필은 궁합과 비교 해석에서 쓰는 기준 정보입니다. 생일 형식과 시간 기준을 정확히 남겨둘수록 다시 볼 때 덜 헷갈립니다."
          descriptionClassName="max-w-3xl text-[var(--app-copy)]"
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
