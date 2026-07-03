// 2026-07-03 — 카카오 공유 4019 진단 페이지 (임시, 원인 확정 후 제거 예정).
// 다른 dev 페이지와 달리 production 에서도 열림: 4019 는 프로덕션에서만 재현되고,
// 여기서 보여주는 건 전부 어차피 클라이언트 번들에 공개된 값(NEXT_PUBLIC JS 키는
// 도메인 화이트리스트로 보호되는 공개 키)이라 정보 노출이 아님. noindex.
import type { Metadata } from 'next';
import { KakaoShareDebugClient } from './debug-client';

export const metadata: Metadata = {
  title: '카카오 공유 진단 (dev)',
  robots: { index: false, follow: false },
};

export default function KakaoShareDebugPage() {
  return <KakaoShareDebugClient />;
}
