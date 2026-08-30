// 2026-08-31 — POST /api/admin/product-entitlement/grant
//   super_admin 이 유료 상품 이용권을 무료로 수동 부여한다(보상·CS·테스트).
//   기존엔 전·멤버십·평생리포트만 줄 수 있어서 궁합·점수·달력 등은 손댈 방법이 없었다.
//
//   🔴 설계 원칙 하나: **scope 를 여기서 직접 만들지 않는다.**
//      결제 승인(fulfillment)이 쓰는 resolvePaymentProductScope 를 그대로 호출한다.
//      scope 형식이 결제 경로와 1글자라도 어긋나면 행은 생기는데 화면은 계속 잠긴다 —
//      게이트가 scope_key 를 파싱하기 때문이고, 실패해도 예외가 안 난다.
//      (같은 이유로 '전부 global 로 주기' 는 오답이다 — lib/admin/product-grant.ts 주석 참고.)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { getPackage, isBundlePackage, isTasteProductPackage } from '@/lib/payments/catalog';
import { resolvePaymentProductScope } from '@/lib/payments/product-scope';
import { grantTasteProductEntitlement } from '@/lib/product-entitlements';
import { grantBundleComponents } from '@/lib/payments/bundle';
import { addCredits } from '@/lib/credits/deduct';
import { getReadingById } from '@/lib/saju/readings';
import {
  findAdminGrantProduct,
  isYearMonthScope,
  isYearScope,
  SCORE_FACTOR_SCOPES,
} from '@/lib/admin/product-grant';
import { logAdminAccess } from '@/lib/admin/access-log';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';

/** 대화상담 질문 3회는 이용권이 아니라 전 3개가 전달물 — fulfillment 와 같은 수량. */
const DIALOGUE_ENTRY_CREDITS = 3;

interface GrantedItem {
  productId: string;
  scopeKey: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);

  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  if (check.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, error: 'super_admin 만 유료상품 권한을 부여할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const packageId = typeof body?.packageId === 'string' ? body.packageId.trim() : '';
  const readingId = typeof body?.readingId === 'string' ? body.readingId.trim() : '';
  const scope = typeof body?.scope === 'string' ? body.scope.trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'userId 가 필요합니다.' }, { status: 400 });
  }

  const def = findAdminGrantProduct(packageId);
  const pkg = def ? getPackage(def.packageId) : undefined;
  if (!def || !pkg) {
    return NextResponse.json(
      { ok: false, error: '부여할 수 없는 상품입니다.' },
      { status: 400 }
    );
  }

  // ── 필요한 입력 검증 ────────────────────────────────────────────
  const needsReading = def.need !== 'none';
  if (needsReading && !readingId) {
    return NextResponse.json(
      { ok: false, error: '이 상품은 사주 결과를 선택해야 합니다.' },
      { status: 400 }
    );
  }
  if (def.need === 'reading-month' && !isYearMonthScope(scope)) {
    return NextResponse.json(
      { ok: false, error: "대상 월을 'YYYY-MM' 형식으로 지정하세요." },
      { status: 400 }
    );
  }
  if (def.need === 'reading-year' && !isYearScope(scope)) {
    return NextResponse.json(
      { ok: false, error: "대상 연도를 'YYYY' 형식으로 지정하세요." },
      { status: 400 }
    );
  }

  // 사주 결과 소유자 검증 — 남의 결과에 부여 차단(lifetime-report/grant 와 동일 규칙).
  if (needsReading) {
    const reading = await getReadingById(readingId);
    if (!reading) {
      return NextResponse.json(
        { ok: false, error: '사주 결과를 찾지 못했습니다.' },
        { status: 404 }
      );
    }
    if (reading.userId !== userId) {
      return NextResponse.json(
        { ok: false, error: '해당 유저의 결과가 아닙니다.' },
        { status: 403 }
      );
    }
  }

  // resolvePaymentProductScope 의 slug 자리엔 reading id 를 넣는다
  // (resolveReading 이 uuid 를 reading id 로 인식한다). 전역 상품은 null.
  const slug = needsReading ? readingId : null;
  const granted: GrantedItem[] = [];

  try {
    if (def.packageId === 'taste_dialogue_entry') {
      // 이용권을 만들지 않는다 — 게이트가 전 잔액을 본다(결제 fulfillment 와 동일).
      await addCredits(userId, DIALOGUE_ENTRY_CREDITS, 'purchase', {
        source: 'admin_manual_grant',
        packageId: pkg.id,
        reason,
        grantedBy: check.userId,
      });
      granted.push({ productId: 'dialogue-entry(전 3개)', scopeKey: null });
    } else if (isBundlePackage(pkg)) {
      const results = await grantBundleComponents(
        pkg,
        { userId, slug, orderId: null, paymentKey: null, packageId: pkg.id },
        {
          resolveScope: (args) => resolvePaymentProductScope(args),
          grant: (uid, productId, options) => grantTasteProductEntitlement(uid, productId, options),
        }
      );
      granted.push(
        ...results.map((r) => ({ productId: r.tasteProductId, scopeKey: r.scopeKey }))
      );
    } else if (isTasteProductPackage(pkg) && pkg.tasteProductId === 'score-factor') {
      // 5요소를 개별 scope('score:{readingKey}:F1' …)로 부여한다.
      // scope 없이 한 번만 주면 'reading:{readingKey}' 가 되어 게이트가 파싱하지 못한다.
      for (const factor of SCORE_FACTOR_SCOPES) {
        const resolved = await resolvePaymentProductScope({ pkg, slug, scope: factor });
        if (!resolved) continue;
        await grantTasteProductEntitlement(userId, 'score-factor', {
          scopeKey: resolved.scopeKey,
          amount: 0,
          packageId: pkg.id,
        });
        granted.push({ productId: 'score-factor', scopeKey: resolved.scopeKey });
      }
    } else if (isTasteProductPackage(pkg)) {
      const resolved = await resolvePaymentProductScope({
        pkg,
        slug,
        scope: scope || null,
      });
      if (!resolved) {
        return NextResponse.json(
          { ok: false, error: '이 상품의 부여 범위를 계산하지 못했습니다.' },
          { status: 400 }
        );
      }
      await grantTasteProductEntitlement(userId, pkg.tasteProductId, {
        scopeKey: resolved.scopeKey,
        amount: 0,
        packageId: pkg.id,
      });
      granted.push({ productId: pkg.tasteProductId, scopeKey: resolved.scopeKey });
    } else {
      return NextResponse.json(
        { ok: false, error: '지원하지 않는 패키지 종류입니다.' },
        { status: 400 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '권한 부여에 실패했습니다.';
    console.error('[admin-product-grant] 부여 실패', { userId, packageId, message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  await logAdminAccess({
    actorId: check.userId,
    actorRole: check.role,
    action: 'grant_product',
    targetUser: userId,
    reason: reason || null,
    meta: { packageId: pkg.id, readingId: readingId || null, scope: scope || null, granted },
  });

  await refreshAdminUserSummaryForUser(userId).catch(() => {});

  return NextResponse.json({ ok: true, granted, note: def.note });
}
