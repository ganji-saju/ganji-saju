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
    // 2026-08-29 — `top-4` 는 상단 메뉴 높이를 안 보던 값이라 PC 에서 이 바가 메가내브
    //   밑으로 파고들어 버튼이 잘렸다(서브헤더 #698 과 같은 원인). 이 페이지는
    //   header={false} 라 모바일엔 헤더가 없고 PC 에만 mega-nav 가 선다 —
    //   StickyHeaderOffset 이 흘리는 실측 높이를 쓰면 두 경우가 한 식으로 맞는다.
    // 2026-08-29 — 이 바만 개편 전 어두운 슬래브(rgba(8,10,18,.92)) + 옛 핑크 글씨(#f7a8cc)로
    //   남아 있었다. 문서는 한지 톤인데 바만 검어서 화면에서 이물처럼 떴다. 주변과 같은
    //   한지 카드로 맞추고 강조는 인주 한 곳(라벨)에만 둔다.
    <div className="pdf-print-actions sticky top-[calc(var(--app-header-height,0px)+1rem)] z-20 mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--app-line)] bg-[var(--app-surface-strong)] p-3 shadow-[0_18px_42px_-24px_rgba(28,26,23,0.38)] backdrop-blur">
      <div>
        <div className="app-caption font-bold text-[var(--app-pink-strong)]">PDF 저장</div>
        <p className="mt-1 text-base text-[var(--app-copy-muted)]">
          버튼을 누른 뒤 인쇄 창에서 “PDF로 저장”을 선택하세요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="gangi-primary-button"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          PDF로 저장
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="gangi-secondary-button"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          인쇄
        </button>
        <Link
          href={backHref}
          className="gangi-secondary-button"
        >
          리포트로 돌아가기
        </Link>
      </div>
    </div>
  );
}
