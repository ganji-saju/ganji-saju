/**
 * 정책 본문이 DB 에 입력되지 않은 경우의 fallback — Phase 3-B (2026-05-18).
 *
 * 사용자 directive: "준비 중", "TBD", "임시" 노출 금지.
 * → "관련 안내는 고객센터로 문의" + CS 정보 + 사업자 정보 표시.
 *
 * 해당 페이지는 noindex + nofollow 으로 검색엔진 노출 차단 (페이지에서 직접 설정).
 */

import Link from 'next/link';
import { BUSINESS_INFO } from '@/lib/business-info';
import { POLICY_LABELS, type PolicyKind } from '@/shared/policies/types';

interface PolicyNotReadyProps {
  kind: PolicyKind;
}

export function PolicyNotReady({ kind }: PolicyNotReadyProps) {
  return (
    <article
      className="policy-not-ready space-y-4"
      data-policy-kind={kind}
      data-policy-state="not-ready"
    >
      <header className="space-y-1">
        <h1 className="text-[23px] font-extrabold leading-tight text-[var(--app-ink)]">
          {POLICY_LABELS[kind]}
        </h1>
      </header>

      <p
        className="text-[16.1px] leading-[1.8] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        해당 정책의 상세 안내는 아래 고객센터를 통해 직접 안내드리고 있습니다. 결제 또는
        서비스 이용 전 궁금하신 점이 있으시면 부담 없이 문의해 주세요.
      </p>

      <section
        className="rounded-[14px] border bg-white p-4 text-[15px] leading-[1.7] text-[var(--app-copy)]"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <h2 className="mb-2 text-[13.8px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          고객센터 안내
        </h2>
        {BUSINESS_INFO.phone && (
          <div>
            <span className="text-[var(--app-copy-muted)]">전화 </span>
            <a href={`tel:${BUSINESS_INFO.phone}`} className="font-bold text-[var(--app-ink)]">
              {BUSINESS_INFO.phone}
            </a>
          </div>
        )}
        {BUSINESS_INFO.email && (
          <div>
            <span className="text-[var(--app-copy-muted)]">이메일 </span>
            <a
              href={`mailto:${BUSINESS_INFO.email}`}
              className="font-bold text-[var(--app-ink)]"
            >
              {BUSINESS_INFO.email}
            </a>
          </div>
        )}
        {BUSINESS_INFO.csHours && (
          <div>
            <span className="text-[var(--app-copy-muted)]">운영시간 </span>
            <span>{BUSINESS_INFO.csHours}</span>
          </div>
        )}
      </section>

      <p className="text-[13.8px] leading-[1.7] text-[var(--app-copy-muted)]">
        본 페이지는 검색엔진에 노출되지 않습니다. 정식 안내는 운영자가 등록 후 게시됩니다.
        다른 정책은{' '}
        <Link href="/terms" className="underline">
          이용약관
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>{' '}
        에서 확인하실 수 있습니다.
      </p>
    </article>
  );
}
