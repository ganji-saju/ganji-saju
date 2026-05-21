// 2026-05-21 — 점수 UI 컴포넌트 쇼케이스(Phase 3, dev 전용).
//   computeSajuScore() 결과를 SajuScoreCard 로 렌더해 게이지/내역/오행을 한눈에 QA.
//   production 에서는 notFound() 로 차단(noindex). 실제 페이지 연결은 후속 Phase.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { computeSajuScore } from '@/lib/saju-score';
import { TEST_CASES_A_BASE } from '@/lib/saju-score/test-cases';
import { SajuScoreCard } from '@/components/saju-score';

export const metadata: Metadata = {
  title: '점수 컴포넌트 쇼케이스 (dev)',
  robots: { index: false, follow: false },
};

export default function SajuScoreShowcasePage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const fixedNow = new Date('2026-05-21T00:00:00.000Z');
  const samples = TEST_CASES_A_BASE.slice(0, 8)
    .map((c) => ({
      id: c.id,
      description: c.description,
      score: computeSajuScore(c.saju, { now: fixedNow }),
    }))
    .sort((a, b) => b.score.total - a.score.total);

  return (
    <main
      className="mx-auto max-w-[480px] px-4 py-8"
      style={{
        background: 'var(--app-bg)',
        minHeight: '100vh',
        paddingBottom: 'var(--app-mobile-dock-clearance)',
      }}
    >
      <h1 className="text-[20px] font-extrabold text-[var(--app-ink)]">
        사주 점수 컴포넌트 (Phase 3)
      </h1>
      <p className="mt-1 mb-6 text-[12px] text-[var(--app-copy-soft)]">
        visual-tokens(Phase 2) 소비 · 게이지 + 내역(F1~F5) + 오행 균형 · dev 전용
      </p>
      <div className="grid gap-6">
        {samples.map((s) => (
          <div key={s.id}>
            <p className="mb-2 text-[11px] font-semibold text-[var(--app-copy-muted)]">
              {s.id} · {s.description} · {s.score.total}점 · {s.score.label.level}
            </p>
            <SajuScoreCard score={s.score} />
          </div>
        ))}
      </div>
    </main>
  );
}
