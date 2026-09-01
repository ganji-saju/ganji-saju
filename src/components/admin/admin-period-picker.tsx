'use client';
// 2026-09-01 — 관리자 지표 화면 공용 **달력 기간** 선택기(admin-range-pills 대체).
//   종전 칩은 '월=30일·분기=90일' 처럼 오늘 기준 롤링이라 지난 달·지난 분기를 볼 수 없었다.
//   사용자 지시: 일=날짜 선택 · 주=월~일 · 월=1~12월 · 분기=1·2·3·4 · 년=연도.
//   /admin(서버 컴포넌트)은 같은 정본(metric-periods.ts)을 링크·GET 폼으로 쓴다 —
//   컴포넌트를 공유할 수 없는 자리라 **계산만** 공유한다(경계가 갈라지지 않게).
import {
  ADMIN_PERIOD_UNITS,
  adminPeriodChoices,
  kstTodayKey,
  resolveAdminPeriod,
  shiftAdminPeriod,
  type AdminPeriod,
  type AdminPeriodUnit,
} from '@/lib/admin/metric-periods';

export function AdminPeriodPicker({
  period,
  onChange,
  className = '',
}: {
  period: AdminPeriod;
  onChange: (next: AdminPeriod) => void;
  className?: string;
}) {
  const todayKey = kstTodayKey();
  const prevAnchor = shiftAdminPeriod(period, -1);
  const nextAnchor = shiftAdminPeriod(period, 1);
  const choices = adminPeriodChoices(period.unit);
  const go = (unit: AdminPeriodUnit, anchor?: string) =>
    onChange(resolveAdminPeriod(unit, anchor));

  const navButton = 'rounded-[10px] border border-[var(--app-line)] bg-white px-2.5 py-1.5 text-[13px] font-bold text-[var(--app-ink)] disabled:opacity-30';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="집계 단위 선택">
        {ADMIN_PERIOD_UNITS.map((opt) => {
          const isActive = opt.unit === period.unit;
          return (
            <button
              key={opt.unit}
              type="button"
              onClick={() => go(opt.unit)}
              aria-pressed={isActive}
              className="rounded-full border px-3 py-1.5 text-[13px] font-bold transition-transform active:scale-95"
              style={{
                background: isActive ? 'var(--app-pink)' : 'white',
                color: isActive ? 'white' : 'var(--app-copy-muted)',
                borderColor: isActive ? 'var(--app-pink)' : 'var(--app-line)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="이전 기간"
          disabled={!prevAnchor}
          onClick={() => prevAnchor && go(period.unit, prevAnchor)}
          className={navButton}
        >
          ←
        </button>
        {period.unit === 'day' ? (
          <input
            type="date"
            value={period.anchor}
            max={todayKey}
            aria-label="날짜 선택"
            onChange={(e) => e.target.value && go('day', e.target.value)}
            className="rounded-[10px] border border-[var(--app-line)] bg-white px-2.5 py-1.5 text-[13px]"
          />
        ) : (
          <select
            value={period.anchor}
            aria-label="기간 선택"
            onChange={(e) => go(period.unit, e.target.value)}
            className="rounded-[10px] border border-[var(--app-line)] bg-white px-2.5 py-1.5 text-[13px]"
          >
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          aria-label="다음 기간"
          disabled={!nextAnchor}
          onClick={() => nextAnchor && go(period.unit, nextAnchor)}
          className={navButton}
        >
          →
        </button>
      </div>

      {/* 며칠치를 보고 있는지 — '월'이 달력 월인지 30일인지 헷갈리던 문제의 재발 방지. */}
      <span className="text-[11.5px] text-[var(--app-copy-muted)]">
        {period.startKey}~{period.endKey} · {period.days}일
      </span>
    </div>
  );
}
