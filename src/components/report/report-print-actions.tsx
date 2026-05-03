'use client';

import Link from 'next/link';
import { Download, Printer } from 'lucide-react';
import { trackMoonlightEvent } from '@/lib/analytics';

interface ReportPrintActionsProps {
  slug: string;
  backHref: string;
}

export function ReportPrintActions({ slug, backHref }: ReportPrintActionsProps) {
  function handlePrint() {
    trackMoonlightEvent('report_pdf_click', {
      slug,
      from: 'lifetime_print_page',
      status: 'print_dialog_open',
    });
    window.print();
  }

  return (
    <div className="pdf-print-actions sticky top-4 z-20 mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--app-line)] bg-[rgba(8,10,18,0.92)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur">
      <div>
        <div className="app-caption text-[var(--app-gold-soft)]">PDF 저장</div>
        <p className="mt-1 text-sm text-[var(--app-copy-muted)]">
          버튼을 누른 뒤 인쇄 창에서 “PDF로 저장”을 선택하세요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="moon-action-primary"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          PDF로 저장
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="moon-action-secondary"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          인쇄
        </button>
        <Link
          href={backHref}
          className="moon-action-muted"
        >
          리포트로 돌아가기
        </Link>
      </div>
    </div>
  );
}
