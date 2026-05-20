// 2026-05-21 — 총평 LLM 4단락 narrative 카드. saju-total-review-llm-spec.md §9-2.
//   한 줄 요약 + 의미별 라벨 4단락(당신은 어떤 사람인가 / 잘 살아나는 환경 / 조심할 자리 /
//   지금 시기 핵심). SajuNarrativeCard 스타일 토큰 재사용. 빈 단락은 렌더 생략.
import type { TotalReviewNarrative } from '@/server/ai/total-review/total-review-types';

const PARAGRAPH_LABELS: ReadonlyArray<{ key: keyof TotalReviewNarrative; label: string }> = [
  { key: 'paragraph_1_who_you_are', label: '당신은 어떤 사람인가' },
  { key: 'paragraph_2_strong_environment', label: '잘 살아나는 환경' },
  { key: 'paragraph_3_weak_zone', label: '조심할 자리' },
  { key: 'paragraph_4_now', label: '지금 시기 핵심' },
];

export function SajuTotalReviewNarrative({
  summary,
  narrative,
}: {
  summary: string;
  narrative: TotalReviewNarrative;
}) {
  const paragraphs = PARAGRAPH_LABELS.filter(({ key }) => narrative[key]?.trim());
  if (!summary && paragraphs.length === 0) return null;

  return (
    <article
      className="rounded-[18px] border p-5"
      style={{
        background: 'linear-gradient(180deg, #fff 0%, #fbf7f1 100%)',
        borderColor: 'var(--app-line)',
      }}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        평생 총평
      </div>

      {summary ? (
        <h2
          className="mt-2 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {summary}
        </h2>
      ) : null}

      <div className="mt-4 space-y-4">
        {paragraphs.map(({ key, label }) => (
          <section key={key}>
            <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">
              {label}
            </div>
            <p
              className="mt-1.5 text-[13.5px] leading-[1.75] text-[var(--app-copy)]"
              style={{ wordBreak: 'keep-all', whiteSpace: 'pre-line' }}
            >
              {narrative[key]}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
