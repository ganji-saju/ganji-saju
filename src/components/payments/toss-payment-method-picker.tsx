'use client';

import { useEffect, useMemo } from 'react';
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
        결제는 별도 결제창에서 진행됩니다.
        {options.length > 1 ? ' 여기서 고른 수단의 결제창이 바로 열립니다.' : ''}
      </p>
      <div className={cn('mt-4 grid gap-2', options.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {options.map((option) => {
          const isSelected = value === option.code;

          return (
            <button
              key={option.code}
              type="button"
              onClick={() => onChange(option.code)}
              aria-pressed={isSelected}
              className={cn(
                'gangi-payment-row px-4 py-3 text-left',
                isSelected ? 'text-[var(--app-ink)]' : 'text-[var(--app-copy)]'
              )}
              data-selected={isSelected ? 'true' : 'false'}
            >
              <div className="flex items-center gap-2">
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
              </div>
              <p className="mt-2 text-sm leading-5 text-[var(--app-copy-muted)]">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
