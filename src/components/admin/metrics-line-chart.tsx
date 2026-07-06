// 2026-07-07 — /admin/analytics 용 일별 라인 차트(정적 SVG, 의존성 없음).
//   chapter-feedback-timeseries-chart / operations Sparkline 과 동일한 풀폭 반응형 패턴
//   (viewBox 0~100 + preserveAspectRatio="none" + non-scaling stroke).
//   value=null 은 "분모 없음/데이터 없음" — 0 으로 강등하지 않고 선을 끊는다(전환율 그래프가
//   무트래픽 날에 0% 급락처럼 보이던 문제 방지). 연속 non-null 구간만 선/면적으로 잇고,
//   고립점은 점으로 표시.
export interface MetricPoint {
  date: string; // YYYY-MM-DD
  value: number | null;
}

interface Props {
  title: string;
  points: MetricPoint[];
  color: string;
  /** 값 포맷터(축·요약용). */
  format?: (v: number) => string;
  subtitle?: string;
  height?: number;
}

export function MetricsLineChart({
  title,
  points,
  color,
  format = (v) => v.toLocaleString(),
  subtitle,
  height = 96,
}: Props) {
  const numeric = points
    .map((p) => p.value)
    .filter((v): v is number => typeof v === 'number');
  const hasData = numeric.some((v) => v > 0);
  const max = Math.max(...numeric, 1);
  const min = Math.min(...numeric, 0);
  const range = max - min || 1;

  const vbWidth = 100;
  const pad = 4;
  const usableH = height - pad * 2;
  const stepX = points.length > 1 ? vbWidth / (points.length - 1) : vbWidth;

  // null 은 좌표 없음(선 끊김). 연속 non-null 만 세그먼트로 묶는다.
  const coords = points.map((p, i) =>
    p.value == null
      ? null
      : { x: i * stepX, y: pad + usableH - ((p.value - min) / range) * usableH }
  );
  const segments: Array<{ x: number; y: number }[]> = [];
  let run: { x: number; y: number }[] = [];
  for (const c of coords) {
    if (c) {
      run.push(c);
    } else if (run.length) {
      segments.push(run);
      run = [];
    }
  }
  if (run.length) segments.push(run);

  const last = numeric.length ? numeric[numeric.length - 1]! : 0;
  const peak = Math.max(...numeric, 0);

  return (
    <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-extrabold text-[var(--app-ink)]">{title}</div>
        <div className="text-[11.5px] text-[var(--app-copy-soft)]">
          최근 {format(last)} · 최고 {format(peak)}
        </div>
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">{subtitle}</div>
      )}
      {hasData ? (
        <svg
          viewBox={`0 0 ${vbWidth} ${height}`}
          height={height}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="mt-2 block w-full"
          style={{ height }}
        >
          {segments.map((seg, si) => {
            const line = seg.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(1)}`).join(' ');
            const area = `${seg[0]!.x.toFixed(2)},${height} ${line} ${seg[seg.length - 1]!.x.toFixed(2)},${height}`;
            return (
              <g key={si}>
                {seg.length > 1 && <polygon points={area} fill={color} opacity={0.1} />}
                {seg.length > 1 && (
                  <polyline
                    points={line}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {/* 고립점(끊긴 구간의 단일 값)은 점으로 표시 — 안 보이는 것 방지. */}
                {seg.length === 1 && <circle cx={seg[0]!.x} cy={seg[0]!.y} r={1.4} fill={color} />}
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="mt-2 grid h-16 place-items-center text-[12px] text-[var(--app-copy-soft)]">
          데이터 없음
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10.9px] text-[var(--app-copy-soft)]">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </article>
  );
}
