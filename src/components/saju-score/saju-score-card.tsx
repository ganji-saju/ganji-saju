// 2026-05-21 — 사주 총점 통합 카드(Phase 3). 게이지 + 내역(F1~F5) + 오행 균형.
//   computeSajuScore() 결과(SajuScore) 하나만 받아 전체를 렌더. 서버 컴포넌트.
import type { SajuScore } from '@/lib/saju-score';
import { cn } from '@/lib/utils';
import { SajuScoreGauge } from './saju-score-gauge';
import { SajuScoreBreakdown } from './saju-score-breakdown';
import { SajuOhaengChart } from './saju-ohaeng-chart';
import { SajuOhaengBalance } from './saju-ohaeng-balance';

interface Props {
  score: SajuScore;
  className?: string;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[14px] font-extrabold text-[var(--app-ink)]">{children}</h3>;
}

export function SajuScoreCard({ score, className }: Props) {
  return (
    <section
      className={cn(
        'rounded-[18px] border border-[var(--app-line)] bg-white p-5',
        className
      )}
    >
      <SajuScoreGauge total={score.total} label={score.label} />

      <hr className="my-5 border-[var(--app-line)]" />

      <SectionHeading>점수 내역</SectionHeading>
      <SajuScoreBreakdown breakdown={score.breakdown} />

      <hr className="my-5 border-[var(--app-line)]" />

      <SectionHeading>오행 균형</SectionHeading>
      <SajuOhaengChart chart={score.ohaengChart} />
      <SajuOhaengBalance chart={score.ohaengChart} className="mt-4" />
    </section>
  );
}
