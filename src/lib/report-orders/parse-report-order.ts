// 랜딩 주문서 검증(서버). 풀이는 관리자 외부 주문 PDF 생성기로 만들므로 생년월일 입력은 그 생성기의 형식으로 바꿔 저장한다.
import { Lunar } from 'lunar-typescript';
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
  if (!name || name.length > 20) return invalid('이름은 1자 이상 20자 이하로 입력해 주세요.');
  // 이름은 접수 문자에 그대로 들어간다 — 링크·숫자·기호를 막아 우리 발신번호로 피싱 문자를 못 보내게.
  if (!/^[가-힣a-zA-Z ]+$/.test(name)) return invalid('이름은 한글·영문 20자 이내로 입력해 주세요.');
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
  let calendarType: 'solar' | 'lunar' = p.calendarType === 'lunar' ? 'lunar' : 'solar';
  let [year, month, day] = [str(p.year), str(p.month), str(p.day)];
  // 윤달: 생성기 입력은 윤달 칸이 없으므로 여기서 양력으로 바꿔 넘긴다(lunar-typescript 는 음수 달 = 윤달).
  if (calendarType === 'lunar' && p.lunarLeap === true) {
    try {
      const solar = Lunar.fromYmd(Number(year), -Number(month), Number(day)).getSolar();
      [calendarType, year, month, day] = ['solar', String(solar.getYear()), String(solar.getMonth()), String(solar.getDay())];
    } catch {
      return invalid('그 해에는 그 달의 윤달이 없어요. 윤달 표시를 확인해 주세요.');
    }
  }
  const parsed = parseExternalReportRequest({
    kind: product,
    name,
    gender: p.gender,
    calendarType,
    timeRule: 'standard',
    year,
    month,
    day,
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

