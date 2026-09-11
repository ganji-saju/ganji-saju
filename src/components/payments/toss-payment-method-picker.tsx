'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import {
  paymentMethodOptionsFor,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import { cn } from '@/lib/utils';

interface TossPaymentMethodPickerProps {
  value: TossPaymentMethodCode;
  onChange: (method: TossPaymentMethodCode) => void;
  className?: string;
  provider?: 'toss' | 'nicepay';
}

/**
 * 간편결제 브랜드 마크. currentColor 를 쓰므로 버튼의 fg 색을 그대로 따라간다.
 *
 * ⚠️ 공식 CI 에셋이 아니라 **형태를 본뜬 인라인 SVG** 다(외부 이미지는 CSP 로 막혀 있고
 *   각 사 로고 파일도 없다). 각 사에서 공식 결제버튼 에셋을 받으면 교체할 것 —
 *   브랜드 가이드상 로고는 원본 사용이 원칙이다.
 */
const BRAND_MARKS: Partial<Record<TossPaymentMethodCode, ReactNode>> = {
  // 카카오 말풍선
  KAKAOPAY: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M12 3.6c-4.8 0-8.7 3-8.7 6.8 0 2.4 1.6 4.5 4 5.7l-.9 3.4c-.1.3.2.6.5.4l4-2.6c.4 0 .7.1 1.1.1 4.8 0 8.7-3 8.7-6.8S16.8 3.6 12 3.6Z" />
    </svg>
  ),
  // 네이버 N
  NAVERPAY: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M5 4h5.1l3.6 5.6V4H19v16h-5.1l-3.6-5.6V20H5V4Z" />
    </svg>
  ),
  // 삼성페이 — 카드 글리프(공식 워드마크 대체)
  SAMSUNGPAY: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5V8H3V6.5ZM3 10h18v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5V10Zm3 5.5h5v2H6v-2Z" />
    </svg>
  ),
};

export default function TossPaymentMethodPicker({
  value,
  onChange,
  className,
  provider,
}: TossPaymentMethodPickerProps) {
  // 노출 목록·순서는 methods.ts 가 정본(paymentMethodOptionsFor). 나이스페이는 간편결제 3종이
  //   위·카드가 아래이고 계좌이체는 영구 제외, 토스는 종전대로 카드/계좌이체 2개다.
  // provider prop(멤버십 결제창은 prepare provider 보유) 우선, 없으면(전 충전 등 결제 전
  //   클라이언트) 빌드타임 클라이언트 env 로 폴백. 서버 PAYMENT_PROVIDER 와 쌍.
  const effectiveProvider =
    provider ?? (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER as 'toss' | 'nicepay' | undefined);
  const options = useMemo(() => paymentMethodOptionsFor(effectiveProvider), [effectiveProvider]);

  // 목록에서 사라진 값이 선택돼 있으면 첫 옵션으로 폴백 — 못 쓰는 수단이 결제로 새는 것 방지.
  useEffect(() => {
    if (!options.some((option) => option.code === value)) {
      onChange(options[0].code);
    }
  }, [options, value, onChange]);

  return (
    <div
      className={cn(
        'rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4',
        className
      )}
    >
      <div className="app-caption">결제 방식</div>
      <p className="mt-2 text-sm leading-6 text-[var(--app-copy-muted)]">
        여기서 고른 수단의 결제창이 바로 열립니다.
      </p>
      {/* 2026-09-08 — 한 줄에 하나씩. 간편결제는 브랜드 컬러 바로 색만 보고 찾게 한다. */}
      <div className="mt-4 grid grid-cols-1 gap-2">
        {options.map((option) => {
          const isSelected = value === option.code;
          const brand = option.brand;

          if (brand) {
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => onChange(option.code)}
                aria-pressed={isSelected}
                data-selected={isSelected ? 'true' : 'false'}
                style={{ background: brand.bg, color: brand.fg }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[12px] px-4 py-3 text-left transition',
                  // 🔴 브랜드 컬러는 **항상 원색**이다. 미선택을 opacity 로 죽이면 카카오 노랑이
                  //   베이지, 네이버 초록이 민트로 보여 "색으로 찾는다"는 목적 자체가 사라진다
                  //   (2026-09-08 실렌더에서 확인). 선택 표시는 링 + 체크로만 한다.
                  isSelected
                    ? 'ring-2 ring-[var(--app-ink)] ring-offset-2 ring-offset-[var(--app-surface-muted)]'
                    : 'ring-1 ring-black/10'
                )}
              >
                {BRAND_MARKS[option.code]}
                <span className="text-base font-extrabold tracking-tight">{option.label}</span>
                <span aria-hidden="true" className="ml-auto text-base font-black">
                  {isSelected ? '✓' : ''}
                </span>
              </button>
            );
          }

          return (
            <button
              key={option.code}
              type="button"
              onClick={() => onChange(option.code)}
              aria-pressed={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              className={cn(
                'gangi-payment-row flex w-full items-center gap-2 px-4 py-3 text-left',
                isSelected ? 'text-[var(--app-ink)]' : 'text-[var(--app-copy)]'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-sm',
                  isSelected
                    ? 'bg-[var(--app-pink)] text-white'
                    : 'border border-[var(--app-line)] text-transparent'
                )}
              >
                ✓
              </span>
              <span className="text-base font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
