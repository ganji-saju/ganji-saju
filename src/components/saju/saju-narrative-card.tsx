// 2026-05-15 P2 — narrative 카드. buildSajuNarrative 출력 표시.
// 결과 페이지에서 일주 캐릭터 카드(P0) 다음, 4 pillars 표 이전 위치에 마운트.
// 일간 → 격국 → 용신 → 대운/세운 → 행동을 한 호흡 단락으로 사용자에게 전달.

import type { SajuNarrative } from '@/domain/saju/report/build-narrative';

export function SajuNarrativeCard({ narrative }: { narrative: SajuNarrative }) {
  if (!narrative.headline && !narrative.body) return null;

  return (
    <article
      className="rounded-[18px] border p-5"
      style={{
        background: 'linear-gradient(180deg, #fff 0%, #fbf7f1 100%)',
        borderColor: 'var(--app-line)',
      }}
    >
      <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        한 단락으로 정리
      </div>

      {narrative.headline ? (
        <h2
          className="mt-2 text-[20.7px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {narrative.headline}
        </h2>
      ) : null}

      {narrative.body ? (
        <p
          className="mt-3 text-[15.5px] leading-[1.75] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {narrative.body}
        </p>
      ) : null}

      {narrative.chips.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {narrative.chips.map((chip) => (
            <li
              key={`${chip.label}-${chip.value}`}
              className="rounded-full border px-2.5 py-1 text-[15px] font-bold"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
                color: 'var(--app-pink-strong)',
              }}
            >
              <span className="opacity-75">{chip.label}</span>
              <span className="ml-1">{chip.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
