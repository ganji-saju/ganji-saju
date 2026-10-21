import { describe, expect, it } from 'vitest';
import { HOUR_SLOTS, canTransition, maskName } from './report-order';
import { parseReportOrderForm } from './parse-report-order';

const base = {
  product: 'lifetime',
  payMethod: 'card',
  name: '김민지',
  phone: '010-1234-5678',
  email: 'minji@example.com',
  memo: '',
  cashReceipt: false,
  gender: 'female',
  calendarType: 'solar',
  year: '1968',
  month: '5',
  day: '17',
  hourSlot: 'ja-night',
  consentPrivacy: true,
  consentTerms: true,
};

describe('parseReportOrderForm', () => {
  it('정상 입력을 외부 주문 PDF 입력 형식으로 바꾼다(밤 자시 = 23:45, 표준시)', () => {
    const result = parseReportOrderForm(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.phone).toBe('01012345678');
    expect(result.order.birth).toMatchObject({
      name: '김민지', calendarType: 'solar', timeRule: 'standard', year: '1968', month: '5', day: '17',
      hour: '23', minute: '45', unknownBirthTime: false, gender: 'female',
      birthLocationCode: '', birthLatitude: '', birthLongitude: '',
    });
  });

  it('새벽 자시는 00:45 로 넘긴다', () => {
    const result = parseReportOrderForm({ ...base, hourSlot: 'ja-early' });
    expect(result.ok && [result.order.birth.hour, result.order.birth.minute]).toEqual(['0', '45']);
  });

  it('시간 모름이면 시·분을 비우고 unknownBirthTime', () => {
    const result = parseReportOrderForm({ ...base, hourSlot: 'unknown' });
    expect(result.ok && result.order.birth).toMatchObject({ hour: '', minute: '', unknownBirthTime: true });
  });

  it('음력 입력을 받는다', () => {
    const result = parseReportOrderForm({ ...base, calendarType: 'lunar', day: '30', month: '4', year: '1990' });
    // 음력 1990-4-30 은 달력에 없는 날 — 기존 생성기 검증으로 거부된다.
    expect(result.ok).toBe(false);
    expect(parseReportOrderForm({ ...base, calendarType: 'lunar', month: '4', day: '29', year: '1990' }).ok).toBe(true);
  });

  it.each([
    [{ phone: '02-123-4567' }, '휴대폰 번호를 확인해 주세요.'],
    [{ consentPrivacy: false }, '개인정보 수집·이용과 이용약관에 동의해 주세요.'],
    [{ name: '가'.repeat(21) }, '이름은 1자 이상 20자 이하로 입력해 주세요.'],
    [{ email: 'not-an-email' }, '이메일 주소를 확인해 주세요.'],
    [{ product: 'today' }, '상품을 선택해 주세요.'],
    [{ payMethod: 'transfer' }, '결제 방법을 선택해 주세요.'],
    [{ hourSlot: 'noon' }, '태어난 시간을 선택해 주세요.'],
    [{ memo: '가'.repeat(301) }, '남기실 말은 300자까지 쓸 수 있어요.'],
  ])('잘못된 입력 %o 는 거부', (patch, error) => {
    expect(parseReportOrderForm({ ...base, ...patch })).toEqual({ ok: false, error });
  });

  it('객체가 아니면 거부', () => {
    expect(parseReportOrderForm(null).ok).toBe(false);
  });
});

describe('HOUR_SLOTS', () => {
  it('자시 두 칸 + 나머지 11칸 + 모름 = 14칸, 라벨에 한자 없음', () => {
    expect(HOUR_SLOTS).toHaveLength(14);
    expect(HOUR_SLOTS.every((slot) => !/[一-鿿]/.test(slot.label))).toBe(true);
  });
});

describe('canTransition', () => {
  it.each([
    ['awaiting_deposit', 'paid', true],
    ['pending_payment', 'paid', true],
    ['paid', 'generated', true],
    ['generated', 'generated', true],
    ['generated', 'sent', true],
    ['sent', 'sent', false],
    ['sent', 'refunded', true],
    ['sent', 'paid', false],
    ['awaiting_deposit', 'sent', false],
    ['cancelled', 'paid', false],
    ['refunded', 'sent', false],
  ] as const)('%s → %s = %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe('maskName', () => {
  it('가운데 글자를 가린다', () => {
    expect(maskName('김민지')).toBe('김*지');
    expect(maskName('김민')).toBe('김*');
    expect(maskName('남궁민수')).toBe('남**수');
  });
});

describe('reportOrderResultHref', () => {
  it('랜딩 상품이면 완료 화면, 아니면 null', async () => {
    const { reportOrderResultHref } = await import('./report-order');
    expect(reportOrderResultHref({ kind: 'report_order' }, 'ord_1')).toBe('/saju-report/complete?order=ord_1');
    expect(reportOrderResultHref({ kind: 'taste_product' }, 'ord_1')).toBeNull();
  });
});

describe('이름 글자 제한(문자 악용 방지)', () => {
  it('한글·영문·공백만 받는다 — 링크·숫자·기호는 거부', async () => {
    const { parseReportOrderForm } = await import('./parse-report-order');
    expect(parseReportOrderForm({ ...base, name: '김민지 bit.ly/x' })).toEqual({ ok: false, error: '이름은 한글·영문 20자 이내로 입력해 주세요.' });
    expect(parseReportOrderForm({ ...base, name: '홍길동1' }).ok).toBe(false);
    expect(parseReportOrderForm({ ...base, name: 'Kim Minji' }).ok).toBe(true);
  });
});
