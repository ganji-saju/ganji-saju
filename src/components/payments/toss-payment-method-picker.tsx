'use client';

import {
  TOSS_PAYMENT_METHOD_OPTIONS,
  type TossPaymentMethodCode,
} from '@/lib/payments/methods';
import { cn } from '@/lib/utils';

interface TossPaymentMethodPickerProps {
  value: TossPaymentMethodCode;
  onChange: (method: TossPaymentMethodCode) => void;
  className?: string;
}

export default function TossPaymentMethodPicker({
  value,
  onChange,
  className,
}: TossPaymentMethodPickerProps) {
  return (
    <div
      className={cn(
        'rounded-[1.2rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4',
        className
      )}
    >
      <div className="app-caption">결제수단 선택</div>
      <p className="mt-2 text-xs leading-6 text-[var(--app-copy-muted)]">
        카드 결제와 계좌이체 중 편한 방식을 고르실 수 있습니다. 기본 선택은 카드입니다.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TOSS_PAYMENT_METHOD_OPTIONS.map((option) => {
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
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                    isSelected
                      ? 'bg-[var(--app-pink)] text-white'
                      : 'border border-[var(--app-line)] text-transparent'
                  )}
                >
                  ✓
                </span>
                <span className="text-sm font-semibold">{option.label}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--app-copy-muted)]">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
