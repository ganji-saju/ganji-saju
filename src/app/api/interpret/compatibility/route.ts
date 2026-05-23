import { NextRequest, NextResponse } from 'next/server';
import type { CompatibilityRelationshipSlug } from '@/content/moonlight';
import { buildCompatibilityInterpretation, type CompatibilityPerson } from '@/lib/compatibility';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import type { BirthInput } from '@/lib/saju/types';
import { createClient } from '@/lib/supabase/server';
import { generateCompatibilityInterpretation } from '@/server/ai/compatibility/generate-compatibility-interpretation';

export const runtime = 'nodejs';
export const maxDuration = 75;

const RELATIONSHIPS: CompatibilityRelationshipSlug[] = ['lover', 'family', 'friend', 'partner'];

function parseRelationship(value: unknown): CompatibilityRelationshipSlug | null {
  return RELATIONSHIPS.includes(value as CompatibilityRelationshipSlug)
    ? (value as CompatibilityRelationshipSlug)
    : null;
}

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

function parsePerson(value: unknown): CompatibilityPerson | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '선생님';
  if (!isBirthInput(data.birthInput)) return null;
  return { name, birthInput: data.birthInput };
}

interface ParsedRequest {
  relationship: CompatibilityRelationshipSlug;
  self: CompatibilityPerson;
  partner: CompatibilityPerson;
}

function parseRequest(payload: unknown): ParsedRequest | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  const relationship = parseRelationship(data.relationship);
  const self = parsePerson(data.self);
  const partner = parsePerson(data.partner);
  if (!relationship || !self || !partner) return null;
  return { relationship, self, partner };
}

export async function POST(req: NextRequest) {
  const parsed = parseRequest(await req.json().catch(() => null));

  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: '두 사람의 생년월일과 관계 유형이 필요합니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: '깊은 궁합 풀이는 로그인 후 열람할 수 있습니다.' },
      { status: 401 }
    );
  }

  // 유료 콘텐츠 — 권한 없는 사용자에게 LLM 비용을 쓰지 않도록 서버에서 게이팅.
  //   (①에서 궁합 전용 1회권/구독 scope 로 교체 예정. 현재는 기존 love-question 권한.)
  const entitled = Boolean(await getTasteProductEntitlement(user.id, 'love-question'));
  if (!entitled) {
    return NextResponse.json(
      { ok: false, error: '궁합 풀이 구매 후 깊은 풀이를 열람할 수 있습니다.' },
      { status: 403 }
    );
  }

  const interpretation = buildCompatibilityInterpretation(parsed.relationship, parsed.self, parsed.partner);
  const result = await generateCompatibilityInterpretation({
    interpretation,
    selfName: parsed.self.name,
    partnerName: parsed.partner.name,
  });

  return NextResponse.json({ ok: true, source: result.source, sections: result.sections });
}
