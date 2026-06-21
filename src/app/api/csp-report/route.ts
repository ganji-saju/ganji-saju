// 2026-06-21 보안 — CSP 위반 보고 수집 엔드포인트.
//   next.config 의 Content-Security-Policy-Report-Only 가 report-uri 로 이곳에 POST 한다.
//   위반을 Vercel 로그(console.warn)로 수집해, enforce 승격 전 정상 트래픽이 깨지지 않는지
//   관찰한다. 브라우저가 호출하는 공개 sink 이므로 본문 크기를 제한하고 실패는 삼킨다.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16_384; // 16KB — 보고 본문 상한(남용 방지).

function pick(report: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (report[key] != null) return report[key];
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text || text.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const body = JSON.parse(text) as unknown;

    // CSP Level 2: { "csp-report": {...} } / Reporting API: [{ type, body:{...} }].
    const reports: Array<Record<string, unknown>> = Array.isArray(body)
      ? body.map((item) => (item as { body?: Record<string, unknown> })?.body ?? (item as Record<string, unknown>))
      : [((body as { 'csp-report'?: Record<string, unknown> })?.['csp-report'] ?? body) as Record<string, unknown>];

    for (const report of reports) {
      if (!report || typeof report !== 'object') continue;
      const directive = pick(report, ['violated-directive', 'effectiveDirective', 'violatedDirective']);
      const blocked = pick(report, ['blocked-uri', 'blockedURL', 'blockedUri']);
      const documentUri = pick(report, ['document-uri', 'documentURL']);
      console.warn(
        '[csp-report]',
        JSON.stringify({ directive, blocked, documentUri })
      );
    }
  } catch {
    // 보고 수집 실패가 사용자 경험을 깨지 않도록 삼킨다.
  }
  return new NextResponse(null, { status: 204 });
}
