/**
 * <LoadingState /> — 표준 로딩 안내 — Phase 5-A (2026-05-18).
 *
 * 단순 "로딩중..." 대신 무엇을 불러오는지 안내 + (선택) skeleton.
 * 사용자 directive: "공개 핵심 페이지에서 미완성 문구 0건" + 로딩/오류 상태 구분.
 */
import type { ReactNode } from 'react';

interface LoadingStateProps {
  /** 무엇을 불러오는지 (예: "코인 정보", "결과", "사주 분석"). */
  label?: string;
  /** 추가 안내 (선택). */
  description?: string;
  /** skeleton 블록 (선택). 없으면 spinner 만. */
  skeleton?: ReactNode;
  /** size — sm: inline, md: block (default), lg: page-level. */
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  label = '불러오는 중',
  description,
  skeleton,
  size = 'md',
}: LoadingStateProps) {
  const padding = size === 'sm' ? 'py-2' : size === 'lg' ? 'py-12' : 'py-6';
  const labelSize = size === 'sm' ? 'text-[13.8px]' : size === 'lg' ? 'text-[17.3px]' : 'text-[15px]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center gap-2 ${padding}`}
    >
      <Spinner size={size} />
      <span className={`${labelSize} font-bold text-[var(--app-copy-muted)]`}>{label}</span>
      {description ? (
        <span className="text-[13.2px] leading-[1.5] text-[var(--app-copy-soft)]">
          {description}
        </span>
      ) : null}
      {skeleton ? <div className="mt-3 w-full">{skeleton}</div> : null}
    </div>
  );
}

function Spinner({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;
  return (
    <span
      aria-hidden="true"
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{
        width: px,
        height: px,
        color: 'var(--app-pink-strong)',
      }}
    />
  );
}
