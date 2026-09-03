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
    // 2026-09-03 — 모바일에서 버튼 3개가 3줄로 쌓여(전역 .gangi-*-button 이 width:100%)
    //   sticky 바가 문서를 1/3 가까이 가렸다. 버튼은 3칸 그리드로 한 줄에 넣고,
    //   패딩·글자·아이콘을 모바일에서만 줄여 바 높이를 낮춘다. 폭/크기 override 는
    //   responsive-print.css 의 `.pdf-print-actions .gangi-*-button` — 전역 버튼 규칙이
    //   레이어 밖이라 Tailwind 유틸리티로는 못 이긴다.
    <div className="pdf-print-actions sticky top-[calc(var(--app-header-height,0px)+1rem)] z-20 mx-auto flex max-w-4xl flex-col gap-2 rounded-[1.25rem] border border-[var(--app-line)] bg-[var(--app-surface-strong)] p-2.5 shadow-[0_18px_42px_-24px_rgba(28,26,23,0.38)] backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:p-3">
      <div>
        <div className="app-caption font-bold text-[var(--app-pink-strong)]">PDF 저장</div>
        <p className="mt-0.5 text-[0.72rem] leading-snug text-[var(--app-copy-muted)] sm:mt-1 sm:text-base">
          인쇄 창에서 “PDF로 저장”을 선택하세요.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="gangi-primary-button"
        >
          <Download className="hidden h-4 w-4 sm:block" aria-hidden="true" />
          PDF로 저장
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="gangi-secondary-button"
        >
          <Printer className="hidden h-4 w-4 sm:block" aria-hidden="true" />
          인쇄
        </button>
        <Link
          href={backHref}
          className="gangi-secondary-button"
        >
          <span className="hidden sm:inline">리포트로&nbsp;</span>돌아가기
        </Link>
      </div>
    </div>
  );
}
