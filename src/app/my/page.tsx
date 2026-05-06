import Link from 'next/link';
import {
  GangiCharacter,
  GangiIntro,
  GangiMiniCard,
  type GangiZodiacKey,
} from '@/components/gangi/gangi-ui';
import { MY_MENU_BLUEPRINT } from '@/content/moonlight';
import { getAccountDashboardData } from '@/lib/account';
import {
  getSubscriptionPlanLabel,
  getSubscriptionStatusLabel,
} from '@/lib/subscription';

function formatBirthLabel(reading: {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number | null;
  gender: 'male' | 'female' | null;
}) {
  const hourLabel = reading.birthHour === null ? '시간 미입력' : `${reading.birthHour}시`;
  const genderLabel =
    reading.gender === 'male' ? '남성' : reading.gender === 'female' ? '여성' : '성별 미선택';
  return `${reading.birthYear}.${reading.birthMonth}.${reading.birthDay} · ${hourLabel} · ${genderLabel}`;
}

function formatRenewalLabel(value: string | null) {
  if (!value) return '갱신일 미정';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

const MENU_ZODIAC: Record<string, GangiZodiacKey> = {
  '내 사주 원국': 'dragon',
  '저장한 해석': 'pig',
  '가족 사주': 'sheep',
  '프리미엄 플랜': 'rooster',
  '알림 센터': 'rabbit',
  '설정': 'ox',
  '문의': 'rat',
};

export default async function MyPage() {
  const dashboard = await getAccountDashboardData('/my', {
    readingLimit: 4,
    transactionLimit: 4,
  });

  const mostRecentReading = dashboard.recentReadings[0];
  const displayName = dashboard.user.email?.split('@')[0] ?? '회원';
  const planTitle = dashboard.subscription
    ? getSubscriptionPlanLabel(dashboard.subscription.plan)
    : '무료 이용 중';
  const planSummary = dashboard.subscription
    ? `${getSubscriptionStatusLabel(dashboard.subscription.status)} · ${formatRenewalLabel(
        dashboard.subscription.renewsAt
      )}`
    : '아직 가입한 멤버십이 없습니다';

  return (
    <div className="space-y-5">
      <GangiIntro
        eyebrow="MY"
        title={
          <>
            내 운세와 결제,
            <br />
            여기서 이어봐요
          </>
        }
        description="저장한 풀이, 남은 코인, 플랜 상태를 한 화면에서 확인합니다."
      />

      <section className="px-4 sm:px-0">
        <div className="gangi-pink-panel p-4">
          <div className="flex items-center gap-4">
            <GangiCharacter zodiac="dragon" size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-black text-[var(--app-pink-strong)]">{displayName}</p>
              <h2 className="mt-1 text-xl font-black leading-7 text-[var(--app-ink)]">
                {mostRecentReading ? '최근 풀이를 바로 이어볼 수 있어요' : '첫 풀이를 저장해 보세요'}
              </h2>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--app-copy-muted)]">
                {mostRecentReading
                  ? formatBirthLabel(mostRecentReading)
                  : '사주를 한 번 보면 MY에 다시 열 수 있게 정리됩니다.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <GangiMiniCard
              label="저장"
              title={`${dashboard.readingCount}개`}
              desc="다시 보기"
            />
            <GangiMiniCard
              label="코인"
              title={`${dashboard.credits.total}개`}
              desc={`기본 ${dashboard.credits.balance} · 멤버십 ${dashboard.credits.subscriptionBalance}`}
            />
            <GangiMiniCard label="플랜" title={planTitle} desc={planSummary} />
          </div>

          <div className="mt-4 grid gap-2">
            <Link href="/my/results" className="gangi-primary-button">
              저장한 풀이 보기
            </Link>
            <Link href="/my/profile" className="gangi-secondary-button">
              내 정보 관리
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-0">
        <div className="gangi-card-panel p-4">
          <p className="gangi-sub-eyebrow mb-3">바로가기</p>
          <div className="grid gap-2">
            {MY_MENU_BLUEPRINT.map((item) => (
              <Link key={item.title} href={item.href} className="gangi-vault-link">
                <GangiCharacter zodiac={MENU_ZODIAC[item.title] ?? 'pig'} size="sm" />
                <span>
                  <strong>{item.title}</strong>
                  <em>{item.description}</em>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 sm:px-0">
        <div className="gangi-card-panel p-4">
          <p className="gangi-sub-eyebrow mb-3">최근 저장한 풀이</p>
          {dashboard.recentReadings.length > 0 ? (
            <div className="grid gap-2">
              {dashboard.recentReadings.map((reading) => (
                <Link key={reading.id} href={`/saju/${reading.id}`} className="gangi-vault-link">
                  <GangiCharacter zodiac="dragon" size="sm" />
                  <span>
                    <strong>{formatBirthLabel(reading)}</strong>
                    <em>{reading.dayPillarLabel ? `${reading.dayPillarLabel} · 다시 보기` : '다시 보기'}</em>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <GangiMiniCard
              label="아직 없음"
              title="저장된 풀이가 없습니다"
              desc="사주를 본 뒤 MY에서 다시 확인할 수 있습니다."
            />
          )}
        </div>
      </section>
    </div>
  );
}
