// 카드 결제 뒤 나이스페이 return 이 보내는 완료 화면(reportOrderResultHref). 주문자 개인정보는 보여 주지 않는다.
import type { Metadata } from 'next';
import { getReportOrderByPaymentOrder } from '@/lib/report-orders/report-order-store';
import styles from '../saju-report.module.css';

export const metadata: Metadata = { title: { absolute: '간지사주 — 신청 완료' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PAID = new Set(['paid', 'generated', 'sent']);

export default async function SajuReportCompletePage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const found = order && /^[A-Za-z0-9_-]{6,64}$/.test(order)
    ? await getReportOrderByPaymentOrder(order).catch(() => null)
    : null;
  const paid = found && PAID.has(found.status);

  return (
    <div className={styles.page}>
      <a className={styles.header} href="/saju-report">간지사주</a>
      <section className={styles.section}>
        {paid ? (
          <>
            <h1 className={styles.h1}>결제가 완료됐어요</h1>
            <p className={styles.p}>상담사가 풀이를 확인한 뒤, 영업일 1~2일 안에 입력하신 휴대폰과 이메일로 풀이 링크를 보내 드려요.</p>
            <p className={styles.box}>주문번호 <strong>{found.orderNo}</strong></p>
          </>
        ) : (
          <>
            <h1 className={styles.h1}>결제를 확인하고 있어요</h1>
            <p className={styles.p}>결제가 끝났다면 곧 접수 문자가 도착해요. 영업일 1~2일 안에 풀이를 보내 드려요. 문자가 오지 않으면 고객센터로 알려 주세요.</p>
          </>
        )}
        <p className={styles.small}><a href="/saju-report">처음 화면으로</a></p>
      </section>
    </div>
  );
}
