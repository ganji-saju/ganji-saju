// 2026-05-16 — 대운 10년 단위 챕터 timeline strip.
// 사용자 보고: 현재 위치 카드가 화면 오른쪽 끝에 있어 보이지 않음.
// mount 후 현재 cycle 카드를 inline center 로 scrollIntoView 호출.
'use client';

import { useEffect, useRef } from 'react';
import type { LifetimeMajorLuckCycle } from '@/domain/saju/report/lifetime-types';
import { ganziToKorean } from '@/lib/saju/terminology';

interface Props {
  cycles: LifetimeMajorLuckCycle[];
}

const CARD_WIDTH = 82;

export function DaewoonTimelineStrip({ cycles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;

    // active 카드를 컨테이너 스크롤의 가운데로.
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const offset =
      activeRect.left -
      containerRect.left -
      containerRect.width / 2 +
      activeRect.width / 2;
    container.scrollBy({ left: offset, behavior: 'auto' });
  }, []);

  return (
    <div
      ref={containerRef}
      className="mt-3 flex gap-2 overflow-x-auto pb-2"
      style={{ scrollbarWidth: 'thin' }}
    >
      {cycles.map((cycle) => {
        const setRef = (el: HTMLElement | null) => {
          if (cycle.isCurrent) activeRef.current = el;
        };
        return (
          <article
            key={`${cycle.ganzi}-${cycle.ageLabel}`}
            ref={setRef}
            className={
              cycle.isCurrent
                ? 'shrink-0 rounded-[12px] px-3 py-2.5 text-center text-white'
                : 'shrink-0 rounded-[12px] border border-[var(--app-line)] bg-white px-3 py-2.5 text-center text-[var(--app-ink)]'
            }
            style={
              cycle.isCurrent
                ? {
                    width: CARD_WIDTH,
                    background: 'var(--app-pink)',
                    boxShadow: '0 8px 18px rgba(142,42,32,0.28)',
                  }
                : { width: CARD_WIDTH }
            }
          >
            <div
              className="text-[12.1px] font-bold"
              style={{ opacity: cycle.isCurrent ? 0.85 : 0.55 }}
            >
              {cycle.ageLabel}
            </div>
            <div
              className="mt-1 text-[18.4px] font-bold leading-none"
              style={{ fontFamily: 'var(--font-han)' }}
            >
              {cycle.ganzi}
            </div>
            <div
              className="mt-1 text-[11.5px] font-bold"
              style={{ opacity: cycle.isCurrent ? 0.95 : 0.7 }}
            >
              {ganziToKorean(cycle.ganzi)}
            </div>
            <div
              className="mt-1 text-[10.9px] font-extrabold uppercase tracking-[0.04em]"
              style={{ opacity: cycle.isCurrent ? 0.95 : 0.55 }}
            >
              {cycle.phase}
            </div>
          </article>
        );
      })}
    </div>
  );
}
