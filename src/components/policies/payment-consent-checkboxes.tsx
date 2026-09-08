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
      <h3 className="text-[9.5px] font-extrabold text-[var(--app-ink)]">결제 전 확인</h3>

      {/* 🔴 readability.css(@layer 밖)가 작은 글씨를 강제로 키운다:
            ① `:where(p, li, dt, dd, label, …)` → 본문 크기  ② `text-[10`~`text-[15`
            로 시작하는 클래스 → !important 부양. 그래서 li 에 text-[9px] 를 줘도
            17px 로 렌더된다(2026-09-09 실측). li 는 인라인 스타일로만 이긴다. */}
      {confirmationItems.length > 0 ? (
        <ul className="rounded-[12px] bg-[var(--app-pink-soft)] px-3 py-2 text-[var(--app-copy-muted)]">
          {confirmationItems.map((item) => (
            <li key={item} style={{ fontSize: '9px', lineHeight: 1.45 }} className="flex gap-1.5">
              <span aria-hidden="true">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 2026-09-09 — 문안 최소화(사용자 요청: "최소문장으로 확 줄여줘").
          ⚠️ 줄인 것은 **문장뿐**이다. 동의 대상 4종 링크는 바로 아래 그대로 남는다 —
          동의 대상을 화면에서 확인할 수 없으면 통합 동의의 유효성이 약해진다(파일 상단 주석).
          서버 감사기록(user_policy_consents 4행)도 종전과 동일하다. */}
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={allAccepted}
          onChange={toggleAll}
          className="mt-[1px] h-[14px] w-[14px] shrink-0"
          aria-label="주문 내용 확인 및 필수 약관 전체 동의"
          required
        />
        <span className="flex-1 text-[9px] font-semibold leading-[1.45] text-[var(--app-ink)]">
          주문 내용과 아래 약관을 확인했고 결제에 동의합니다.
        </span>
      </label>

      {/* 동의 대상 전문 링크 — 통합 동의라도 각 정책을 화면에서 열람할 수 있어야 한다. */}
      <ul className="flex flex-wrap gap-x-2.5 gap-y-1 pl-[23px]">
        {items.map((it) => (
          <li key={it.kind}>
            <Link
              href={POLICY_URLS[it.kind]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[8.5px] text-[var(--app-pink-strong)] underline"
            >
              {POLICY_LABELS[it.kind]}
            </Link>
          </li>
        ))}
      </ul>

      {/* 선택 — 결제완료 알림톡 도달률용 전화번호 수집. 결제를 막지 않음(필수 아님). */}
      <KakaoContactCheckoutField />
    </section>
  );
}
