// 2026-05-22 — Phase 2+3 스펙 §8: 5요소 점수 산출 내역.
// 2026-06-07 — per-factor LockGate 제거. 점수 전체가 상위 ScoreLockGate(score-total 550원)로
//   단일 게이팅되므로, 이 카드는 해제 상태에서만 렌더되어 5요소를 전부 노출한다.
'use client';

import { useEffect, useState } from 'react';
import type { SajuScore } from '@/lib/saju-score';
import { getScoreColorClasses } from '@/lib/saju-score';

type FactorId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

interface ScoreBreakdownCardProps {
  score: SajuScore;
  className?: string;
}

const FACTOR_META: Array<{
  id: FactorId;
  emoji: string;
  title: string;
  subtitle: string;
}> = [
  { id: 'F1', emoji: '①', title: '일주 본질', subtitle: '타고난 성향의 안정도' },
  { id: 'F2', emoji: '②', title: '격국 작동도', subtitle: '사회적 역할의 명확성' },
  { id: 'F3', emoji: '③', title: '용신·기신 균형', subtitle: '보강 흐름의 작동' },
  { id: 'F4', emoji: '④', title: '오행 균형', subtitle: '다섯 기운의 균형' },
  { id: 'F5', emoji: '⑤', title: '합충·신살', subtitle: '관계와 작용의 부드러움' },
];

export function ScoreBreakdownCard({ score, className = '' }: ScoreBreakdownCardProps) {
  const colors = getScoreColorClasses(score.label.level);
  // 마운트 후 바 채움(animate-bar-fill 미등록 → 인라인 width + transition).
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <p className="mb-0.5 text-[15px] text-gray-400">왜 이 점수가 나왔는지</p>
          <h3 className="text-base font-bold text-gray-900">📊 점수 산출 내역</h3>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${colors.text}`}>{score.total}</span>
          <div className={`mt-0.5 text-[15px] font-medium ${colors.text}`}>{score.label.title}</div>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {FACTOR_META.map((meta) => {
          const factorScore = Math.round(score.breakdown[meta.id]);
          const barWidth = Math.max(0, Math.min(100, (factorScore / 20) * 100));
          return (
            <div key={meta.id} className="px-5 py-4">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">{meta.emoji}</span>
                  <span className="text-sm font-semibold text-gray-900">{meta.title}</span>
                </div>
                <span className={`text-sm font-bold ${colors.text}`}>+{factorScore}점</span>
              </div>
              <p className="mb-2 pl-6 text-[15px] text-gray-500">{meta.subtitle}</p>
              <div className="flex items-center gap-3 pl-6">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${colors.bg} transition-[width] duration-700 ease-out`}
                    style={{ width: `${filled ? barWidth : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-4">
        <span className="text-sm font-semibold text-gray-700">합계</span>
        <span className={`text-xl font-bold ${colors.text}`}>{score.total}점</span>
      </div>
    </div>
  );
}
