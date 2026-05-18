/**
 * <ErrorState /> — 표준 오류 상태 — Phase 5-A (2026-05-18).
 *
 * 사용자에게 명확한 오류 안내 + 재시도 / CS 문의 옵션.
 * 사용자 directive: "로딩 상태와 오류 상태가 구분".
 */
import type { ReactNode } from 'react';
import { BUSINESS_INFO } from '@/lib/business-info';

interface ErrorStateProps {
  /** 사용자에게 보일 제목 (예: "일시적인 오류가 발생했습니다"). */
  title: string;
  /** 상세 설명. raw error 노출 금지 — 일반 친화 문구. */
  description?: string;
  /** 재시도 핸들러 — 있으면 RetryButton 자동 표시. */
  onRetry?: () => void;
  /** 재시도 버튼 라벨 (기본: "다시 시도"). */
  retryLabel?: string;
  /** CS 문의 링크 표시 여부 (기본 true). */
  showSupportLink?: boolean;
  /** 추가 액션 (예: "처음으로", "다른 시도"). */
  extraActions?: ReactNode;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = '다시 시도',
  showSupportLink = true,
  extraActions,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="space-y-3 rounded-[14px] border bg-white px-4 py-6"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="space-y-1">
        <h2 className="text-[14px] font-extrabold text-[var(--app-pink-strong)]">{title}</h2>
        {description ? (
          <p
            className="text-[12.5px] leading-[1.6] text-[var(--app-copy)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[10px] bg-[var(--app-pink-strong)] px-3 py-2 text-[12.5px] font-bold text-white"
          >
            {retryLabel}
          </button>
        ) : null}
        {extraActions}
        {showSupportLink && BUSINESS_INFO.email ? (
          <a
            href={`mailto:${BUSINESS_INFO.email}`}
            className="text-[12px] font-bold text-[var(--app-copy-muted)] underline"
          >
            고객센터 문의
          </a>
        ) : null}
      </div>
    </div>
  );
}
