// 2026-05-21 — 평생 활용 핵심 3카드. saju-total-review-llm-spec.md §9-2.
//   카드별 색: 강한 환경=그린 / 약한 자리=오렌지 / 핵심 활용법=핑크. 빈 배열이면 렌더 생략.
import type { TotalReviewLifetimeKey } from '@/server/ai/total-review/total-review-types';

const CARD_ACCENTS: ReadonlyArray<{ bg: string; border: string; title: string }> = [
  { bg: '#f1f7f0', border: '#d6e7d2', title: '#3f7a45' }, // 강한 환경 — 그린
  { bg: '#fdf4ea', border: '#f0ddc5', title: '#b5722a' }, // 약한 자리 — 오렌지
  { bg: 'var(--app-pink-soft)', border: 'var(--app-pink-line)', title: 'var(--app-pink-strong)' }, // 핵심 활용법 — 핑크
];

export function SajuLifetimeKeysSection({
  keys,
}: {
  keys: TotalReviewLifetimeKey[];
}) {
  if (!keys || keys.length === 0) return null;

  return (
    <section>
      <div className="mb-2.5 text-[16px] font-extrabold text-[var(--app-ink)]">
        평생 활용 핵심 3가지
      </div>
      <div className="space-y-2.5">
        {keys.map((card, i) => {
          const accent = CARD_ACCENTS[i] ?? CARD_ACCENTS[CARD_ACCENTS.length - 1];
          return (
            <article
              key={`${card.title}-${i}`}
              className="rounded-[16px] border p-4"
              style={{ background: accent.bg, borderColor: accent.border }}
            >
              <div
                className="text-[15px] font-extrabold tracking-tight"
                style={{ color: accent.title, wordBreak: 'keep-all' }}
              >
                {card.title}
              </div>
              {card.subtitle ? (
                <div className="mt-0.5 text-[12px] font-medium text-[var(--app-copy-muted)]">
                  {card.subtitle}
                </div>
              ) : null}
              {card.body ? (
                <p
                  className="mt-2 text-[13px] leading-[1.7] text-[var(--app-copy)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {card.body}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
