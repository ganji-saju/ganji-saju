'use client';

// 2026-10-11 — 꿈해몽 상황 선택(A안). 기분·결말·함께한 사람을 고르면 내 꿈에 맞춘 해석 문단을 보여 준다.
//   화면 안에서만 계산 — AI 비용·하루 검색 횟수를 쓰지 않는다.
import { useState } from 'react';
import type { DreamMeaning } from '@/lib/dream-dictionary';
import {
  buildDreamPersonalReading,
  DREAM_COMPANIONS,
  DREAM_ENDINGS,
  DREAM_FEELINGS,
  type DreamSituation,
} from '@/lib/dream/dream-personalize';

const GROUPS = [
  { key: 'feeling', title: '꿈속 기분', options: DREAM_FEELINGS },
  { key: 'ending', title: '꿈의 결말', options: DREAM_ENDINGS },
  { key: 'companion', title: '함께한 사람', options: DREAM_COMPANIONS },
] as const;

export function DreamSituationPicker({ meaning }: { meaning: Pick<DreamMeaning, 'keyword' | 'category' | 'fortune'> }) {
  const [situation, setSituation] = useState<DreamSituation>({});
  const lines = buildDreamPersonalReading(meaning, situation);

  return (
    <article className="mt-3 rounded-[12px] border bg-white p-3" style={{ borderColor: 'var(--app-pink-line)' }}>
      <div className="text-[13.2px] font-extrabold tracking-[0.04em] text-[var(--app-pink-strong)]">내 꿈에 맞춰 보기</div>
      <p className="mt-1 text-[12.6px] text-[var(--app-copy-muted)]">기억나는 것만 골라 주세요. 고를수록 해석이 내 꿈에 가까워집니다.</p>
      {GROUPS.map((group) => (
        <div key={group.key} className="mt-2.5" role="group" aria-label={group.title}>
          <div className="text-[12.6px] font-extrabold text-[var(--app-ink)]">{group.title}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {group.options.map((option) => {
              const selected = situation[group.key] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSituation((current) => ({ ...current, [group.key]: selected ? undefined : option.id }))}
                  className="min-h-[36px] rounded-full border px-3 py-1.5 text-[13.2px] font-bold"
                  style={selected
                    ? { background: 'var(--app-pink)', borderColor: 'var(--app-pink)', color: '#fff' }
                    : { background: '#fff', borderColor: 'var(--app-line)', color: 'var(--app-ink)' }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {lines.length ? (
        <div className="mt-3 space-y-1.5 rounded-[10px] p-3" style={{ background: 'var(--app-pink-soft)' }} aria-live="polite">
          {lines.map((line) => <p key={line} className="text-[14.4px] leading-[1.65] text-[var(--app-ink)]">{line}</p>)}
        </div>
      ) : null}
    </article>
  );
}
