// 2026-08-25 전면 개편 Phase 2 — 수호신 배정 카드.
//   "내 띠의 수호신이 읽어주는 사주"(guardian-characters-spec.md 콘셉트)의 첫 표면.
//   사주 결과 최상단에서 "이 풀이는 당신의 띠 수호신이 함께 봅니다"를 보여준다 —
//   순수 표시 컴포넌트(server), 배정은 src/lib/guardians.ts 가 담당.

import type { GuardianProfile } from '@/lib/guardians';

export function GuardianAssignmentCard({
  guardian,
  viewerName,
}: {
  guardian: GuardianProfile;
  viewerName: string;
}) {
  return (
    <article
      aria-label="배정된 수호신"
      className="flex items-center gap-4 overflow-hidden rounded-[18px] border border-[var(--app-line)] p-4"
      style={{ background: '#efe8d8' }}
    >
      {/* 캐릭터 초상 — 4:5 원본의 상단(얼굴+인장)만 원형 크롭. */}
      <img
        src={guardian.image}
        alt={`${guardian.animalKo} 수호신`}
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        className="h-16 w-16 shrink-0 rounded-full border border-[rgba(28,26,23,0.14)] object-cover object-top bg-white"
      />
      <div className="min-w-0">
        <p className="m-0 text-[12.6px] font-extrabold uppercase tracking-[0.05em] text-[var(--app-pink-strong)]">
          {viewerName}님의 수호신
        </p>
        <p className="m-0 mt-0.5 text-[17.3px] font-extrabold leading-snug text-[var(--app-ink)]">
          {guardian.han} · {guardian.animalKo} 수호신
        </p>
        <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-[var(--app-copy-soft)]">
          {guardian.persona}
        </p>
      </div>
    </article>
  );
}
