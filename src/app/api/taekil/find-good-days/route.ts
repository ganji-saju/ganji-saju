// 2026-05-15 — 택일 길일 산출 API.
// GET /api/taekil/find-good-days?purpose=wedding → top 7 길일.
// 사용자 인증 + 본인 사주 (profile) → SajuOriginInput → findGoodDays.

import { NextRequest, NextResponse } from 'next/server';
import { findGoodDays, type TaekilPurpose } from '@/lib/taekil/find-good-days';
import type { SajuOriginInput } from '@/lib/today-fortune/iljin-score-engine';
import type { Branch, Stem } from '@/lib/today-fortune/iljin-rules';
import { getOptionalSignedInProfile, hasCoreBirthProfile, toBirthInputFromProfile } from '@/lib/profile';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';

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

  // BirthInput → SajuDataV1.
  const birthInput = toBirthInputFromProfile(profile);
  if (!birthInput) {
    return NextResponse.json(
      { ok: false, hasProfile: false, error: '사주 정보 불완전' },
      { status: 200 }
    );
  }

  const sajuData = calculateSajuDataV1(birthInput);

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
    return NextResponse.json({ ok: true, hasProfile: true, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, hasProfile: true, error: `길일 산출 실패: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
