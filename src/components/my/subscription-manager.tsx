'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { AccountSubscription } from '@/lib/account';

interface SubscriptionManagerProps {
  subscription: AccountSubscription | null;
}

export default function SubscriptionManager({ subscription }: SubscriptionManagerProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<'cancel' | 'resume' | null>(null);
  const [message, setMessage] = useState('');

  async function handleAction(action: 'cancel' | 'resume') {
    setLoadingAction(action);
    setMessage('');

    try {
      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? '구독 상태를 바꾸지 못했습니다.');
        return;
      }

      setMessage(action === 'cancel' ? '해지 예약이 반영됐습니다.' : '멤버십 이용 상태가 다시 활성화됐습니다.');
      router.refresh();
    } catch {
      setMessage('구독 상태를 바꾸는 중 네트워크 오류가 발생했습니다.');
    } finally {
      setLoadingAction(null);
    }
  }

  if (!subscription) {
    return (
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/credits">
          <Button>
            멤버십 시작하기
          </Button>
        </Link>
        <Link href="/membership">
          <Button variant="outline">
            멤버십 구성 보기
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        {subscription.status === 'active' ? (
          <Button
            onClick={() => handleAction('cancel')}
            disabled={loadingAction !== null}
            variant="outline"
          >
            {loadingAction === 'cancel' ? '처리 중..' : '해지 예약'}
          </Button>
        ) : subscription.status === 'cancelled' ? (
          <Button
            onClick={() => handleAction('resume')}
            disabled={loadingAction !== null}
          >
            {loadingAction === 'resume' ? '처리 중..' : '해지 예약 취소'}
          </Button>
        ) : (
          <Link href="/credits">
            <Button>
              멤버십 다시 시작하기
            </Button>
          </Link>
        )}

        <Link href="/membership">
          <Button variant="outline">
            멤버십 구성 보기
          </Button>
        </Link>
      </div>

      {message ? <p className="mt-4 text-base text-[#d2b072]">{message}</p> : null}
    </div>
  );
}
