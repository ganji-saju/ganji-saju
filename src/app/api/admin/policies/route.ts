// Phase 3-B (2026-05-18): 정책 버전 CRUD API (admin).
//
// GET  /api/admin/policies                 — 9 종류 활성 버전 (현재 게시 중)
// GET  /api/admin/policies?kind=terms      — 특정 종류 전체 이력
// POST /api/admin/policies                 — 신규 버전 생성 (body: { kind, version, effectiveDate, content, contentFormat, requiresReconsent, changelog })
//
// 인증: getCurrentAdminCheck (admin_users 테이블 + ADMIN_USER_IDS env)
// 사용처: /admin/policies UI

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import {
  POLICY_KINDS,
  createPolicyVersion,
  getAllActivePolicyVersions,
  getCurrentPolicyVersion,
  listPolicyVersions,
  type PolicyContentFormat,
  type PolicyKind,
} from '@/lib/policies';

export const runtime = 'nodejs';

function isPolicyKind(v: unknown): v is PolicyKind {
  return typeof v === 'string' && (POLICY_KINDS as readonly string[]).includes(v);
}

function isContentFormat(v: unknown): v is PolicyContentFormat {
  return v === 'markdown' || v === 'html' || v === 'plaintext';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const kindParam = req.nextUrl.searchParams.get('kind');
  if (kindParam) {
    if (!isPolicyKind(kindParam)) {
      return NextResponse.json(
        { ok: false, error: `unknown policy kind: ${kindParam}` },
        { status: 400 }
      );
    }
    const history = await listPolicyVersions(kindParam);
    const active = await getCurrentPolicyVersion(kindParam);
    return NextResponse.json({ ok: true, kind: kindParam, active, history });
  }

  const all = await getAllActivePolicyVersions();
  return NextResponse.json({
    ok: true,
    kinds: POLICY_KINDS,
    active: all,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: guard.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: 'body 필요' }, { status: 400 });
  }

  const { kind, version, effectiveDate, content } = body;
  const contentFormat = body.contentFormat ?? 'markdown';
  const requiresReconsent = body.requiresReconsent === true;
  const changelog =
    typeof body.changelog === 'string' && body.changelog.trim() ? body.changelog.trim() : null;

  if (!isPolicyKind(kind)) {
    return NextResponse.json(
      { ok: false, error: `unknown policy kind: ${kind}` },
      { status: 400 }
    );
  }
  if (typeof version !== 'string' || !/^v\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { ok: false, error: 'version 은 semver (예: v1.0.0) 형식 필수' },
      { status: 400 }
    );
  }
  if (typeof effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return NextResponse.json(
      { ok: false, error: 'effectiveDate 는 YYYY-MM-DD 형식 필수' },
      { status: 400 }
    );
  }
  if (typeof content !== 'string' || !content.trim()) {
    return NextResponse.json(
      { ok: false, error: 'content 본문 필수' },
      { status: 400 }
    );
  }
  if (!isContentFormat(contentFormat)) {
    return NextResponse.json(
      { ok: false, error: `contentFormat = markdown / html / plaintext 중 하나` },
      { status: 400 }
    );
  }

  try {
    const policy = await createPolicyVersion({
      kind,
      version,
      effectiveDate,
      content,
      contentFormat,
      requiresReconsent,
      changelog,
      createdBy: guard.userId ?? null,
    });
    return NextResponse.json({ ok: true, policy });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isDuplicate = msg.includes('duplicate') || msg.includes('23505');
    return NextResponse.json(
      {
        ok: false,
        error: isDuplicate
          ? `이미 존재하는 버전 (kind=${kind}, version=${version}). 다른 version 으로 입력하세요.`
          : msg,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
