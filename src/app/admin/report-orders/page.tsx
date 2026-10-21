import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { listReportOrders, sumConfirmedBankDeposits, type ReportOrderFilter } from '@/lib/report-orders/report-order-store';
import { REPORT_PRODUCT_LABEL, REPORT_STATUS_LABEL } from '@/lib/report-orders/report-order';

export const metadata: Metadata = { title: '랜딩 주문 (admin)', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const FILTERS: { id: ReportOrderFilter; label: string }[] = [
  { id: 'awaiting_deposit', label: '입금 대기' },
  { id: 'paid', label: '풀이 만들 차례' },
  { id: 'generated', label: '확인·발송 대기' },
  { id: 'sent', label: '발송 완료' },
  { id: 'closed', label: '취소·환불·미결제' },
];
const KST = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function monthStartKst(now = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  return `${kst.toISOString().slice(0, 7)}-01T00:00:00+09:00`;
}

export default async function ReportOrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const guard = await getCurrentAdminRole(await createClient());
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === sp.filter)?.id ?? 'paid';
  const page = sp.page && /^\d+$/.test(sp.page) ? Number(sp.page) : 1;
  let list;
  let bank;
  try {
    [list, bank] = await Promise.all([listReportOrders(filter, page), sumConfirmedBankDeposits(monthStartKst())]);
  } catch {
    return (
      <AdminPage title="랜딩 주문">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          주문을 불러오지 못했습니다. 마이그레이션 091 적용 여부를 확인하고 새로고침해 주세요.
        </p>
      </AdminPage>
    );
  }
  const now = Date.now();

  return (
    <AdminPage title="랜딩 주문" description="/saju-report 비회원 주문 — 입금 확인 → 풀이 만들기 → 내용 확인 → 발송">
      <p className="mb-4 text-sm text-gray-700">
        이번 달 무통장 입금 확인: {bank.count}건 · {bank.amount.toLocaleString('ko-KR')}원
        <span className="text-gray-500"> (카드 결제는 대시보드 매출에 포함, 무통장은 여기만)</span>
      </p>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="주문 상태">
        {FILTERS.map((f) => (
          <Link key={f.id} href={`/admin/report-orders?filter=${f.id}`}
            className={f.id === filter ? 'rounded-full bg-gray-900 px-3 py-1 text-sm text-white' : 'rounded-full border border-gray-300 px-3 py-1 text-sm'}>
            {f.label}
          </Link>
        ))}
      </nav>
      {list.items.length === 0 ? (
        <p className="text-sm text-gray-600">해당하는 주문이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr><th className="py-2">주문번호</th><th>상품</th><th>금액</th><th>결제</th><th>상태</th><th>이름</th><th>접수</th></tr>
            </thead>
            <tbody>
              {list.items.map((o) => {
                const overdue = o.status === 'awaiting_deposit' && o.depositDueAt && Date.parse(o.depositDueAt) < now;
                return (
                  <tr key={o.id} className="border-b">
                    <td className="py-2"><Link className="underline" href={`/admin/report-orders/${o.id}`}>{o.orderNo}</Link></td>
                    <td>{REPORT_PRODUCT_LABEL[o.product]}</td>
                    <td>{o.amount.toLocaleString('ko-KR')}원</td>
                    <td>{o.payMethod === 'bank' ? '무통장' : '카드'}</td>
                    <td>{REPORT_STATUS_LABEL[o.status]}{overdue ? <span className="ml-1 font-semibold text-red-700">기한 지남</span> : null}</td>
                    <td>{o.name ?? '(삭제됨)'}</td>
                    <td>{KST.format(new Date(o.createdAt))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex gap-3 text-sm">
        {page > 1 ? <Link className="underline" href={`/admin/report-orders?filter=${filter}&page=${page - 1}`}>이전</Link> : null}
        {list.hasMore ? <Link className="underline" href={`/admin/report-orders?filter=${filter}&page=${page + 1}`}>다음</Link> : null}
      </div>
    </AdminPage>
  );
}
