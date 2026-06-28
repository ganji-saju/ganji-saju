// 2026-05-20 V2-5 PR U — 챕터 피드백 일별 추이 차트 (admin).
//   getChapterFeedbackTimeseries(30) 결과를 SVG sparkline 으로 시각화.
//   server component 로 렌더링 — client 컴포넌트 불필요 (정적 SVG).
import type { ChapterFeedbackDailyPoint } from '@/lib/saju/chapter-feedback';

interface Props {
  data: ChapterFeedbackDailyPoint[];
}

/** 작은 SVG sparkline — operations-dashboard 의 동일 패턴. */
function Sparkline({
  values,
  color,
  height = 44,
  baseline,
}: {
  values: Array<number | null>;
  color: string;
  height?: number;
  /** baseline 평균 (점선) — 선택 */
  baseline?: number;
}) {
  const numeric = values.filter((v): v is number => typeof v === 'number');
  if (numeric.length === 0) {
    return (
      <div className="text-[12.1px] text-[var(--app-copy-soft)]">
        데이터 없음
      </div>
    );
  }
  const max = Math.max(...numeric, 1);
  const min = Math.min(...numeric, 0);
  const range = max - min || 1;
  // 2026-06-28 — 풀폭 반응형(viewBox 0~100 + preserveAspectRatio="none" + non-scaling stroke).
  const vbWidth = 100;
  const stepX = values.length > 1 ? vbWidth / (values.length - 1) : vbWidth;

  const pointsArr = values
    .map((v, i) => {
      if (v === null) return null;
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(1)}`;
    })
    .filter((p): p is string => p !== null);

  const baselineY =
    typeof baseline === 'number' ? height - ((baseline - min) / range) * height : null;

  return (
    <svg
      viewBox={`0 0 ${vbWidth} ${height}`}
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block h-11 w-full"
    >
      {baselineY !== null && (
        <line
          x1={0}
          y1={baselineY}
          x2={vbWidth}
          y2={baselineY}
          stroke="var(--app-copy-soft)"
          strokeDasharray="2 3"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
          opacity={0.4}
        />
      )}
      <polyline
        points={pointsArr.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ChapterFeedbackTimeseriesChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
        <h2 className="text-[16.1px] font-extrabold text-[var(--app-ink)]">일별 추이 (30일)</h2>
        <p className="mt-2 text-[14.4px] text-[var(--app-copy-soft)]">
          아직 응답이 없습니다.
        </p>
      </section>
    );
  }

  const totalResponses = data.reduce((s, d) => s + d.totalResponses, 0);
  const overallRatings = data
    .map((d) => d.averageRating)
    .filter((r): r is number => typeof r === 'number');
  const overallAverage =
    overallRatings.length > 0
      ? Math.round((overallRatings.reduce((a, b) => a + b, 0) / overallRatings.length) * 10) / 10
      : null;

  const responsesSeries = data.map((d) => d.totalResponses);
  const ratingSeries = data.map((d) => d.averageRating);
  const helpfulRateSeries = data.map((d) => d.helpfulRate);

  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[16.1px] font-extrabold text-[var(--app-ink)]">일별 추이 (30일)</h2>
      <p className="mt-1 text-[13.2px] text-[var(--app-copy-soft)]">
        최근 30일 / 총 {totalResponses}건 / 평균 별점{' '}
        {overallAverage !== null ? `${overallAverage}/5` : '—'}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
            응답 수
          </div>
          <Sparkline values={responsesSeries} color="var(--app-pink-strong)" />
          <div className="mt-1 text-[12.1px] text-[var(--app-copy-soft)]">
            {data[0]?.date} → {data[data.length - 1]?.date}
          </div>
        </article>

        <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-jade,#3F8796)]">
            평균 별점
          </div>
          <Sparkline values={ratingSeries} color="var(--app-jade,#3F8796)" baseline={3.5} />
          <div className="mt-1 text-[12.1px] text-[var(--app-copy-soft)]">
            점선: 목표 3.5
          </div>
        </article>

        <article className="rounded-[12px] border border-[var(--app-line)] bg-white p-3">
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber,#D59B2E)]">
            helpful 비율
          </div>
          <Sparkline values={helpfulRateSeries} color="#D59B2E" baseline={70} />
          <div className="mt-1 text-[12.1px] text-[var(--app-copy-soft)]">점선: 목표 70%</div>
        </article>
      </div>
    </section>
  );
}
