/**
 * <SkeletonCard /> — 표준 카드 스켈레톤 — Phase 5-A (2026-05-18).
 *
 * 데이터 로딩 중 빈 공간 대신 윤곽 표시 → 레이아웃 이동 (CLS) 감소.
 * 단순 "로딩중..." 텍스트 대체.
 */
interface SkeletonCardProps {
  /** 카드 개수 (기본 1). */
  count?: number;
  /** 카드 내부 줄 수 (기본 3). */
  lines?: number;
  /** 카드 높이 (px). */
  height?: number;
}

export function SkeletonCard({ count = 1, lines = 3, height }: SkeletonCardProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className="space-y-3"
      data-state="skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)', height }}
        >
          <div className="space-y-2">
            {Array.from({ length: lines }).map((__, j) => (
              <div
                key={j}
                className="animate-pulse rounded bg-[var(--app-line)]"
                style={{
                  height: 10,
                  width: j === lines - 1 ? '60%' : '100%',
                }}
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
