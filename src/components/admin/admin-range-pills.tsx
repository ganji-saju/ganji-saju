'use client';
// 2026-08-26 — 관리자 지표 화면 공용 기간 선택 칩. 마크업이 화면마다 복붙돼 있어서
//   프리셋이 갈라졌다(누적 30/90/365 · 운영 7/14/30/60 · 퍼널 7/14/30/60). 한 컴포넌트로 모은다.
import { ADMIN_RANGE_OPTIONS } from '@/lib/admin/metric-ranges';

export function AdminRangePills({
  value,
  onChange,
  className = '',
}: {
  value: number;
  onChange: (days: number) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`.trim()}
      role="group"
      aria-label="집계 기간 선택"
    >
      {ADMIN_RANGE_OPTIONS.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            title={opt.hint}
            className="rounded-full border px-3 py-1.5 text-[13.8px] font-bold transition-transform active:scale-95"
            style={{
              background: isActive ? 'var(--app-pink)' : 'white',
              color: isActive ? 'white' : 'var(--app-copy-muted)',
              borderColor: isActive ? 'var(--app-pink)' : 'var(--app-line)',
            }}
          >
            {opt.label}
            <span className="ml-1 text-[11.5px] font-semibold opacity-70">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
