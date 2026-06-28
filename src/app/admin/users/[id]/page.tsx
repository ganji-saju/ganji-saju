// 2026-06-06 M3 — 어드민 사용자 360 상세(요약 헤더 + 6탭). 읽기 전용 + 환불.
//   서버측 역할 마스킹(admin: 이메일/생년월일/영수증 가림) + view_detail 감사.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { createClient, createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getAdminUserDetail } from '@/lib/admin/user-detail';
import { getMemberExtras } from '@/lib/admin/member-extras';
import { buildMemberHeader, formatBirth } from '@/lib/admin/detail-view';
import { logAdminAccess } from '@/lib/admin/access-log';
import { MemberDetailTabs, type DetailTab } from './member-detail-tabs';
import { RefundActions } from './refund-actions';
import { GrantCreditsActions } from './grant-credits-actions';
import { GrantMembershipActions } from './grant-membership-actions';
import { getManagedSubscription } from '@/lib/subscription';

export const metadata: Metadata = {
  title: '사용자 상세 (admin)',
  description: '회원 360 — 프로필·사주·결제·활동·LLM·환불',
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
      <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--app-line)] py-1.5 last:border-0">
      <span className="text-[13.2px] text-[var(--app-copy-soft)]">{label}</span>
      <span className={`text-right text-[13.8px] font-semibold text-[var(--app-ink)] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[var(--app-pink-soft)] px-2 py-0.5 text-[12.6px] font-bold text-[var(--app-ink)]">{children}</span>;
}

async function fetchSummaryRow(userId: string): Promise<{ last_active_at: string | null; subscription_status: string | null } | null> {
  if (!hasSupabaseServiceEnv) return null;
  const service = await createServiceClient();
  const { data } = await service
    .from('admin_user_summary')
    .select('last_active_at, subscription_status')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { last_active_at: string | null; subscription_status: string | null } | null) ?? null;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  const role: 'admin' | 'super_admin' = check.role ?? 'admin';

  const [detail, extras, summaryRow, subscription] = await Promise.all([
    getAdminUserDetail(id),
    getMemberExtras(id),
    fetchSummaryRow(id),
    getManagedSubscription(id).catch(() => null),
  ]);
  if (!detail) notFound();

  if (check.userId) {
    await logAdminAccess({ actorId: check.userId, actorRole: role, action: 'view_detail', targetUser: id });
  }

  const { profile, palja, payment, llmStats, refund } = detail;
  const nowIso = new Date().toISOString();
  const header = buildMemberHeader(
    {
      id: detail.id,
      email: detail.email,
      createdAt: detail.createdAt,
      profile: { displayName: profile?.displayName ?? null },
      ltvWon: payment.totalSpentWon,
      subscriptionStatus: summaryRow?.subscription_status ?? null,
      lastActiveAt: summaryRow?.last_active_at ?? detail.latestReadingAt ?? null,
      refundableWon: refund.totalRefundableWon,
    },
    role,
    nowIso
  );
  const birth = formatBirth(profile?.birthYear ?? null, profile?.birthMonth ?? null, profile?.birthDay ?? null, role);
  // 출생 시(時)도 사주 PII — super_admin 에게만 노출, admin 은 가림.
  const birthFull =
    birth && header.isSuper && profile?.birthHour != null
      ? `${birth} ${String(profile.birthHour).padStart(2, '0')}시`
      : (birth ?? '—');
  const llmTotalCost = llmStats.reduce((s, r) => s + r.costUsd, 0);
  const refundTargetCount = refund.items.length + refund.creditItems.filter((i) => i.status !== 'none').length;
  const apptSummary = Object.entries(extras.appointments.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';

  const tabs: DetailTab[] = [
    {
      key: 'member',
      label: '회원·프로필',
      content: (
        <Card title="회원·프로필">
          <Field label="이메일" value={header.emailMasked ?? '—'} />
          <Field label="UUID" value={detail.id} mono />
          <Field label="가입일" value={fmtDate(detail.createdAt)} />
          <Field label="표시 이름" value={header.displayName} />
          <Field label="생년월일" value={birthFull} />
          <Field label="성별" value={genderLabel(profile?.gender ?? null)} />
          <Field label="가족 프로필" value={`${extras.familyCount}명`} />
          <Field label="정책 동의" value={extras.consent.latestMethod ? `${extras.consent.latestMethod} · ${fmtDate(extras.consent.latestAt)}` : '—'} />
        </Card>
      ),
    },
    {
      key: 'saju',
      label: '사주·콘텐츠',
      content: (
        <Card title="사주·콘텐츠">
          {palja ? (
            <>
              <Field label="팔자" value={<span className="font-mono text-[16.1px]">{palja.year} {palja.month} {palja.day} {palja.hour ?? '시미상'}</span>} />
              <Field label="최근 풀이" value={fmtDateTime(detail.latestReadingAt)} />
              <Field label="조회 기록 수" value={`${detail.readingCount}건`} />
            </>
          ) : (
            <p className="text-[13.8px] text-[var(--app-copy-soft)]">사주 조회 기록이 없습니다.</p>
          )}
        </Card>
      ),
    },
    {
      key: 'payment',
      label: '결제·크레딧',
      content: (
        <Card title={`결제 이력 · 총 ${fmtWon(payment.totalSpentWon)} (${payment.count}건)`}>
          {payment.entries.length === 0 ? (
            <p className="text-[13.8px] text-[var(--app-copy-soft)]">현금 결제 내역이 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {payment.entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--app-line)] px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[13.8px] font-extrabold text-[var(--app-ink)]">{e.productName}</span>
                    <span className="text-[12.1px] text-[var(--app-copy-soft)]">
                      {e.category} · {fmtDate(e.date)}{header.isSuper ? ` · 영수증 ${maskReceipt(e.receipt)}` : ''}
                    </span>
                  </div>
                  <span className="text-[14.4px] font-extrabold text-[var(--app-ink)]">
                    {fmtWon(e.amountWon)}{e.coins != null ? ` · ${e.coins}코인` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ),
    },
    {
      key: 'activity',
      label: '활동·참여',
      content: (
        <Card title="활동·참여">
          <Field label="AI 대화 메시지" value={`${detail.dialogueCount}건`} />
          <Field label="피드백(오늘운세/정확도/챕터)" value={`${extras.feedback.todayCount} / ${extras.feedback.accuracyCount} / ${extras.feedback.chapterCount}`} />
          <Field label="챕터 평균 별점" value={extras.feedback.avgChapterRating ?? '—'} />
          <Field label="후기" value={`${extras.reviews.count}건 (검증 ${extras.reviews.verifiedCount}, 평균 ${extras.reviews.avgRating ?? '—'})`} />
          <Field label="예약" value={`${extras.appointments.total}건 (${apptSummary})`} />
          <Field label="알림" value={`기기 ${extras.notifications.activeDevices} · 발송 ${extras.notifications.deliveries} · 클릭 ${extras.notifications.clicks}`} />
          <Field label="마지막 조회" value={fmtDateTime(extras.notifications.lastSeenAt)} />
          <Field label="별자리 팔로우" value={`${extras.notifications.follows}개`} />
        </Card>
      ),
    },
    {
      key: 'llm',
      label: 'LLM·비용',
      content: (
        <Card title={`LLM 사용/캐시 · 비용 $${llmTotalCost.toFixed(4)} (근사)`}>
          {llmStats.length === 0 ? (
            <p className="text-[13.8px] text-[var(--app-copy-soft)]">기록 없음 (Phase 0b 배포 이후 호출분만 집계).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.2px]">
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
                      <td className={`py-1 text-right ${s.fallback > 0 ? 'font-extrabold text-[var(--app-pink-strong)]' : ''}`}>{s.fallback}</td>
                      <td className="py-1 text-right">{s.costUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: 'refund',
      label: '환불·운영',
      content: (
        <>
          <Card title={`환불 가능 · 대상 ${fmtWon(refund.totalRefundableWon)} (${refundTargetCount}건)`}>
            {refund.items.length === 0 && refund.creditItems.length === 0 && detail.refundRequests.length === 0 ? (
              <p className="text-[13.8px] text-[var(--app-copy-soft)]">환불 대상 결제·요청이 없습니다.</p>
            ) : (
              <RefundActions role={role} items={refund.items} creditItems={refund.creditItems} requests={detail.refundRequests} />
            )}
          </Card>
          <Card title="코인 수동 지급 (super_admin)">
            <p className="mb-2 text-[12.1px] text-[var(--app-copy-soft)]">
              보상·사과 등 임의 지급. 결제 코인은 1년 만료, 구독 코인은 무만료. 회수는 환불로.
            </p>
            <GrantCreditsActions role={role} userId={id} />
          </Card>
          <Card title="멤버십 권한 변경 (super_admin)">
            <p className="mb-2 text-[12.1px] text-[var(--app-copy-soft)]">
              프리미엄 멤버십을 N일 부여하거나 즉시 해제. 코인은 지급하지 않음(코인 수동 지급 별도).
            </p>
            <GrantMembershipActions
              role={role}
              userId={id}
              currentPlan={subscription?.plan ?? null}
              currentStatus={subscription?.status ?? null}
            />
          </Card>
        </>
      ),
    },
  ];

  return (
    <AdminPage title="사용자 상세">

        <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[18.4px] font-extrabold text-[var(--app-ink)]">{header.displayName}</div>
              <div className="text-[13.8px] text-[var(--app-copy-soft)]">{header.emailMasked ?? '—'}</div>
            </div>
            <div className="text-right text-[12.6px] text-[var(--app-copy-soft)]">
              가입 {fmtDate(header.signupAt)} ({header.ageDays}일째)
              <br />
              {header.inactiveDays != null ? `${header.inactiveDays}일 비활동` : '활동 기록 없음'}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>LTV {fmtWon(header.ltvWon)}</Badge>
            <Badge>{header.subscriptionStatus ? `구독 ${header.subscriptionStatus}` : '구독 없음'}</Badge>
            {header.refundableWon > 0 && <Badge>환불대상 {fmtWon(header.refundableWon)}</Badge>}
          </div>
          <p className="mt-2 text-[12.1px] text-[var(--app-copy-soft)]">
            ⚠ 이 화면 열람은 감사로그에 기록됩니다{header.isSuper ? ' · super_admin 전체표시' : ' · 일부 마스킹'}.
          </p>
        </section>

        <MemberDetailTabs tabs={tabs} />
    </AdminPage>
  );
}
