// 2026-05-15 P2 후속: 합충·공망·신살 노출 카드.
// audit 진단 결과 산출은 되지만 결과 페이지 노출이 약했던 도메인 항목 3종:
//   - relations(합·충): 인간 관계 / 이동 신호
//   - gongmang(공망): 비어 보이는 부분
//   - specialSals(신살): 함께 볼 부분 (귀인·역마·도화 등)
// 카드는 우선순위 따라 슬라이스해서 노출 — 너무 많으면 사용자에게 부담.

import type { SajuInterpretationGrounding } from '@/domain/saju/report';
import { simplifySajuCopy } from '@/lib/saju/public-copy';

interface SajuRelationsSymbolsCardProps {
  grounding: SajuInterpretationGrounding;
}

export function SajuRelationsSymbolsCard({ grounding }: SajuRelationsSymbolsCardProps) {
  const relations = grounding.evidenceJson.relations.relations ?? [];
  const gongmang = grounding.evidenceJson.relations.gongmang ?? [];
  const specialSals = grounding.evidenceJson.relations.specialSals ?? [];

  // 모두 비어있으면 카드 자체 렌더하지 않음.
  if (relations.length === 0 && gongmang.length === 0 && specialSals.length === 0) {
    return null;
  }

  return (
    <article
      className="rounded-[18px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        관계·신살 신호
      </div>
      <h3
        className="mt-1 text-[15px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
        style={{ wordBreak: 'keep-all' }}
      >
        사람·선택·타이밍에서 함께 볼 부분
      </h3>

      <div className="mt-3 grid gap-2.5">
        {relations.length > 0 ? (
          <Row
            label="합·충"
            items={relations.slice(0, 4)}
            tone="pink"
            hint="관계와 이동에서 묶이거나 부딪히는 신호"
          />
        ) : null}
        {gongmang.length > 0 ? (
          <Row
            label="공망"
            items={gongmang}
            tone="indigo"
            hint="비어 보이는 영역 — 노력 대비 효과가 약한 자리"
          />
        ) : null}
        {specialSals.length > 0 ? (
          <Row
            label="신살"
            items={specialSals.slice(0, 6)}
            tone="amber"
            hint="강하게 작용하는 명리 부속 신호 (귀인·역마·도화 등)"
          />
        ) : null}
      </div>

      <p
        className="mt-3 text-[11px] leading-[1.55] text-[var(--app-copy-soft)]"
        style={{ wordBreak: 'keep-all' }}
      >
        이 신호들은 풀이 본문의 보조 근거로 쓰이며 단독 해석은 피하는 편이 좋습니다.
      </p>
    </article>
  );
}

function Row({
  label,
  items,
  tone,
  hint,
}: {
  label: string;
  items: string[];
  tone: 'pink' | 'indigo' | 'amber';
  hint: string;
}) {
  const palette = {
    pink: {
      bg: 'var(--app-pink-soft)',
      border: 'var(--app-pink-line)',
      label: 'var(--app-pink-strong)',
    },
    indigo: {
      bg: '#eef0f8',
      border: 'rgba(82, 102, 162, 0.22)',
      label: 'var(--app-indigo)',
    },
    amber: {
      bg: '#fff6e3',
      border: 'rgba(212, 148, 38, 0.22)',
      label: 'var(--app-amber)',
    },
  }[tone];

  return (
    <div
      className="rounded-[12px] border p-3"
      style={{ background: palette.bg, borderColor: palette.border }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-extrabold uppercase tracking-[0.06em]"
          style={{ color: palette.label }}
        >
          {label}
        </span>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full border bg-white px-2.5 py-1 text-[11.5px] font-bold text-[var(--app-ink)]"
            style={{ borderColor: palette.border }}
          >
            {simplifySajuCopy(item)}
          </li>
        ))}
      </ul>
      <p
        className="mt-1.5 text-[11px] leading-[1.5] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {hint}
      </p>
    </div>
  );
}
