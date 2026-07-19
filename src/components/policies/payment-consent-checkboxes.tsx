'use client';

/**
 * 결제 전 동의 체크박스 — Phase 3-C-1 (2026-05-18).
 *
 * 사용처: membership/checkout 의 TossMembershipCheckout (현재 유일 소비처).
 * 결제 prepare API 호출 전 사용자가 필수 동의 체크해야 결제 진행 가능.
 *
 * 검증은 src/lib/payments/consent.ts 의 findMissingConsents 에서.
 * prepare API 가 acceptedKinds 받아서 서버에서도 한 번 더 검증.
 *
 * 2026-07-18 — 체크박스 5개(전체동의 + 필수 4종) → **1개**로 통합(20260718 PPTX slide8,
 *   사주아이 벤치마크 "이렇게 짧게 가능?").
 *   ⚠️ 핵심 제약: UI 만 줄이고 **법적 감사기록은 그대로 4종을 남긴다**. 체크 1회가 필수 항목
 *   전체에 대한 동의로 간주되어 onValidChange 로 kinds 전체가 올라가고, prepare 가 각
 *   policy_version 별로 user_policy_consents 행을 기록한다(전자상거래법상 청약철회·디지털
 *   콘텐츠 고지 동의 입증 유지). 그래서 각 항목의 "전문 보기" 링크도 문안 안에 모두 남긴다 —
 *   동의 대상을 화면에서 확인할 수 없으면 통합 동의의 유효성이 약해진다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { POLICY_LABELS, POLICY_URLS, type PolicyKind } from '@/shared/policies/types';
import {
  findMissingConsents,
  getConsentItems,
  type ConsentItemMeta,
} from '@/shared/payments/consent-rules';
import type { PaymentPackage } from '@/lib/payments/catalog';
import { KakaoContactCheckoutField } from '@/features/account/kakao-contact-checkout-field';

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

  const allAccepted = items.length > 0 && items.every((it) => accepted.has(it.kind));

  // 단일 체크 = 필수 항목 전체 동의/해제. 개별 토글은 UI 에서 사라졌지만 상태는 여전히
  //   kind 집합이라 서버 계약(acceptedKinds[])과 감사기록은 이전과 동일하다.
  const toggleAll = () => {
    setAccepted(allAccepted ? new Set() : new Set(items.map((it) => it.kind)));
  };

  return (
    <section
      aria-label="결제 전 동의"
      className="payment-consent space-y-3 rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <h3 className="text-[15px] font-extrabold text-[var(--app-ink)]">결제 전 확인</h3>

      {confirmationItems.length > 0 ? (
        <ul className="rounded-[12px] bg-[var(--app-pink-soft)] px-3 py-2.5 text-[13.2px] leading-[1.55] text-[var(--app-copy-muted)]">
          {confirmationItems.map((item) => (
            <li key={item} className="flex gap-1.5">
              <span aria-hidden="true">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={allAccepted}
          onChange={toggleAll}
          className="mt-0.5 h-[18px] w-[18px] shrink-0"
          aria-label="주문 내용 확인 및 필수 약관 전체 동의"
          required
        />
        <span className="flex-1 text-[14.4px] font-semibold leading-[1.55] text-[var(--app-ink)]">
          {/* it.label 은 "이용약관 확인 및 동의"처럼 서술어가 붙어 있어 문장에 이어 붙이면
              "…확인 및 동의에 동의합니다"가 된다. 문장에는 정책 이름(POLICY_LABELS)만 쓴다. */}
          위 주문 내용을 확인하였으며,{' '}
          {items.map((it) => POLICY_LABELS[it.kind]).join(', ')} 및 결제에 동의합니다.
        </span>
      </label>

      {/* 동의 대상 전문 링크 — 통합 동의라도 각 정책을 화면에서 열람할 수 있어야 한다. */}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 pl-[28px]">
        {items.map((it) => (
          <li key={it.kind}>
            <Link
              href={POLICY_URLS[it.kind]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.6px] text-[var(--app-pink-strong)] underline"
            >
              {POLICY_LABELS[it.kind]} 전문
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-[12.6px] leading-[1.5] text-[var(--app-copy-muted)]">
        동의 후 결제 버튼이 활성화됩니다. 동의 시점은 본인 식별 정보와 함께 항목별로 안전하게
        기록됩니다 (IP 원문은 저장하지 않습니다).
      </p>

      {/* 선택 — 결제완료 알림톡 도달률용 전화번호 수집. 결제를 막지 않음(필수 아님). */}
      <KakaoContactCheckoutField />
    </section>
  );
}
