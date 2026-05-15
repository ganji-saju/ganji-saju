// 2026-05-15 — 사용자가 검색이 작동하는 /dream 으로 자동 이동.
// 이전 /dream-interpretation 페이지는 옛 marketing 디자인 + 검색 필드 부재로 사용자가
// "꿈해몽 검색이 안 된다" 고 느낌. 이제는 진입 시 즉시 검색 페이지로 redirect.
// [slug] 페이지 (개별 꿈 SEO 콘텐츠) 는 그대로 유지.
import { redirect } from 'next/navigation';

export default function DreamInterpretationAliasPage() {
  redirect('/dream');
}
