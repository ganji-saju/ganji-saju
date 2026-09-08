'use client';

/**
 * 결제 전 동의 — Phase 3-C-1 (2026-05-18).
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
 *   전체에 대한 동의로 간주되어 acceptedKinds 로 kinds 전체가 올라가고, prepare 가 각
 *   policy_version 별로 user_policy_consents 행을 기록한다(전자상거래법상 청약철회·디지털
 *   콘텐츠 고지 동의 입증 유지). 그래서 각 항목의 링크도 체크박스와 **같은 자리**에 남긴다 —
 *   동의 대상을 화면에서 확인할 수 없으면 통합 동의의 유효성이 약해진다.
 *
 * 2026-09-09 — 사용자 요청("동의체크박스를 결제버튼 바로 옆으로")으로 **두 조각으로 나눴다**:
 *   - `PaymentConsentRow`     : 체크박스 + 문장 + 약관 링크 → 하단 고정 결제바 안(버튼 바로 위)
 *   - `PaymentConsentDetails` : 제목 + 주문 요약 + 카카오 알림 필드 → 페이지 본문
 *   상태는 `usePaymentConsent` 훅으로 부모가 소유한다(한 곳에서만 관리 → 두 조각이 항상 일치).
 *   이 분리로 기존의 onValidChange ref 우회(무한 렌더 방지 장치)가 통째로 필요 없어졌다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { POLICY_LABELS, POLICY_URLS, type PolicyKind } from '@/shared/policies/types';
import {
  findMissingConsents,
  getConsentItems,
  type ConsentItemMeta,
} from '@/shared/payments/consent-rules';
import type { PaymentPackage } from '@/lib/payments/catalog';
import { KakaoContactCheckoutField } from '@/features/account/kakao-contact-checkout-field';

export interface PaymentConsentState {
  items: ConsentItemMeta[];
  allAccepted: boolean;
  toggleAll: () => void;
  /** 필수 동의가 모두 채워졌는가(결제 버튼 활성 조건). */
  valid: boolean;
  /** prepare API 로 올릴 동의 항목 — 감사기록용으로 4종 전체가 그대로 간다. */
  acceptedKinds: PolicyKind[];
}

/** 동의 상태 단일 소유자. 체크박스 행과 결제 버튼이 같은 상태를 본다. */
export function usePaymentConsent(pkg: PaymentPackage | undefined): PaymentConsentState {
  const items = useMemo<ConsentItemMeta[]>(() => (pkg ? getConsentItems(pkg) : []), [pkg]);
  const [accepted, setAccepted] = useState<Set<PolicyKind>>(() => new Set());

  // 상품이 바뀌면 동의를 리셋한다(다른 상품에 대한 동의를 이어받지 않는다).
  const pkgId = pkg?.id;
  useEffect(() => {
    setAccepted(new Set());
  }, [pkgId]);

  const allAccepted = items.length > 0 && items.every((it) => accepted.has(it.kind));

  // 단일 체크 = 필수 항목 전체 동의/해제. 개별 토글은 UI 에서 사라졌지만 상태는 여전히
  //   kind 집합이라 서버 계약(acceptedKinds[])과 감사기록은 이전과 동일하다.
  const toggleAll = useCallback(() => {
    setAccepted((prev) => {
      const full = items.length > 0 && items.every((it) => prev.has(it.kind));
      return full ? new Set<PolicyKind>() : new Set(items.map((it) => it.kind));
    });
  }, [items]);

  const acceptedKinds = useMemo(() => Array.from(accepted), [accepted]);
  const valid = pkg ? findMissingConsents(pkg, acceptedKinds).length === 0 : false;

  return { items, allAccepted, toggleAll, valid, acceptedKinds };
}

/**
 * 체크박스 + 문장 + 약관 링크. **결제 버튼 바로 위**(하단 고정바 안)에 놓인다 —
 * 결제하려고 버튼을 볼 때 동의도 같은 자리에 있어야 스크롤 왕복이 없다.
 *
 * ⚠️ 링크 4개는 반드시 체크박스와 함께 둔다(파일 상단 주석의 법적 제약).
 * ⚠️ 버튼보다 **위**다. 전자상거래법상 동의는 결제 행위보다 앞서야 하고, 화면 순서도
 *   그 흐름을 따른다(2026-06-30 주석에서 지켜온 제약).
 */
export function PaymentConsentRow({
  items,
  allAccepted,
  onToggleAll,
}: {
  items: ConsentItemMeta[];
  allAccepted: boolean;
  onToggleAll: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="payment-consent-row mb-2">
      {/* 🔴 탭 영역은 글자 크기와 따로 논다. 문장을 10px 로 줄였다고 체크박스까지 15px 로
          두면 손가락으로 못 누른다(사용자 신고). 체크박스 자체를 20px 로 키우고, label 이
          체크박스+문장을 감싸므로 **행 전체(min-height 44px)** 가 탭 영역이 된다
          — 모바일 최소 터치 타깃 권장치(44px)를 행으로 확보한다. */}
      <label
        className="flex cursor-pointer items-center gap-2.5"
        style={{ minHeight: '44px' }}
      >
        <input
          type="checkbox"
          checked={allAccepted}
          onChange={onToggleAll}
          className="h-[20px] w-[20px] shrink-0 accent-[var(--app-pink)]"
          aria-label="주문 내용 확인 및 필수 약관 전체 동의"
          required
        />
        <span
          className="flex-1 font-semibold text-[var(--app-ink)]"
          style={{ fontSize: '11px', lineHeight: 1.4 }}
        >
          주문 내용과 아래 약관을 확인했고 결제에 동의합니다.
        </span>
      </label>

      {/* 동의 대상 링크 — 통합 동의라도 각 정책을 이 자리에서 열람할 수 있어야 한다.
          🔴 li 에도 인라인 크기를 준다. readability.css(@layer 밖)가 li 태그를 본문
          크기로 되돌려, 글자만 줄이면 줄 상자가 17px 로 남아 간격만 벌어진다. */}
      <ul className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 pl-[23px] leading-[1.35]">
        {items.map((it) => (
          <li key={it.kind} style={{ fontSize: '8.5px', lineHeight: 1.35 }}>
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
    </div>
  );
}

/** 제목 + 주문 요약 + 카카오 알림 필드. 페이지 본문에 남는다(고정바에 넣기엔 크다). */
export function PaymentConsentDetails({
  confirmationItems = [],
}: {
  confirmationItems?: readonly string[];
}) {
  return (
    <section
      aria-label="결제 전 확인"
      className="payment-consent space-y-3 rounded-[14px] border bg-white p-4"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <h3 className="text-[15px] font-extrabold text-[var(--app-ink)]">결제 전 확인</h3>

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

      {/* 선택 — 결제완료 알림톡 도달률용 전화번호 수집. 결제를 막지 않음(필수 아님). */}
      <KakaoContactCheckoutField />
    </section>
  );
}
