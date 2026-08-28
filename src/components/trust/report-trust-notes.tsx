// 2026-08-24 전면 개편 Phase 0 — 결제 전 신뢰 요소(수정요청 PPT 1차).
//   방문자의 3가지 의문에 결제 버튼 근처에서 바로 답한다:
//   ② "다른 무료 사주랑 뭐가 다르지?"  → 전문 자격 5종(PPT 6안 명기)
//   ③ "결과가 얼마나 자세하지?"        → 샘플 리포트 링크(/sample-report, Phase 0 에서 잠금 해제)
//   ⑤ "별 내용 없으면 어떡하지?"       → 열람 전 전액 환불(환불 정책 §"제공 시작 전 청약철회" 요약)
//   사용처: /saju/new(입력 전) · /membership/checkout(결제 직전). 순수 표시 컴포넌트.

import Link from 'next/link';

/** PPT 6안에 명기된 보유 자격 5종 — 문구 수정 시 PPT 원문과 대조할 것. */
const CREDENTIALS =
  '명리심리상담사 1급 · 사주적성상담사 1급 · 타로심리상담사 1급 · 빅데이터전문가 1급 · 명리심리상담사 2급';

export function ReportTrustNotes({ className = '' }: { className?: string }) {
  return (
    <section
      aria-label="풀이 신뢰 안내"
      className={`rounded-[16px] border border-[var(--app-line)] bg-white p-4 ${className}`.trim()}
    >
      <ul className="m-0 grid list-none gap-2.5 p-0">
        <li className="text-[14.4px] leading-[1.62] text-[var(--app-copy-soft)]">
          <strong className="font-extrabold text-[var(--app-ink)]">전문 자격 5종 보유.</strong>{' '}
          {CREDENTIALS}. 재미용 운세가 아니라 명리학 기준으로 해석합니다.
        </li>
        <li className="text-[14.4px] leading-[1.62] text-[var(--app-copy-soft)]">
          <strong className="font-extrabold text-[var(--app-ink)]">얼마나 자세한지 먼저 보세요.</strong>{' '}
          <Link href="/sample-report" className="font-bold text-[var(--app-pink-strong)]">
            샘플 리포트 미리 보기 →
          </Link>
        </li>
        <li className="text-[14.4px] leading-[1.62] text-[var(--app-copy-soft)]">
          <strong className="font-extrabold text-[var(--app-ink)]">열람 전엔 전액 환불.</strong>{' '}
          리포트를 열람하기 전에는 전액 환불을 요청할 수 있어요.{' '}
          <Link href="/refund-policy" className="font-bold text-[var(--app-pink-strong)]">
            환불 정책
          </Link>
        </li>
      </ul>
    </section>
  );
}
