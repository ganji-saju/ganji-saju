import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SafetyNoticeProps {
  children?: ReactNode;
  className?: string;
}

const DEFAULT_NOTICE =
  '달빛인생의 사주·성향 콘텐츠는 참고용 자기이해 콘텐츠입니다. 의료, 법률, 투자, 위기상황 판단은 전문 기준과 즉각적인 도움을 우선해 주세요.';

export function SafetyNotice({ children = DEFAULT_NOTICE, className }: SafetyNoticeProps) {
  return (
    <aside
      className={cn(
        'rounded-[1.1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-3 text-sm leading-6 text-[var(--gyeol-muted)]',
        className
      )}
    >
      {children}
    </aside>
  );
}
