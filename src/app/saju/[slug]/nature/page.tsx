// 2026-08-25 전면 개편 — 성향 탭 폐지(사주 결과 단일 페이지화, 사용자 지시).
//   콘텐츠는 결과 페이지의 섹션(features/saju-detail/sections)으로 이동했고,
//   구 링크·북마크 호환을 위해 해당 앵커로 리다이렉트한다.
import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/saju/${encodeURIComponent(slug)}#nature`);
}
