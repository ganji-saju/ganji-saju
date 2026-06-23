// 2026-05-16 PR #181 — 사주 메인/상세 페이지에서 공유하는 6 영역 카드 섹션.
//
// 사용자 보고: "총운 직장운 재물운 연애운 관계운 컨디션 6 항목을 모든 페이지에 동일하게".
//   페이지마다 다른 카드 수/라벨/순서 → 한 컴포넌트로 통일.
//
// score 산식: computeSajuAreaScores (운세 페이지와 1:1 일치 + 6 영역 통일).
import type { BirthInput } from '@/lib/saju/types';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import {
  computeSajuAreaScores,
  UNIFIED_AREA_LABELS,
  UNIFIED_AREA_COLORS,
  UNIFIED_AREA_ORDER,
} from '@/lib/today-fortune/compute-saju-area-scores';

function getScoreStatus(score: number) {
  if (score >= 75) return '좋음';
  if (score >= 60) return '무난';
  if (score >= 45) return '점검';
  return '천천히';
}

interface Props {
  input: BirthInput;
  sajuData: SajuDataV1 | SajuDataV2;
  heading?: string;
}

export function SajuAreaCardsSection({ input, sajuData, heading = '오늘의 분야별 흐름' }: Props) {
  const scores = computeSajuAreaScores(input, sajuData);
  const ordered = UNIFIED_AREA_ORDER.map((key) => {
    const score = scores.find((s) => s.key === key);
    return {
      key,
      label: UNIFIED_AREA_LABELS[key],
      color: UNIFIED_AREA_COLORS[key],
      score: score?.score ?? 0,
    };
  });
  const overall = ordered.find((s) => s.key === 'overall')?.score ?? 0;

  return (
    <section>
      <h2 className="mb-3 text-[18.4px] font-extrabold text-[var(--app-ink)]">{heading}</h2>
      <div className="grid gap-2.5">
        {ordered.map((item) => {
          const value = Math.max(0, Math.min(100, Math.round(item.score)));
          return (
            <article
              key={item.key}
              className="rounded-[14px] border border-[var(--app-line)] bg-white p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[16.1px] font-bold text-[var(--app-ink)]">{item.label}</span>
                <span
                  className="text-[20.7px] font-extrabold tracking-tighter"
                  style={{ color: item.color }}
                >
                  {value}
                </span>
              </div>
              <div
                className="relative mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--app-line)' }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${value}%`, background: item.color }}
                />
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-2 text-[15px] leading-5 text-[var(--app-copy-soft)]">
        오늘 점수 {overall}점 · {getScoreStatus(overall)} · 총운
      </p>
    </section>
  );
}
