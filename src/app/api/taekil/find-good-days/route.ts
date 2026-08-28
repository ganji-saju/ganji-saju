// 2026-05-15 — 택일 길일 산출 API.
// GET /api/taekil/find-good-days?purpose=wedding → top 7 길일.
// 사용자 인증 + 본인 사주 (profile) → SajuOriginInput → findGoodDays.
//
// 🔴 2026-08-28 — 부분 유료화: **상위 3일 무료, 나머지 잠금**(3,300원 택일 당일권).
//   자르는 건 반드시 **여기(서버)** 다. 7일을 다 내려보내고 화면에서 블러만 씌우면
//   응답 JSON 에 답이 그대로 실려 나간다 — 그건 잠금이 아니라 그림이다.

import { NextRequest, NextResponse } from 'next/server';
import { findGoodDays, type TaekilPurpose } from '@/lib/taekil/find-good-days';
import type { SajuOriginInput } from '@/lib/today-fortune/iljin-score-engine';
import type { Branch, Stem } from '@/lib/today-fortune/iljin-rules';
import { getOptionalSignedInProfile, hasCoreBirthProfile, toBirthInputFromProfile } from '@/lib/profile';
import { loadSajuDataV2 } from '@/domain/saju/engine';
import { viewerHasMenuPass } from '@/lib/payments/menu-pass.server';

/** 잠금 없이 보여주는 상위 N일. */
const FREE_TOP_N = 3;

const VALID_PURPOSES: TaekilPurpose[] = ['wedding', 'open', 'move', 'contract', 'trip', 'etc'];

function normalizePurpose(value: string | null): TaekilPurpose {
  return VALID_PURPOSES.includes(value as TaekilPurpose) ? (value as TaekilPurpose) : 'wedding';
}

// 60갑자 인덱스 (공망 등 신살 계산에 필요).
function computeDayGanziIndex(stem: string, branch: string): number {
  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const si = STEMS.indexOf(stem);
  const bi = BRANCHES.indexOf(branch);
  if (si < 0 || bi < 0) return 0;
  for (let k = 0; k < 6; k += 1) {
    if ((si + 10 * k) % 12 === bi) return si + 10 * k;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const purpose = normalizePurpose(req.nextUrl.searchParams.get('purpose'));

  const profile = await getOptionalSignedInProfile();
  if (!profile || !hasCoreBirthProfile(profile)) {
    return NextResponse.json(
      { ok: false, hasProfile: false, error: '사주 정보가 등록되어 있지 않습니다.' },
      { status: 200 }
    );
  }

  // BirthInput → SajuDataV2 (loadSajuDataV2 가 자동으로 V1 → V2 upgrade).
  const birthInput = toBirthInputFromProfile(profile);
  if (!birthInput) {
    return NextResponse.json(
      { ok: false, hasProfile: false, error: '사주 정보 불완전' },
      { status: 200 }
    );
  }

  const sajuData = loadSajuDataV2(birthInput, null);

  // SajuDataV1 → SajuOriginInput (iljin-score-engine 형식).
  const byEl = sajuData.fiveElements.byElement;
  const sajuOrigin: SajuOriginInput = {
    dayMaster: sajuData.pillars.day.stem as Stem,
    dayMasterElement: sajuData.dayMaster.element as '목' | '화' | '토' | '금' | '수',
    yearStem: sajuData.pillars.year.stem as Stem,
    yearBranch: sajuData.pillars.year.branch as Branch,
    monthStem: sajuData.pillars.month.stem as Stem,
    monthBranch: sajuData.pillars.month.branch as Branch,
    dayBranch: sajuData.pillars.day.branch as Branch,
    hourStem: (sajuData.pillars.hour?.stem ?? null) as Stem | null,
    hourBranch: (sajuData.pillars.hour?.branch ?? null) as Branch | null,
    elementPercentages: {
      목: byEl['목']?.percentage ?? 0,
      화: byEl['화']?.percentage ?? 0,
      토: byEl['토']?.percentage ?? 0,
      금: byEl['금']?.percentage ?? 0,
      수: byEl['수']?.percentage ?? 0,
    },
    strengthLabel: sajuData.strength?.level ?? null,
    yongsinElement: null,
    kishinElement: null,
  };

  const dayGanziIndex = computeDayGanziIndex(
    sajuData.pillars.day.stem,
    sajuData.pillars.day.branch
  );

  try {
    const results = findGoodDays({
      saju: sajuOrigin,
      purpose,
      topK: 7,
      daysToScan: 60,
      dayGanziIndex,
    });

    // 이용권·멤버십이 있으면 전량, 없으면 상위 3일만. lockedCount 로 "몇 일이 더 있는지"만
    // 알려준다 — 날짜·점수·이유는 한 글자도 내려보내지 않는다.
    const hasPass = await viewerHasMenuPass('taekil');
    return NextResponse.json({
      ok: true,
      hasProfile: true,
      hasPass,
      results: hasPass ? results : results.slice(0, FREE_TOP_N),
      lockedCount: hasPass ? 0 : Math.max(0, results.length - FREE_TOP_N),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, hasProfile: true, error: `길일 산출 실패: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
