// 2026-05-20 V2-5 PR S — chapter_feedback 품질 모니터링 대시보드 (admin).
//   진단서 6단계 후 권장 작업 "품질 모니터링 대시보드".
//   집계: 챕터별 평균 별점 / helpful 비율 / 최근 N개 피드백 stream.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import {
  getChapterFeedbackStats,
  getChapterFeedbackTimeseries,
  listRecentChapterFeedback,
  type ChapterFeedbackRecord,
  type ChapterFeedbackStats,
} from '@/lib/saju/chapter-feedback';
import { ChapterFeedbackTimeseriesChart } from '@/components/admin/chapter-feedback-timeseries-chart';

export const metadata: Metadata = {
  title: '챕터 피드백 (admin)',
  description: 'chapter_feedback 집계 — 챕터별 평균 별점, helpful 비율, 최근 응답 stream.',
  robots: { index: false, follow: false },
};

const CHAPTER_TITLES: Record<number, string> = {
  1: '타고난 성향',
  2: '기운의 균형',
  3: '역할과 보완',
  4: '관계 패턴',
  5: '재물 감각',
  6: '직업 방향',
  7: '건강 리듬',
  8: '10년 큰 흐름',
  9: '평생 활용 전략',
};

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

function formatRating(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(1);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StatsTable({ stats }: { stats: ChapterFeedbackStats[] }) {
  const totalResponses = stats.reduce((sum, s) => sum + s.totalResponses, 0);
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[16.1px] font-extrabold text-[var(--app-ink)]">챕터별 집계</h2>
      <p className="mt-1 text-[13.2px] text-[var(--app-copy-soft)]">
        총 응답 {totalResponses}건 · 9 챕터 평균 별점/helpful 비율
      </p>
      {totalResponses === 0 ? (
        <p className="mt-4 text-[14.4px] text-[var(--app-copy-soft)]">
          아직 응답이 없습니다. (DB 마이그레이션 적용 + 사용자 피드백 누적 후 표시)
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13.8px]">
            <thead>
              <tr className="border-b text-left text-[var(--app-copy-soft)]">
                <th className="px-2 py-1.5">챕터</th>
                <th className="px-2 py-1.5">응답</th>
                <th className="px-2 py-1.5">평균 별점</th>
                <th className="px-2 py-1.5">helpful</th>
                <th className="px-2 py-1.5">부정 비율</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const isWarning = (s.negativeRate ?? 0) > 30;
                return (
                  <tr key={s.chapterId} className="border-b last:border-b-0">
                    <td className="px-2 py-1.5">
                      <span className="font-bold">{s.chapterId}장</span>{' '}
                      <span className="text-[var(--app-copy-soft)]">
                        {CHAPTER_TITLES[s.chapterId]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{s.totalResponses}</td>
                    <td className="px-2 py-1.5">
                      {formatRating(s.averageRating)}
                      <span className="ml-1 text-[12.1px] text-[var(--app-copy-soft)]">
                        ({s.ratingResponses})
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {formatPercent(s.helpfulRate)}
                      <span className="ml-1 text-[12.1px] text-[var(--app-copy-soft)]">
                        ({s.helpfulYes}/{s.helpfulYes + s.helpfulNo})
                      </span>
                    </td>
                    <td
                      className="px-2 py-1.5 font-bold"
                      style={{ color: isWarning ? 'var(--app-coral)' : 'var(--app-ink)' }}
                    >
                      {formatPercent(s.negativeRate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentStream({ items }: { items: ChapterFeedbackRecord[] }) {
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[16.1px] font-extrabold text-[var(--app-ink)]">최근 응답 (최신 50개)</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[14.4px] text-[var(--app-copy-soft)]">
          아직 응답이 없습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-[10px] border border-[var(--app-line)] bg-[var(--app-pink-soft)] p-2.5"
            >
              <div className="flex flex-wrap items-center gap-2 text-[13.2px]">
                <span className="font-bold text-[var(--app-ink)]">
                  {item.chapter_id}장 {CHAPTER_TITLES[item.chapter_id]}
                </span>
                {item.rating !== null && (
                  <span className="rounded-full bg-white px-2 py-0.5 font-bold">
                    별점 {item.rating}/5
                  </span>
                )}
                {item.helpful_bool !== null && (
                  <span
                    className="rounded-full bg-white px-2 py-0.5 font-bold"
                    style={{
                      color: item.helpful_bool ? 'var(--app-jade)' : 'var(--app-coral)',
                    }}
                  >
                    {item.helpful_bool ? '도움됨 👍' : '아쉬움'}
                  </span>
                )}
                <span className="text-[var(--app-copy-soft)]">{formatTime(item.created_at)}</span>
              </div>
              <div className="mt-1 text-[12.1px] text-[var(--app-copy-soft)]">
                reading_id: {item.reading_id.slice(0, 16)}{item.reading_id.length > 16 ? '…' : ''}
              </div>
              {item.comment && (
                <div className="mt-1.5 text-[14.4px] text-[var(--app-ink)]">"{item.comment}"</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function SajuFeedbackAdminPage() {
  // 2026-05-20 PR T: service-role client 사용 → 모든 사용자 피드백 집계.
  // 2026-05-20 PR U: 일별 추이 차트 추가.
  const [stats, recent, timeseries] = await Promise.all([
    getChapterFeedbackStats(),
    listRecentChapterFeedback(50),
    getChapterFeedbackTimeseries(30),
  ]);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="챕터 피드백 (admin)" backHref="/admin/operations" />
        <p className="rounded-[10px] border border-[var(--app-line)] bg-white p-3 text-[13.2px] text-[var(--app-copy-soft)]">
          chapter_feedback 테이블 (migration 035) 의 챕터별 집계.
          평균 별점·helpful 비율로 LLM 품질 신호를 빠르게 확인하세요.
          부정 비율 30%+ 챕터는 prompt 튜닝 우선순위 ↑.
        </p>
        <ChapterFeedbackTimeseriesChart data={timeseries} />
        <StatsTable stats={stats} />
        <RecentStream items={recent} />
      </AppPage>
    </AppShell>
  );
}
