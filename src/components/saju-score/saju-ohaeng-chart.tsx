// 2026-05-21 — 오행 레이더(펜타곤) 차트(Phase 4 — 오행 차트 UI). 서버 컴포넌트.
//   computeOhaengRadarPoints(순수 로직) + OHAENG_TOKENS(단일 소스 색) 소비.
//   다섯 기운의 분포 "모양"을 한눈에 + 균형 레벨/도미넌트 캡션.
import type { OhaengChartData } from '@/lib/saju-score';
import {
  computeOhaengRadarPoints,
  getDominantOhaeng,
  getOhaengBalanceLevel,
  getOhaengToken,
} from '@/lib/saju-score';
import { cn } from '@/lib/utils';

interface Props {
  chart: OhaengChartData;
  className?: string;
}

const CX = 100;
const CY = 100;
const R = 70;

function anchorFor(x: number): 'start' | 'middle' | 'end' {
  if (x > CX + 4) return 'start';
  if (x < CX - 4) return 'end';
  return 'middle';
}

export function SajuOhaengChart({ chart, className }: Props) {
  const { axes, polygonPoints } = computeOhaengRadarPoints(chart.counts, { cx: CX, cy: CY, radius: R });
  const labelAxes = computeOhaengRadarPoints(chart.counts, { cx: CX, cy: CY, radius: R + 18 }).axes;
  const gridOuter = axes.map((p) => `${p.x},${p.y}`).join(' ');
  const gridInner = axes.map((p) => `${CX + (p.x - CX) * 0.5},${CY + (p.y - CY) * 0.5}`).join(' ');

  const dominant = getDominantOhaeng(chart.counts);
  const dominantHex = getOhaengToken(dominant).hex;
  const balance = getOhaengBalanceLevel(chart.balanceScore);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg viewBox="-20 -20 240 240" className="h-[210px] w-[210px]" role="img" aria-label="다섯 기운 분포 차트">
        {/* 그리드 펜타곤 + 스포크 */}
        <polygon points={gridOuter} fill="none" stroke="var(--app-line)" strokeWidth="1" />
        <polygon points={gridInner} fill="none" stroke="var(--app-line)" strokeWidth="1" />
        {axes.map((p) => (
          <line key={`spoke-${p.element}`} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--app-line)" strokeWidth="1" />
        ))}

        {/* 데이터 폴리곤(도미넌트 색) */}
        <polygon points={polygonPoints} fill={dominantHex} fillOpacity={0.18} stroke={dominantHex} strokeWidth="2" strokeLinejoin="round" />

        {/* 꼭짓점 점(오행별 색) */}
        {computeOhaengRadarPoints(chart.counts, { cx: CX, cy: CY, radius: R }).data.map((p) => (
          <circle key={`dot-${p.element}`} cx={p.x} cy={p.y} r={2.6} fill={getOhaengToken(p.element).hex} />
        ))}

        {/* 축 라벨 "X" + count */}
        {labelAxes.map((p) => {
          const hex = getOhaengToken(p.element).hex;
          return (
            <text
              key={`label-${p.element}`}
              x={p.x}
              y={p.y}
              textAnchor={anchorFor(p.x)}
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="700"
              fill={hex}
            >
              {p.element}
              <tspan fill="var(--app-copy-muted)" fontWeight="600">
                {' '}
                {chart.counts[p.element]}
              </tspan>
            </text>
          );
        })}
      </svg>

      <p className="mt-1 text-[13px] font-bold text-[var(--app-ink)]">{balance.label}</p>
      <p className="mt-1 text-[12px] text-[var(--app-copy-soft)]">
        강한 기운 <span style={{ color: dominantHex }}>{chart.labels[dominant]}</span>
        {chart.lack.length > 0 && (
          <>
            {' · '}부족 {chart.lack.map((el) => chart.labels[el]).join(', ')}
          </>
        )}
      </p>
    </div>
  );
}
