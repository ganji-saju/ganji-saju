// 2026-09-03 — 클라이언트만 관측할 수 있는 퍼널 단계를 받는 창구.
//
// 왜: 결제 버튼을 눌러도 미로그인이면 클라이언트가 /login 으로 보내고 prepare 를
//   **아예 호출하지 않는다**(toss-membership-checkout.tsx). 그래서 "결제하려 했지만
//   로그인 벽에 막힌 사람"이 퍼널에 흔적 0으로 사라졌다. 서버는 그 순간을 볼 수 없다.
//
// ⚠️ 신뢰 경계: 이 라우트는 **브라우저가 부르는 곳**이다. 위조 가능한 입력으로 취급한다.
//   - 기록 가능한 stage 를 화이트리스트로 못박는다(confirm_success 같은 결제 성공 단계를
//     클라이언트가 심을 수 있으면 매출 지표가 통째로 거짓말이 된다).
//   - 금액(amount)은 받지 않는다. 돈에 관한 숫자는 서버 원장만이 만든다.
//   - 실패해도 200 — 계측이 결제 UX 를 막으면 안 된다(/api/visit 와 같은 원칙).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { clientIpFromHeaders, shouldSkipVisitAnalytics } from '@/lib/analytics/visit-filters';
import {
  isClientEmittableStage,
  logPaymentFunnelEvent,
  type PaymentFunnelStage,
} from '@/lib/payments/funnel-log';

export const dynamic = 'force-dynamic';

const str = (v: unknown, max = 120): string | null => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true });
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return ok;

    const stage = str(body.stage, 40);
    if (!isClientEmittableStage(stage)) return ok;

    // 2026-09-03 — 공개 POST 라 봇이 부풀릴 수 있다. '로그인 벽이 이탈 원인'이라는 결론이
    //   크롤러 때문에 오염되면 계측이 없느니만 못하다. /api/visit 과 **같은 필터**를 쓴다
    //   (봇 UA · 비프로덕션 배포 · 내부 IP · 우리 도메인 아님).
    const skip = shouldSkipVisitAnalytics({
      path: '/membership/checkout',
      host: req.headers.get('host'),
      deploymentEnv: process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV,
      clientIp: clientIpFromHeaders(req.headers),
      excludedIps: process.env.ANALYTICS_EXCLUDED_IPS,
      userAgent: req.headers.get('user-agent'),
    });
    if (skip) return ok;

    // 세션이 있으면 user_id 를 남긴다(login_required 는 보통 비로그인이라 대개 null).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await logPaymentFunnelEvent(supabase, {
      stage: stage as PaymentFunnelStage,
      userId: user?.id ?? null,
      packageId: str(body.packageId, 64),
      // amount 는 받지 않는다(위 신뢰 경계 참고).
      metadata: {
        product: str(body.product, 64),
        slug: str(body.slug, 200),
        from: str(body.from, 64),
      },
    });
  } catch (err) {
    console.error('[payments/funnel] client stage 기록 실패:', err);
  }
  return ok;
}
