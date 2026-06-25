import type { GangiHomeBanner } from '@/content/gangi-market';
import { GANGI_HOME_BANNERS } from '@/content/gangi-market';

// 2026-06-26 — 홈 상단 배너를 사용자 제작 완성형 이미지 배너(GANGI_HOME_BANNERS, 3:1)로 교체.
//   이전 동적 배너(AI 오늘의 한 줄 + 띠/별자리 일별 픽)는 git history 에 보존 — 추후 이미지
//   배너와 혼합/재도입 가능. 띠·별자리 진입점은 무료 허브·별자리 slot 으로 유지됨.
export async function getHomeBanners(): Promise<readonly GangiHomeBanner[]> {
  return GANGI_HOME_BANNERS;
}
