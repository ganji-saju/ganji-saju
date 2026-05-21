// 2026-05-21 — 사주 총점 원형 게이지(Phase 3). 총점 0~100 + 등급 라벨.
//   visual-tokens 단일 소스(getScoreLevelToken) 의 hex 로 호(arc) 색상. 순수 프레젠테이션(서버 컴포넌트).
//   preview 모드(무료 미리보기): 숫자/컬러 호 미렌더 + 🔒, 등급명만 노출 — 총점은 클라이언트 HTML 에 미포함(페이월).
import type { ScoreLabel } from '@/lib/saju-score';
import { getScoreLevelToken } from '@/lib/saju-score';
import { cn } from '@/lib/utils';

interface Props {
  total: number;
  label: ScoreLabel;
  /** 무료 미리보기 — 총점/상세를 가리고 등급명 + 🔒 만 노출 (결과 페이지 페이월). */
  preview?: boolean;
  className?: string;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SajuScoreGauge({ total, label, preview = false, className }: Props) {
  const value = Math.max(0, Math.min(100, Math.round(total)));
  const hex = getScoreLevelToken(label.level).hex;
  const dashOffset = CIRCUMFERENCE * (1 - value / 100);

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="relative h-[160px] w-[160px]">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="12" stroke="var(--app-line)" />
          {/* preview 에서는 컬러 호를 그리지 않아 총점이 시각적으로도 노출되지 않음 */}
          {!preview && (
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              stroke={hex}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {preview ? (
            <span className="text-[34px] leading-none" aria-label="결제 후 공개">
              🔒
            </span>
          ) : (
            <span className="text-[40px] font-extrabold leading-none tracking-tighter text-[var(--app-ink)]">
              {value}
            </span>
          )}
          <span className="mt-1 text-[12px] font-semibold" style={{ color: hex }}>
            {label.title}
          </span>
        </div>
      </div>
      {!preview && (
        <>
          <p className="mt-3 text-[14px] font-bold text-[var(--app-ink)]">{label.subtitle}</p>
          <p className="mt-1 max-w-[340px] text-[13px] leading-6 text-[var(--app-copy-soft)]">
            {label.description}
          </p>
          <p className="mt-2 text-[11px] text-[var(--app-copy-muted)]">{label.disclaimer}</p>
        </>
      )}
    </div>
  );
}
