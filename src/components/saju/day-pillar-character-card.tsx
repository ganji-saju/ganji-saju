// 2026-05-15: 5명 사용자 부정 피드백 P0 대응.
// 한국 사주 사이트 7단 결과 페이지 구조에서 "내 얘기다" 첫 동의가 거의 항상 나오는
// 자리는 일주론(60갑자 캐릭터). 우리는 grounding.personalizationContext.sixtyGapja
// 데이터가 이미 산출되는데 UI 노출이 약했음. 이 컴포넌트로 결과 페이지 상단에 고정.

import type { SixtyGapjaCoreProfile } from '@/domain/saju/report/personalization-context';

interface DayPillarCharacterCardProps {
  /** sixtyGapja 미산출(시간 미상 등) 시 null 가능. null 이면 fallback 카드. */
  profile: SixtyGapjaCoreProfile | null;
  /** 일주 ganzi 한자 (예: "甲子"). profile 이 null 일 때 fallback 으로 표시. */
  dayGanziHanja: string;
  /** 일주 ganzi 한글 (예: "갑자"). profile.code 와 동일하지만 fallback 처리용. */
  dayGanziKorean: string;
}

export function DayPillarCharacterCard({
  profile,
  dayGanziHanja,
  dayGanziKorean,
}: DayPillarCharacterCardProps) {
  return (
    <article
      className="rounded-[18px] border p-5"
      style={{
        background: 'linear-gradient(135deg, #fefcf8 0%, #fff5ec 100%)',
        borderColor: 'var(--app-pink-line)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          나의 일주
        </div>
        <div
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
          style={{
            background: 'var(--app-pink-soft)',
            color: 'var(--app-pink-strong)',
            border: '1px solid var(--app-pink-line)',
          }}
        >
          {dayGanziKorean}일주
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-[16px] text-white"
          style={{
            background: 'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
            fontFamily: 'var(--font-han)',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '0.04em',
            boxShadow: '0 10px 22px rgba(216,27,114,0.28)',
          }}
          aria-hidden="true"
        >
          {dayGanziHanja}
        </div>
        <div className="min-w-0 flex-1">
          {profile ? (
            <>
              <div className="text-[12.5px] font-bold text-[var(--app-pink-strong)]">
                {profile.title}
              </div>
              <h3
                className="mt-1 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {profile.core}
              </h3>
            </>
          ) : (
            <>
              <div className="text-[12.5px] font-bold text-[var(--app-pink-strong)]">
                {dayGanziKorean}일주
              </div>
              <h3
                className="mt-1 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                일주가 알려주는 나의 결을 함께 보세요.
              </h3>
            </>
          )}
        </div>
      </div>

      {profile ? (
        <div className="mt-4 grid gap-2.5">
          {profile.strengths.length > 0 ? (
            <div
              className="rounded-[12px] border bg-white p-3"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                강점
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.strengths.map((strength) => (
                  <li
                    key={strength}
                    className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold text-[var(--app-ink)]"
                    style={{
                      background: 'var(--app-pink-soft)',
                      borderColor: 'var(--app-pink-line)',
                    }}
                  >
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {profile.watchPoints.length > 0 ? (
            <div
              className="rounded-[12px] border bg-white p-3"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber)]">
                주의 포인트
              </div>
              <ul className="mt-1.5 grid gap-1">
                {profile.watchPoints.map((point) => (
                  <li
                    key={point}
                    className="text-[12.5px] leading-[1.55] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    · {point}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {profile.actionCue ? (
            <div
              className="rounded-[12px] border p-3"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                지금 핵심
              </div>
              <p
                className="mt-1 text-[13px] font-bold leading-[1.55] text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {profile.actionCue}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
