// 대행사 발송결과 문자열 → 내부 상태 매핑.
// ⚠️ go-live: Solapi 의 실제 statusCode enum(예: 4000=성공) 으로 교체 권장.
// 현재는 문자열 휴리스틱 — 실패를 가장 먼저 판정해 '실패한 SMS 대체' 등이
// substituted/sent 로 오분류되지 않도록 순서를 고정한다.
export function mapVendorStatus(raw: string | undefined | null): 'sent' | 'failed' | 'substituted' | null {
  if (!raw) return null;
  const s = raw.toUpperCase();
  if (s.includes('FAIL') || s.includes('ERROR') || s.includes('REJECT')) return 'failed';
  if (s.includes('REPLACE') || s.includes('SUBSTITUT')) return 'substituted';
  if (s.includes('COMPLETE') || s.includes('DELIVER') || s === 'SENT') return 'sent';
  return null;
}
