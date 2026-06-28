// 2026-05-25 Phase 3 — LLM 비용 대시보드(admin). 기존 ai_llm_runs(0b) 집계 시각화.
//   일별 비용 추이 · 영역별 토큰/비용/캐시 hit률 · LLM 활성 사용자 대비 비용.
//   /admin 레이아웃이 화이트리스트 가드. 신규 테이블 없음(ai_llm_runs 재활용).
import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/admin-page';
import { getLlmCostStats } from '@/lib/admin/llm-cost-stats';

export const metadata: Metadata = {
  title: 'LLM 비용 (admin)',
  description: '영역별 LLM 호출·토큰·비용·캐시 hit률',
  robots: { index: false, follow: false },
};

const usd = (n: number) => `$${n.toFixed(4)}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString('ko-KR');

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export default async function LlmCostPage() {
  const stats = await getLlmCostStats(30);
  const { summary, byFeature, daily } = stats;
  const maxDayCost = Math.max(0.000001, ...daily.map((d) => d.costUsd));

  return (
    <AdminPage title="LLM 비용">

        {/* 요약 */}
        <Card title={`최근 ${stats.windowDays}일 요약`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '총 비용', value: usd(summary.totalCostUsd) },
              { label: '총 호출수', value: num(summary.totalCalls) },
              { label: 'LLM 활성 사용자', value: num(summary.distinctUsers) },
              { label: '캐시 hit률', value: pct(summary.cacheHitRate) },
            ].map((m) => (
              <div key={m.label} className="rounded-[12px] border border-[var(--app-line)] p-3">
                <div className="text-[12.1px] text-[var(--app-copy-soft)]">{m.label}</div>
                <div className="mt-1 text-[18.4px] font-extrabold text-[var(--app-ink)]">{m.value}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* 영역별 */}
        <Card title="영역별 (비용 순)">
          {byFeature.length === 0 ? (
            <p className="text-[13.8px] text-[var(--app-copy-soft)]">
              데이터 없음 (Phase 0b 배포 이후 호출분만 집계).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.2px]">
                <thead>
                  <tr className="text-[var(--app-copy-soft)]">
                    <th className="py-1 text-left font-semibold">영역</th>
                    <th className="py-1 text-right font-semibold">호출</th>
                    <th className="py-1 text-right font-semibold">openai</th>
                    <th className="py-1 text-right font-semibold">cache</th>
                    <th className="py-1 text-right font-semibold">fallback</th>
                    <th className="py-1 text-right font-semibold">hit률</th>
                    <th className="py-1 text-right font-semibold">토큰(in/out)</th>
                    <th className="py-1 text-right font-semibold">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {byFeature.map((f) => (
                    <tr key={f.feature} className="border-t border-[var(--app-line)]">
                      <td className="py-1 font-semibold text-[var(--app-ink)]">{f.feature}</td>
                      <td className="py-1 text-right">{num(f.calls)}</td>
                      <td className="py-1 text-right">{num(f.openai)}</td>
                      <td className="py-1 text-right">{num(f.cache)}</td>
                      <td
                        className={`py-1 text-right ${f.fallback > 0 ? 'font-extrabold text-[var(--app-pink-strong)]' : ''}`}
                      >
                        {num(f.fallback)}
                      </td>
                      <td className="py-1 text-right">{pct(f.cacheHitRate)}</td>
                      <td className="py-1 text-right">
                        {num(f.inputTokens)}/{num(f.outputTokens)}
                      </td>
                      <td className="py-1 text-right font-semibold">{usd(f.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 일별 추이 */}
        <Card title="일별 비용 추이">
          {daily.length === 0 ? (
            <p className="text-[13.8px] text-[var(--app-copy-soft)]">데이터 없음.</p>
          ) : (
            <ul className="space-y-1">
              {daily.map((d) => (
                <li key={d.date} className="flex items-center gap-2">
                  <span className="w-[78px] shrink-0 text-[12.6px] text-[var(--app-copy-soft)]">
                    {d.date.slice(5)}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--app-pink-soft)]">
                    <span
                      className="block h-full rounded-full bg-[var(--app-pink-strong)]"
                      style={{ width: `${Math.round((d.costUsd / maxDayCost) * 100)}%` }}
                    />
                  </span>
                  <span className="w-[120px] shrink-0 text-right text-[12.6px] text-[var(--app-ink)]">
                    {usd(d.costUsd)} · {num(d.distinctUsers)}인
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="text-[12.1px] text-[var(--app-copy-soft)]">
          ※ 데이터는 Phase 0b(텔레메트리) 배포 이후 호출분만. &quot;LLM 활성 사용자&quot;는
          기간 내 LLM을 1회 이상 쓴 고유 사용자(비로그인 제외) — 방문 DAU와 다름. 대운 챕터의
          envelope 캐시 hit은 집계 미포함(별도 chapter_run 로그)이라 챕터 hit률은 과소 추정될 수 있음.
        </p>
    </AdminPage>
  );
}
