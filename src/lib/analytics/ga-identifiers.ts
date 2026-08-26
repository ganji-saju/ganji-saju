// 2026-08-26 — GA4 client_id / session_id 를 쿠키에서 꺼내는 순수 파서.
//
//   왜 필요한가: 결제 확정은 서버에서 일어나고 그때는 브라우저 세션이 없다. 결제 **시작**
//   시점에 이 두 값을 주문에 붙여 둬야 나중에 Measurement Protocol 이 그 결제를 원래 세션·
//   원래 채널에 귀속시킬 수 있다. session_id 를 빠뜨리면 GA4 가 새 세션으로 처리해
//   **채널별 매출이 전부 (direct) 로 몰린다** — 가장 흔한 실패다.
//
//   쿠키 형식(GA4 문서화되지 않은 사실상 표준):
//     _ga            = "GA1.1.1234567890.1699999999"  → client_id = "1234567890.1699999999"
//     _ga_<STREAM>   = "GS1.1.1756180000.3.1.1756180200.60.0.0" → session_id = "1756180000"
//                      (GS2 로 버전이 오르는 사례가 있어 접두 버전은 느슨하게 본다)
//
//   ⚠️ 파싱 실패를 추측으로 메우지 않는다. 못 읽으면 null 이고, 호출부는 전송을 건너뛴다 —
//   틀린 client_id 로 보내면 남의 세션에 매출이 붙는다.

/** `_ga` 쿠키 값 → client_id. 형식이 다르면 null. */
export function parseGaClientId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // GA1.1.<a>.<b> — 앞 두 조각은 버전/도메인 깊이라 버린다.
  const m = /^GA\d+\.\d+\.(\d+)\.(\d+)$/.exec(raw.trim());
  return m ? `${m[1]}.${m[2]}` : null;
}

/** `_ga_<STREAM_ID>` 쿠키 값 → session_id(초 단위 타임스탬프 문자열). 형식이 다르면 null. */
export function parseGaSessionId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // GS1(구): "GS1.1.1756180000.3.1..."  ·  GS2(신, 2024~): "GS2.1.s1756180000$o3$g1..."
  //   신형은 세션 ID 앞에 's' 접두가 붙고 구분자가 '$' 다. 둘 다 받는다 —
  //   한쪽만 지원하면 어느 날 GA 가 형식을 올렸을 때 채널 귀속이 조용히 죽는다.
  const m = /^GS\d+\.\d+\.s?(\d+)(?:[.$]|$)/.exec(raw.trim());
  return m ? m[1] : null;
}

/** 측정 ID(G-XXXX) → session 쿠키 이름(_ga_XXXX). 잘못된 형식이면 null. */
export function gaSessionCookieName(measurementId: string | null | undefined): string | null {
  if (!measurementId) return null;
  const m = /^G-([A-Z0-9]+)$/i.exec(measurementId.trim());
  return m ? `_ga_${m[1].toUpperCase()}` : null;
}

/** 쿠키 헤더 문자열(또는 document.cookie) → 이름별 값 맵. */
export function parseCookieHeader(header: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!name || out.has(name)) continue;
    out.set(name, decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return out;
}

export interface GaIdentifiers {
  clientId: string | null;
  sessionId: string | null;
}

/**
 * 쿠키 소스에서 두 식별자를 한 번에 뽑는다. 서버(요청 쿠키 헤더)·클라이언트(document.cookie)
 * 어느 쪽에서든 같은 문자열 규약이라 함수를 나누지 않는다.
 */
export function readGaIdentifiers(
  cookieHeader: string | null | undefined,
  measurementId: string | null | undefined
): GaIdentifiers {
  const cookies = parseCookieHeader(cookieHeader);
  const sessionCookie = gaSessionCookieName(measurementId);
  return {
    clientId: parseGaClientId(cookies.get('_ga')),
    sessionId: sessionCookie ? parseGaSessionId(cookies.get(sessionCookie)) : null,
  };
}
