// 한 장짜리 랜딩 비회원 주문(설계: docs/superpowers/specs/2026-10-21-one-page-landing-design.md).
// 풀이는 관리자 외부 주문 PDF 생성기로 만들므로 생년월일 입력은 그 생성기의 형식(ExternalReportRequest)으로 바꿔 저장한다.
import { parseExternalReportRequest, type ExternalReportRequest } from '@/lib/admin/external-report';

export type ReportProduct = 'lifetime' | 'new-year';
export type ReportPayMethod = 'card' | 'bank';
export type ReportOrderStatus =
  | 'pending_payment'
  | 'awaiting_deposit'
  | 'paid'
  | 'generated'
  | 'sent'
  | 'cancelled'
  | 'refunded';

export const REPORT_PACKAGE_BY_PRODUCT = {
  lifetime: 'report_lifetime',
  'new-year': 'report_new_year',
} as const satisfies Record<ReportProduct, string>;

export const REPORT_PRODUCT_LABEL: Record<ReportProduct, string> = {
  lifetime: '종합사주',
  'new-year': '2027 신년운세',
};

// 두 시간 단위 시간대. 자시는 자정 전후로 날짜가 갈리므로 두 칸으로 나눈다. 각 칸은 대표 시각으로 생성기에 넘긴다(표준시).
export const HOUR_SLOTS = [
  { id: 'ja-night', label: '자시 (밤 11:30 ~ 자정)', hour: '23', minute: '45' },
  { id: 'ja-early', label: '자시 (자정 ~ 새벽 1:29)', hour: '0', minute: '45' },
  { id: 'chuk', label: '축시 (새벽 1:30 ~ 3:29)', hour: '2', minute: '30' },
  { id: 'in', label: '인시 (새벽 3:30 ~ 5:29)', hour: '4', minute: '30' },
  { id: 'myo', label: '묘시 (아침 5:30 ~ 7:29)', hour: '6', minute: '30' },
  { id: 'jin', label: '진시 (아침 7:30 ~ 9:29)', hour: '8', minute: '30' },
  { id: 'sa', label: '사시 (오전 9:30 ~ 11:29)', hour: '10', minute: '30' },
  { id: 'o', label: '오시 (낮 11:30 ~ 1:29)', hour: '12', minute: '30' },
  { id: 'mi', label: '미시 (오후 1:30 ~ 3:29)', hour: '14', minute: '30' },
  { id: 'sin', label: '신시 (오후 3:30 ~ 5:29)', hour: '16', minute: '30' },
  { id: 'yu', label: '유시 (저녁 5:30 ~ 7:29)', hour: '18', minute: '30' },
  { id: 'sul', label: '술시 (저녁 7:30 ~ 9:29)', hour: '20', minute: '30' },
  { id: 'hae', label: '해시 (밤 9:30 ~ 11:29)', hour: '22', minute: '30' },
  { id: 'unknown', label: '태어난 시간을 몰라요', hour: '', minute: '' },
] as const;

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

const TRANSITIONS: Record<ReportOrderStatus, readonly ReportOrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  awaiting_deposit: ['paid', 'cancelled'],
  paid: ['generated', 'refunded'],
  generated: ['generated', 'sent', 'refunded'],
  sent: ['sent', 'refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: ReportOrderStatus, to: ReportOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function maskName(name: string): string {
  const chars = [...name];
  if (chars.length <= 1) return name;
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/** 나이스페이 승인 뒤 이동할 화면. 랜딩 비회원 주문이 아니면 null(기존 상품별 분기를 탄다). */
export function reportOrderResultHref(pkg: { kind: string }, paymentOrderId: string): string | null {
  return pkg.kind === 'report_order' ? `/saju-report/complete?order=${encodeURIComponent(paymentOrderId)}` : null;
}
