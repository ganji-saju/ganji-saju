// 2026-05-22 — Phase 2+3 스펙 §9: 오행 막대 차트(도넛 아님 — 도넛은 Phase 4).
//   naming-policy §2: "X 기운" 라벨. ohaeng-* @theme 토큰 사용.
'use client';

import { useEffect, useState } from 'react';
import type { OhaengChartData, Ohaeng } from '@/lib/saju-score';
import { OHAENG_COLOR_CLASSES } from '@/lib/saju-score';

interface OhaengChartProps {
  data: OhaengChartData;
  showGuidance?: boolean;
  guidanceText?: string;
  className?: string;
}

const OHAENG_ORDER: Ohaeng[] = ['목', '화', '토', '금', '수'];

const DEFAULT_GUIDANCE: Record<Ohaeng, string> = {
  목: '목 기운(자라남과 추진): 새로운 시작과 도전적 계획이 보강이 됩니다.',
  화: '화 기운(말과 열정): 발표·기록 같은 말하는 자리가 보강이 됩니다.',
  토: '토 기운(담아냄과 안정): 규칙적인 루틴과 안정된 환경이 보강이 됩니다.',
  금: '금 기운(단단함과 결단): 체크리스트·정기 회고 같은 단단한 구조가 보강이 됩니다.',
  수: '수 기운(흐름과 깊이): 사색·학습·깊이 있는 관계가 보강이 됩니다.',
};

export function OhaengChart({ data, showGuidance = true, guidanceText, className = '' }: OhaengChartProps) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // 시각 균형 위해 최대 개수 원칙(스펙 §15.4 옵션 B).
  const maxCount = Math.max(1, ...OHAENG_ORDER.map((o) => data.counts[o]));

  const guidance = (() => {
    if (!showGuidance) return null;
    if (guidanceText) return guidanceText;
    if (data.lack.length === 0) return null;
    return data.lack.map((o) => DEFAULT_GUIDANCE[o]).join(' ');
  })();

  return (
    <div className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}>
      <div className="border-b border-gray-100 px-5 py-4">
        <h3 className="text-base font-bold text-gray-900">🍃 다섯 기운 분포</h3>
      </div>

      <div className="space-y-3 px-5 py-4">
        {OHAENG_ORDER.map((oh) => {
          const count = data.counts[oh];
          const barWidth = (count / maxCount) * 100;
          const isLack = data.lack.includes(oh);
          const isExcess = data.excess.includes(oh);
          const c = OHAENG_COLOR_CLASSES[oh];
          return (
            <div key={oh} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-sm font-medium text-gray-700">{data.labels[oh]}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                {count > 0 ? (
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${c.bg} ${isExcess ? 'opacity-70' : ''}`}
                    style={{ width: `${filled ? barWidth : 0}%` }}
                  />
                ) : (
                  <div className="h-full w-full rounded-full border-2 border-dashed border-gray-200" />
                )}
              </div>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-gray-500">{count}개</span>
              <div className="w-16 shrink-0">
                {isLack && (
                  <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                    보강 필요
                  </span>
                )}
                {isExcess && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">과다</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-5 pb-4">
        <span className="text-xs text-gray-500">균형 점수</span>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i < Math.round(data.balanceScore / 4) ? 'bg-emerald-400' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-gray-700">{data.balanceScore}/20</span>
      </div>

      {guidance && (
        <div className="mx-5 mb-5 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="mb-1.5 text-[13px] font-semibold text-amber-700">✨ 보강할 기운</p>
          <p className="text-sm leading-relaxed text-gray-700" style={{ wordBreak: 'keep-all' }}>
            {guidance}
          </p>
        </div>
      )}
    </div>
  );
}
