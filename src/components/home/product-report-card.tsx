import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ProductReportCardData } from '@/content/report-catalog';

interface ProductReportCardProps {
  item: ProductReportCardData;
}

export function ProductReportCard({ item }: ProductReportCardProps) {
  return (
    <article className="app-panel-muted flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="app-caption">고민별 리포트</div>
          <h3 className="mt-3 text-2xl text-[var(--app-ivory)]">{item.title}</h3>
        </div>
        {item.badge ? (
          <span className="rounded-full border border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 px-3 py-1 text-xs text-[var(--app-gold-text)]">
            {item.badge}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{item.summary}</p>

      <div className="mt-5 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
        <div className="app-caption">추천 대상</div>
        <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{item.recommendation}</p>
      </div>

      <div className="mt-4 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
        <div className="app-caption">확인 내용</div>
        <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{item.whatToCheck}</p>
      </div>

      <div className="mt-5 pt-1">
        <Link
          href={item.href}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
        >
          이 리포트 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
