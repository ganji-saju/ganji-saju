import { Fragment } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { getExternalReport } from '@/lib/admin/external-report-history';
import { getReportOrder } from '@/lib/report-orders/report-order-store';
import { HOUR_SLOTS, REPORT_PRODUCT_LABEL, REPORT_STATUS_LABEL } from '@/lib/report-orders/report-order';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { ExternalReportView } from '@/app/admin/external-report/report-view';
import { ReportOrderActions } from '../report-order-actions';

export const metadata: Metadata = { title: '랜딩 주문 상세 (admin)', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
const fmt = (iso: string | null) => (iso ? KST.format(new Date(iso)) : '—');

export default async function ReportOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await getCurrentAdminRole(await createClient());
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await getReportOrder(id);
  if (!order) notFound();
  const saved = order.externalReportId ? await getExternalReport(order.externalReportId).catch(() => null) : null;
  const b = order.birth;
  const slot = b ? HOUR_SLOTS.find((s) => s.hour === b.hour && s.minute === b.minute) : null;
  const birthText = b
    ? `${b.calendarType === 'lunar' ? '음력' : '양력'} ${b.year}.${b.month}.${b.day} · ${b.unknownBirthTime ? '시간 모름' : slot?.label ?? `${b.hour}:${b.minute}`} · ${b.gender === 'female' ? '여성' : '남성'}`
    : '(보관 기간이 지나 삭제됨)';
  const rows: [string, string][] = [
    ['상품', `${REPORT_PRODUCT_LABEL[order.product]} · ${order.amount.toLocaleString('ko-KR')}원`],
    ['결제', order.payMethod === 'bank' ? `무통장${order.cashReceipt ? ' · 현금영수증 신청' : ''}` : '카드(나이스페이)'],
    ['상태', REPORT_STATUS_LABEL[order.status]],
    ['이름', order.name ?? '—'],
    ['출생', birthText],
    ['휴대폰', order.phone ?? '—'],
    ['이메일', order.email ?? '—'],
    ['남기실 말', order.memo ?? '—'],
    ['접수', fmt(order.createdAt)],
    ['입금 기한', order.payMethod === 'bank' ? fmt(order.depositDueAt) : '—'],
    ['발송', order.sentAt ? `${fmt(order.sentAt)} · 문자 ${order.sendResult?.sms ? '성공' : '실패'} · 메일 ${order.sendResult?.email ? '성공' : '실패'}` : '—'],
    ['환불 메모', order.refundNote ?? '—'],
  ];

  return (
    <AdminPage title={`랜딩 주문 ${order.orderNo}`} description="풀이를 끝까지 읽어 보고 이상이 없을 때만 발송하세요.">
      <p className="mb-4 text-sm"><Link className="underline" href="/admin/report-orders">← 목록</Link></p>
      <dl className="mb-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (<Fragment key={k}><dt className="font-semibold text-gray-600">{k}</dt><dd className="break-all">{v}</dd></Fragment>))}
      </dl>
      <div className="mb-6">
        <ReportOrderActions id={order.id} status={order.status} payMethod={order.payMethod} />
      </div>
      {order.status === 'sent' && order.resultToken ? (
        <p className="mb-6 text-sm">손님 결과 링크: <a className="underline" href={`${CANONICAL_SITE_URL}/r/${order.resultToken}`} target="_blank" rel="noreferrer">열기</a></p>
      ) : null}
      {saved ? (
        <section aria-label="풀이 미리보기" className="rounded-lg border border-gray-200 bg-white p-2">
          {saved.report.generationWarning ? (
            <p role="alert" className="mb-2 rounded bg-amber-50 p-3 text-sm text-amber-900">
              주의: {saved.report.generationWarning} — 일부가 기본 문구로 채워졌습니다. &quot;다시 만들기&quot;를 권합니다.
            </p>
          ) : null}
          <ExternalReportView report={saved.report} />
        </section>
      ) : null}
    </AdminPage>
  );
}
