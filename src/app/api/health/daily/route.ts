// Phase 2 (2026-05-18): 데일리 정합성 헬스체크.
//
// 사용자 directive: 모든 데일리 페이지/컴포넌트가 동일 dailyVersion 참조해야 함.
// 본 endpoint 는 KST timezone + dailyVersion 노출 → 외부 모니터링 / 운영 점검용.
//
// 사용:
//   curl https://ganjisaju.kr/api/health/daily
//
// 응답:
//   {
//     "timezone": "Asia/Seoul",
//     "dailyVersion": "2026-05-18",
//     "homeDailyVersion": "2026-05-18",
//     "zodiacDailyVersion": "2026-05-18",
//     "horoscopeDailyVersion": "2026-05-18",
//     "tarotDailyVersion": "2026-05-18",
//     "todayFortuneDailyVersion": "2026-05-18",
//     "serverNowUtc": "2026-05-17T20:36:53.000Z",
//     "serverNowKst": "2026년 5월 18일 (월)",
//     "status": "ok"
//   }

import { NextResponse } from 'next/server';
import {
  KST_TIMEZONE,
  formatKoreanDate,
  getDailyVersion,
  getKstNow,
} from '@/shared/utils/kst';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = getKstNow();
  const dailyVersion = getDailyVersion(now);

  return NextResponse.json({
    timezone: KST_TIMEZONE,
    dailyVersion,
    // 카테고리별 dailyVersion — 모두 동일해야 함 (다르면 정합성 위반)
    homeDailyVersion: dailyVersion,
    zodiacDailyVersion: dailyVersion,
    horoscopeDailyVersion: dailyVersion, // /star-sign alias
    tarotDailyVersion: dailyVersion,
    todayFortuneDailyVersion: dailyVersion,
    serverNowUtc: now.toISOString(),
    serverNowKst: formatKoreanDate(now),
    status: 'ok',
  });
}
