// 랜딩 주문서 검증(서버). 풀이는 관리자 외부 주문 PDF 생성기로 만들므로 생년월일 입력은 그 생성기의 형식으로 바꿔 저장한다.
import { parseExternalReportRequest, type ExternalReportRequest } from '@/lib/admin/external-report';
import { HOUR_SLOTS, type ReportPayMethod, type ReportProduct } from './report-order';

export interface ReportOrderInput {
  product: ReportProduct;
  payMethod: ReportPayMethod;
  name: string;
  phone: string;
  email: string;
  memo: string;
  cashReceipt: boolean;
  birth: ExternalReportRequest;
}

export type ParsedReportOrder = { ok: true; order: ReportOrderInput } | { ok: false; error: string };

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function parseReportOrderForm(payload: unknown): ParsedReportOrder {
  const invalid = (error: string): ParsedReportOrder => ({ ok: false, error });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return invalid('주문 정보를 다시 입력해 주세요.');
  const p = payload as Record<string, unknown>;

  const product = p.product;
  if (product !== 'lifetime' && product !== 'new-year') return invalid('상품을 선택해 주세요.');
  const payMethod = p.payMethod;
  if (payMethod !== 'card' && payMethod !== 'bank') return invalid('결제 방법을 선택해 주세요.');
  const name = str(p.name);
  if (!name || name.length > 20 || /[\u0000-\u001f\u007f]/.test(name)) return invalid('이름은 1자 이상 20자 이하로 입력해 주세요.');
  const phone = str(p.phone).replace(/[-\s]/g, '');
  if (!/^01[016789]\d{7,8}$/.test(phone)) return invalid('휴대폰 번호를 확인해 주세요.');
  const email = str(p.email);
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid('이메일 주소를 확인해 주세요.');
  const memo = str(p.memo);
  if (memo.length > 300) return invalid('남기실 말은 300자까지 쓸 수 있어요.');
  const slot = HOUR_SLOTS.find((s) => s.id === p.hourSlot);
  if (!slot) return invalid('태어난 시간을 선택해 주세요.');
  if (p.consentPrivacy !== true || p.consentTerms !== true) return invalid('개인정보 수집·이용과 이용약관에 동의해 주세요.');

  const unknownBirthTime = slot.id === 'unknown';
  const parsed = parseExternalReportRequest({
    kind: product,
    name,
    gender: p.gender,
    calendarType: p.calendarType === 'lunar' ? 'lunar' : 'solar',
    timeRule: 'standard',
    year: str(p.year),
    month: str(p.month),
    day: str(p.day),
    hour: slot.hour,
    minute: slot.minute,
    unknownBirthTime,
    birthLocationCode: '',
    birthLocationLabel: '',
    birthLatitude: '',
    birthLongitude: '',
  });
  if (!parsed.ok) return invalid(parsed.error);

  return {
    ok: true,
    order: { product, payMethod, name, phone, email, memo, cashReceipt: p.cashReceipt === true, birth: parsed.birth },
  };
}

