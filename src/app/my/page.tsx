// Redesign 2026-05-13 (Claude Design / screens-b.jsx ScreenMy):
// ink-dark 사용자 카드 (ZodiacChip + 이름/생일·띠·일주 + 코인/멤버십/보관) ·
// 바로가기 list · 최근 풀이 preview. PR6+ 디자인 언어 적용.
// 라우팅·데이터·이벤트 무수정.
import Link from 'next/link';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
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

// 바로가기 메뉴 - mockup §2 패턴 (정사각 icon + 라벨 + 부제)
const MY_MENU_ICONS: Record<string, { icon: string; tone: 'pink' | 'neutral' }> = {
  '내 사주 원국': { icon: '☰', tone: 'neutral' },
  '저장한 해석': { icon: '◐', tone: 'neutral' },
  '가족 사주': { icon: '♥', tone: 'pink' },
  '대화 플랜': { icon: '◆', tone: 'neutral' },
  '알림 센터': { icon: '⚙', tone: 'neutral' },
  '설정': { icon: '⚙', tone: 'neutral' },
  '문의': { icon: '?', tone: 'neutral' },
};

const RECENT_ZODIACS: ZodiacKey[] = ['rooster', 'rabbit', 'sheep', 'dragon'];

export default async function MyPage() {
  const dashboard = await getAccountDashboardData('/my', {
    readingLimit: 4,
    transactionLimit: 4,
  });

  const displayName = dashboard.user.email?.split('@')[0] ?? '회원';
  const mostRecentReading = dashboard.recentReadings[0];
  const planTitle = dashboard.subscription
    ? getSubscriptionPlanLabel(dashboard.subscription.plan)
    : '무료 플랜';
  const planSummary = dashboard.subscription
    ? `${getSubscriptionStatusLabel(dashboard.subscription.status)} · ${formatRenewalLabel(
        dashboard.subscription.renewsAt
      )}`
    : '아직 가입한 멤버십이 없습니다';

  // 사용자 hero 의 ZodiacChip — 최근 풀이가 있으면 그 생년의 띠, 아니면 dragon
  const userZodiac: ZodiacKey = 'dragon';

  return (
    <div className="space-y-5 px-1">
      {/* §1 User ink-dark card */}
      <article
        className="rounded-[18px] p-5 text-white"
        style={{
          background: 'var(--app-ink)',
          boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <ZodiacChip kind={userZodiac} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-extrabold tracking-tight">{displayName}님</div>
            <div className="mt-0.5 text-[12px]" style={{ opacity: 0.65 }}>
              {mostRecentReading
                ? formatBirthLabel(mostRecentReading)
                : '아직 저장된 사주가 없어요'}
            </div>
          </div>
          <Link
            href="/my/profile"
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/75"
          >
            편집
          </Link>
        </div>

        {/* 코인 / 멤버십 / 보관 풀이 — 3 column stats */}
        <div
          className="mt-4 grid grid-cols-3 gap-2 border-t pt-4"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <Link href="/credits" className="block">
            <div className="text-[10.5px]" style={{ opacity: 0.6 }}>
              코인 잔액
            </div>
            <div
              className="mt-0.5 text-[17px] font-extrabold"
              style={{ color: 'var(--app-pink)' }}
            >
              ✦ {dashboard.credits.total}
            </div>
          </Link>
          <Link href="/membership" className="block">
            <div className="text-[10.5px]" style={{ opacity: 0.6 }}>
              멤버십
            </div>
            <div className="mt-1 text-[13px] font-extrabold leading-tight text-white">
              {planTitle}
            </div>
          </Link>
          <Link href="/my/results" className="block">
            <div className="text-[10.5px]" style={{ opacity: 0.6 }}>
              보관 풀이
            </div>
            <div className="mt-0.5 text-[17px] font-extrabold text-white">
              {dashboard.readingCount}
            </div>
          </Link>
        </div>

        <p className="mt-3 text-[11.5px]" style={{ opacity: 0.55 }}>
          {planSummary}
        </p>
      </article>

      {/* §2 바로가기 list */}
      <section>
        <h2 className="px-1 text-[13px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
          바로가기
        </h2>
        <div className="mt-2 grid gap-2.5">
          {MY_MENU_BLUEPRINT.map((item) => {
            const meta = MY_MENU_ICONS[item.title] ?? { icon: '›', tone: 'neutral' as const };
            const isPink = meta.tone === 'pink';
            return (
              <Link
                key={item.title}
                href={item.href}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
              >
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[16px] font-bold"
                  style={
                    isPink
                      ? {
                          background: 'var(--app-pink-soft)',
                          color: 'var(--app-pink-strong)',
                          border: '1px solid var(--app-pink-line)',
                        }
                      : {
                          background: 'rgba(0,0,0,0.04)',
                          color: 'var(--app-ink)',
                        }
                  }
                  aria-hidden="true"
                >
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
                    {item.description}
                  </div>
                </div>
                <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
                  ›
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* §3 최근 풀이 preview */}
      <section>
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[16px] font-extrabold text-[var(--app-ink)]">최근 풀이</h2>
          <Link
            href="/my/results"
            className="text-[12px] font-extrabold text-[var(--app-pink-strong)]"
          >
            전체 →
          </Link>
        </div>
        <div className="mt-3 grid gap-2.5">
          {dashboard.recentReadings.length > 0 ? (
            dashboard.recentReadings.map((reading, index) => (
              <Link
                key={reading.id}
                href={`/saju/${reading.id}`}
                className="flex items-center gap-3 rounded-[14px] border border-[var(--app-line)] bg-white p-3"
              >
                <ZodiacChip
                  kind={RECENT_ZODIACS[index % RECENT_ZODIACS.length]}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-[var(--app-copy-soft)]">
                    {formatBirthLabel(reading)}
                  </div>
                  <div className="mt-0.5 text-[13.5px] font-extrabold text-[var(--app-ink)]">
                    {reading.dayPillarLabel
                      ? `${reading.dayPillarLabel} · 다시 보기`
                      : '다시 보기'}
                  </div>
                </div>
                <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))
          ) : (
            <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">아직 없음</div>
              <p className="mt-1 text-[13px] leading-[1.55] text-[var(--app-ink)]">
                저장된 풀이가 없습니다. 사주를 본 뒤 MY에서 다시 확인할 수 있어요.
              </p>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
