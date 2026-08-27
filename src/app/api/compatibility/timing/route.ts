// 2026-08-27 — 커플 시간축(좋은 달·조심할 달·연 전망) 조회.
//
//   왜 별도 라우트인가:
//     · 계산이 무겁다(두 사람 12개월 명식 ~320ms) → **클라이언트 번들에 넣지 않는다.**
//       수동 입력(바로 보기) 궁합은 생년월일이 브라우저 세션에만 있어 서버 페이지가
//       미리 계산할 수 없으므로, 그 경로는 이 라우트로 받아 간다.
//     · /api/interpret/compatibility 에 얹지 않는다 — 그쪽은 LLM(maxDuration 75s)이라
//       시간축이 LLM 뒤에 줄 서게 된다. 결정론 계산이 LLM 을 기다릴 이유가 없다.
//
//   유료 콘텐츠다 — hasCompatibilityAccess 로 서버에서 게이팅한다(grandfather 포함).
import { NextRequest, NextResponse } from 'next/server';
import { loadSajuDataV2 } from '@/domain/saju/engine';
import { buildCompatibilityCoupleKey } from '@/lib/compatibility';
import { buildCoupleTimingReport } from '@/lib/compatibility/couple-timing';
import { hasCompatibilityAccess } from '@/lib/payments/compatibility-access';
import type { BirthInput } from '@/lib/saju/types';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function isBirthInput(value: unknown): value is BirthInput {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    Number.isInteger(data.year) &&
    Number.isInteger(data.month) &&
    Number.isInteger(data.day) &&
    (data.hour === undefined || data.hour === null || Number.isInteger(data.hour)) &&
    (data.minute === undefined || data.minute === null || Number.isInteger(data.minute))
  );
}

function parsePerson(value: unknown): { name: string; birthInput: BirthInput } | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!isBirthInput(data.birthInput)) return null;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '선생님';
  return { name, birthInput: data.birthInput };
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const self = parsePerson(payload?.self);
  const partner = parsePerson(payload?.partner);
  if (!self || !partner) {
    return NextResponse.json(
      { ok: false, error: '두 사람의 생년월일이 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: '로그인 후 열람할 수 있습니다.' }, { status: 401 });
  }

  const coupleKey = buildCompatibilityCoupleKey(self.birthInput, partner.birthInput);
  if (!(await hasCompatibilityAccess(user.id, coupleKey))) {
    return NextResponse.json(
      { ok: false, error: '궁합 풀이 구매 후 열람할 수 있습니다.' },
      { status: 403 }
    );
  }

  const timing = buildCoupleTimingReport({
    self: {
      name: self.name,
      birthInput: self.birthInput,
      data: loadSajuDataV2(self.birthInput, null, {
        location: self.birthInput.birthLocation?.label ?? null,
      }),
    },
    partner: {
      name: partner.name,
      birthInput: partner.birthInput,
      data: loadSajuDataV2(partner.birthInput, null, {
        location: partner.birthInput.birthLocation?.label ?? null,
      }),
    },
  });

  return NextResponse.json({ ok: true, timing });
}
