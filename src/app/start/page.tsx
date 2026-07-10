import type { Metadata } from 'next';
import { Suspense } from 'react';
import StartClient from './start-client';

export const metadata: Metadata = {
  title: '운세 시작 — 생년월일 한 번 입력으로',
  description:
    '생년월일을 한 번만 입력하면 오늘의 운세와 내 사주를 바로 볼 수 있어요. 원하는 결과를 골라 이어서 확인하세요.',
  alternates: {
    canonical: '/start',
  },
};

export default function Page() {
  // useSearchParams()(?next 딥링크 파싱)가 정적 프리렌더에서 CSR bailout 하지 않도록 Suspense 경계로 감싼다.
  return (
    <Suspense fallback={null}>
      <StartClient />
    </Suspense>
  );
}
