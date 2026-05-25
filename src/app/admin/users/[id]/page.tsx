// 2026-05-25 Phase 1 — 어드민 사용자 상세(6섹션).
//   회원·사주(팔자)·결제·AI챗·LLM 통계·환불 가능 여부를 한 화면에. 읽기 전용.
//   /admin 레이아웃이 화이트리스트 가드. service_role 로 own-row RLS 우회(getAdminUserDetail).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { getAdminUserDetail } from '@/lib/admin/user-detail';

export const metadata: Metadata = {
  title: '사용자 상세 (admin)',
  description: '회원·사주·결제·AI챗·LLM·환불 상태',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}
function fmtDateTime(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}
function fmtWon(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('ko-KR')}원`;
}
function genderLabel(g: string | null): string {
  return g === 'male' ? '남성' : g === 'female' ? '여성' : '—';
}
function maskReceipt(r: string | null): string {
  return r ? `…${r.slice(-8)}` : '—';
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--app-line)] py-1.5 last:border-0">
      <span className="text-[11.5px] text-[var(--app-copy-soft)]">{label}</span>
      <span className={`text-right text-[12px] font-semibold text-[var(--app-ink)] ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getAdminUserDetail(id);
  if (!detail) notFound();

  const { profile, palja, payment, llmStats, refund } = detail;
  const birth =
    profile?.birthYear && profile?.birthMonth && profile?.birthDay
      ? `${profile.birthYear}.${String(profile.birthMonth).padStart(2, '0')}.${String(profile.birthDay).padStart(2, '0')}` +
        (profile.birthHour != null ? ` ${String(profile.birthHour).padStart(2, '0')}시` : ' (시 미상)')
      : '—';
  const llmTotalCost = llmStats.reduce((s, r) => s + r.costUsd, 0);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-4">
        <GangiPageHeader title="사용자 상세 (admin)" backHref="/admin/users" />

        {/* 1. 회원 정보 */}
        <Card title="회원 정보">
          <Field label="이메일" value={detail.email ?? '—'} />
          <Field label="UUID" value={detail.id} mono />
          <Field label="가입일" value={fmtDate(detail.createdAt)} />
          <Field label="표시 이름" value={profile?.displayName ?? '—'} />
          <Field label="생년월일" value={birth} />
          <Field label="성별" value={genderLabel(profile?.gender ?? null)} />
        </Card>

        {/* 2. 사주 데이터 */}
        <Card title="사주 데이터">
          {palja ? (
            <>
              <Field
                label="팔자"
                value={
                  <span className="font-mono text-[14px]">
                    {palja.year} {palja.month} {palja.day} {palja.hour ?? '시미상'}
                  </span>
                }
              />
              <Field label="최근 풀이" value={fmtDateTime(detail.latestReadingAt)} />
              <Field label="조회 기록 수" value={`${detail.readingCount}건`} />
            </>
          ) : (
            <p className="text-[12px] text-[var(--app-copy-soft)]">사주 조회 기록이 없습니다.</p>
          )}
        </Card>

        {/* 3. 결제 이력 */}
        <Card title={`결제 이력 · 총 ${fmtWon(payment.totalSpentWon)} (${payment.count}건)`}>
          {payment.entries.length === 0 ? (
            <p className="text-[12px] text-[var(--app-copy-soft)]">현금 결제 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {payment.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--app-line)] px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-[12px] font-extrabold text-[var(--app-ink)]">
                      {e.productName}
                    </span>
                    <span className="text-[10.5px] text-[var(--app-copy-soft)]">
                      {e.category} · {fmtDate(e.date)} · 영수증 {maskReceipt(e.receipt)}
                    </span>
                  </div>
                  <span className="text-[12.5px] font-extrabold text-[var(--app-ink)]">
                    {fmtWon(e.amountWon)}
                    {e.coins != null ? ` · ${e.coins}코인` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 4. AI 챗 사용량 */}
        <Card title="AI 챗 사용량">
          <Field label="대화 메시지 수" value={`${detail.dialogueCount}건`} />
        </Card>

        {/* 5. LLM 캐시 hit 통계 (Phase 0b ai_llm_runs) */}
        <Card title={`LLM 사용/캐시 통계 · 비용 $${llmTotalCost.toFixed(4)}`}>
          {llmStats.length === 0 ? (
            <p className="text-[12px] text-[var(--app-copy-soft)]">
              기록 없음 (Phase 0b 배포 이후 호출분만 집계).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-[var(--app-copy-soft)]">
                    <th className="py-1 text-left font-semibold">영역</th>
                    <th className="py-1 text-right font-semibold">openai</th>
                    <th className="py-1 text-right font-semibold">cache</th>
                    <th className="py-1 text-right font-semibold">fallback</th>
                    <th className="py-1 text-right font-semibold">비용($)</th>
                  </tr>
                </thead>
                <tbody>
                  {llmStats.map((s) => (
                    <tr key={s.feature} className="border-t border-[var(--app-line)]">
                      <td className="py-1 font-semibold text-[var(--app-ink)]">{s.feature}</td>
                      <td className="py-1 text-right">{s.openai}</td>
                      <td className="py-1 text-right">{s.cache}</td>
                      <td
                        className={`py-1 text-right ${s.fallback > 0 ? 'font-extrabold text-[var(--app-pink-strong)]' : ''}`}
                      >
                        {s.fallback}
                      </td>
                      <td className="py-1 text-right">{s.costUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 6. 환불 가능 여부 (상태 표시만 — 실제 환불은 Phase 2) */}
        <Card title={`환불 가능 · 대상 ${fmtWon(refund.totalRefundableWon)} (${refund.items.length}건)`}>
          {refund.items.length === 0 ? (
            <p className="text-[12px] text-[var(--app-copy-soft)]">환불 대상 결제가 없습니다.</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {refund.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--app-line)] px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-[12px] font-extrabold text-[var(--app-ink)]">
                        {i.productName}
                      </span>
                      <span className="text-[10.5px] text-[var(--app-copy-soft)]">
                        {fmtDate(i.createdAt)} ·{' '}
                        {i.hasPaymentKey ? 'paymentKey 있음(Toss 취소 가능)' : 'paymentKey 없음'}
                      </span>
                    </div>
                    <span className="text-[12.5px] font-extrabold text-[var(--app-ink)]">
                      {fmtWon(i.amountWon)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10.5px] text-[var(--app-copy-soft)]">
                ※ 실제 환불(Toss 결제취소)은 Phase 2에서 연동. 현재는 상태 표시만.
              </p>
            </>
          )}
        </Card>
      </AppPage>
    </AppShell>
  );
}
