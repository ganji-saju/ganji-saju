'use client';
// 2026-06-28 — 서브페이지 '뒤로' 버튼: 앱 내 히스토리가 있으면 실제 이전 페이지로(router.back),
//   없으면(직접 진입·새로고침·외부 유입) fallbackHref 로 이동.
//   기존엔 backHref 고정 Link 라 홈 배너로 진입해도 항상 /free 등으로 가는(진입 경로 무시) 문제가 있었다.
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function GangiBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };
  return (
    <button type="button" onClick={handleBack} className="gangi-sub-back" aria-label="뒤로">
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
