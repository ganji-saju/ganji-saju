// Redesign 2026-05-14 (Claude Design / PR6+ 디자인 언어 통일):
// /my/profile — 가족 사주 + 내 기본 프로필 통합 관리 페이지.
// 외곽 hero / 요약 카드는 PR6+ 패턴 (pink-soft + ink-dark)으로 통일.
// 데이터 로딩·ProfileManager 폼 본체는 유지 — 라우팅·로직 무수정.
import Link from 'next/link';
import ProfileManager from '@/components/my/profile-manager';
import { getProfileSettingsData } from '@/lib/profile';

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
  const displayName = data.profile.displayName?.trim() || '이름 미입력';
  const familyCount = data.familyProfiles.length;

  return (
    <div className="space-y-5 px-1">
      {/* §1 Hero — pink-soft 카드 (페이지 정체성) */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          가족 사주
        </div>
        <h1
          className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          내 정보와 가족·연인을
          <br />
          한 곳에서 관리하세요
        </h1>
        <p
          className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          한 번 입력하면 오늘운세 · 사주 · 궁합에 자동으로 채워집니다. 가족·연인 정보를 함께 저장해
          궁합과 가족 리포트에서 바로 이어보세요.
        </p>
      </article>

      {/* §2 현재 저장값 요약 — 2칸 grid */}
      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
            내 기본 프로필
          </div>
          <div className="mt-1 truncate text-[15.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
            {displayName}
          </div>
          <div className="mt-1 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]">
            {formatBirthSummary(data.profile)}
          </div>
        </article>

        <article className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-soft)]">
            등록된 가족
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className="text-[22px] font-extrabold leading-none tracking-tight"
              style={{ color: 'var(--app-pink-strong)' }}
            >
              {familyCount}
            </span>
            <span className="text-[12px] font-bold text-[var(--app-copy-muted)]">명</span>
          </div>
          <div className="mt-1 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]">
            궁합 · 가족 리포트에서 바로 이어볼 수 있습니다.
          </div>
        </article>
      </section>

      {/* §3 빠른 이어가기 — ink-dark CTA */}
      <article
        className="rounded-[18px] p-5 text-white"
        style={{
          background: 'var(--app-ink)',
          boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
        }}
      >
        <div
          className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
          style={{ color: 'var(--app-pink)' }}
        >
          저장된 정보로 바로
        </div>
        <h2 className="mt-1.5 text-[16px] font-extrabold leading-snug tracking-tight">
          오늘운세 · 사주풀이 · 궁합 이어가기
        </h2>
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <Link
            href="/today-fortune"
            className="rounded-[12px] bg-white/10 px-2 py-3 text-center text-[12px] font-extrabold text-white"
          >
            오늘운세
          </Link>
          <Link
            href="/saju/new"
            className="rounded-[12px] bg-white/10 px-2 py-3 text-center text-[12px] font-extrabold text-white"
          >
            사주풀이
          </Link>
          <Link
            href="/compatibility/input"
            className="rounded-[12px] bg-white/10 px-2 py-3 text-center text-[12px] font-extrabold text-white"
          >
            궁합
          </Link>
        </div>
      </article>

      {/* §4 정보 수정 — ProfileManager 폼 본체 (디자인 통일을 위해 white surface 로 래핑) */}
      <section className="rounded-[18px] border border-[var(--app-line)] bg-white p-4 sm:p-5">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          수정
        </div>
        <h2 className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
          정보 수정하기
        </h2>
        <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy-muted)]">
          이름·생년월일·시간 룰을 바꾸면 다음 풀이부터 자동 반영됩니다.
        </p>

        <div className="mt-4">
          <ProfileManager
            initialProfile={data.profile}
            initialFamilyProfiles={data.familyProfiles}
          />
        </div>
      </section>
    </div>
  );
}
