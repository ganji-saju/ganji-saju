'use client';

/**
 * 결제 전 동의 체크박스 — Phase 3-C-1 (2026-05-18).
 *
 * 사용처: credits / membership/checkout / saju 페이지의 lifetime-report 결제 / today-detail 결제 등
 * 결제 prepare API 호출 전 사용자가 필수 동의 체크해야 결제 진행 가능.
 *
 * 검증은 src/lib/payments/consent.ts 의 findMissingConsents 에서.
 * prepare API 가 acceptedKinds 받아서 서버에서도 한 번 더 검증.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { POLICY_URLS, type PolicyKind } from '@/shared/policies/types';
import {
  findMissingConsents,
  getConsentItems,
  type ConsentItemMeta,
} from '@/shared/payments/consent-rules';
import type { PaymentPackage } from '@/lib/payments/catalog';

interface Props {
  pkg: PaymentPackage;
  onValidChange?: (valid: boolean, acceptedKinds: PolicyKind[]) => void;
  /** master checkbox 초기값 (보통 false). */
  defaultAllAccepted?: boolean;
  confirmationItems?: readonly string[];
}

export function PaymentConsentCheckboxes({
  pkg,
  onValidChange,
  defaultAllAccepted = false,
  confirmationItems = [],
}: Props) {
  const items = useMemo<ConsentItemMeta[]>(() => getConsentItems(pkg), [pkg]);
  const [accepted, setAccepted] = useState<Set<PolicyKind>>(() =>
    defaultAllAccepted ? new Set(items.map((it) => it.kind)) : new Set()
  );

  // pkg 변경 시 reset
  useEffect(() => {
    setAccepted(defaultAllAccepted ? new Set(items.map((it) => it.kind)) : new Set());
  }, [pkg.id, defaultAllAccepted, items]);

  // onValidChange 콜백을 ref 로 고정한다.
  //   부모가 매 렌더 새 인라인 콜백을 넘겨도(예: TossMembershipCheckout) notify effect 가
  //   콜백 identity 변화로 재실행되지 않도록 한다. 콜백이 setState(새 배열)을 호출하면
  //   부모 재렌더 → 새 콜백 → effect 재실행 → 무한 렌더("Maximum update depth exceeded")로 이어졌다.
  const onValidChangeRef = useRef(onValidChange);
  useEffect(() => {
    onValidChangeRef.current = onValidChange;
  });

  // 부모에 valid 상태 + 체크된 kinds 전달 — accepted/pkg 가 실제로 바뀔 때만.
  useEffect(() => {
    const notify = onValidChangeRef.current;
    if (!notify) return;
    const missing = findMissingConsents(pkg, Array.from(accepted));
    notify(missing.length === 0, Array.from(accepted));
  }, [accepted, pkg]);

  const allAccepted = items.every((it) => accepted.has(it.kind));

  const toggleAll = () => {
    if (allAccepted) {
      setAccepted(new Set());
    } else {
      setAccepted(new Set(items.map((it) => it.kind)));
    }
  };

  const toggle = (kind: PolicyKind) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <section
      aria-label="결제 전 동의"
      className="payment-consent space-y-3 rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <h3 className="text-[13px] font-extrabold text-[var(--app-ink)]">결제 전 확인</h3>

      {confirmationItems.length > 0 ? (
        <ul className="rounded-[12px] bg-[var(--app-pink-soft)] px-3 py-2.5 text-[11.5px] leading-[1.55] text-[var(--app-copy-muted)]">
          {confirmationItems.map((item) => (
            <li key={item} className="flex gap-1.5">
              <span aria-hidden="true">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2 border-b pb-2.5">
        <input
          type="checkbox"
          checked={allAccepted}
          onChange={toggleAll}
          className="mt-0.5 h-4 w-4"
          aria-label="모든 항목 확인 및 동의"
        />
        <span className="text-[13px] font-bold text-[var(--app-ink)]">
          아래 항목 모두 확인 및 동의
        </span>
      </label>

      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it.kind}>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={accepted.has(it.kind)}
                onChange={() => toggle(it.kind)}
                className="mt-0.5 h-4 w-4"
                aria-label={it.label}
                required
              />
              <span className="flex-1">
                <span className="block text-[13px] font-bold text-[var(--app-ink)]">
                  [필수] {it.label}{' '}
                  <Link
                    href={POLICY_URLS[it.kind]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-[11px] font-normal text-[var(--app-pink-strong)] underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    전문 보기
                  </Link>
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-[1.5] text-[var(--app-copy-muted)]">
                  {it.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-[1.5] text-[var(--app-copy-muted)]">
        모든 필수 항목 확인 후 결제 버튼이 활성화됩니다. 동의 시점은 본인 식별 정보와 함께
        안전하게 기록됩니다 (IP 원문은 저장하지 않습니다).
      </p>
    </section>
  );
}
