/**
 * <EmptyState /> — 표준 빈 상태 안내 — Phase 5-A (2026-05-18).
 *
 * 단순 "결과가 없습니다" 대신 명확한 설명 + 사용자가 취할 다음 행동.
 * 사용자 directive: "사용자가 다음 행동을 알 수 있어야 한다".
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** 짧은 제목 (예: "조건에 맞는 결과를 찾지 못했습니다"). */
  title: string;
  /** 상세 설명 — 왜 비었는지 + 무엇이 영향. */
  description?: string;
  /** 행동 영역 — 버튼 / 링크 등. 부모가 ReactNode 로 자유 구성. */
  actions?: ReactNode;
  /** 아이콘 (선택) — emoji 또는 svg. */
  icon?: ReactNode;
}

export function EmptyState({ title, description, actions, icon }: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="빈 상태"
      className="flex flex-col items-center gap-3 rounded-[14px] border bg-white px-4 py-8 text-center"
      style={{ borderColor: 'var(--app-line)' }}
    >
      {icon ? <div className="text-[32.2px]">{icon}</div> : null}
      <div className="space-y-1">
        <h2 className="text-[16.1px] font-extrabold text-[var(--app-ink)]">{title}</h2>
        {description ? (
          <p
            className="text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
