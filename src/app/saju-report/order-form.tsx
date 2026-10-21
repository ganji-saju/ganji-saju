'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { requestNicepayPayment, toNicepayMethod } from '@/lib/payments/nicepay-checkout';
import { HOUR_SLOTS, type ReportProduct } from '@/lib/report-orders/report-order';
import styles from './saju-report.module.css';

export interface ReportPrices {
  lifetime: { price: number; compareAt: number | null };
  'new-year': { price: number; compareAt: number | null };
}

const PRODUCTS: { id: ReportProduct; name: string }[] = [
  { id: 'lifetime', name: '종합사주 1인' },
  { id: 'new-year', name: '2027 신년운세' },
];
// 카드·간편결제는 나이스페이 결제창, 무통장은 관리자 입금 확인.
const PG_METHODS = [
  { code: 'CARD', label: '신용·체크카드' },
  { code: 'KAKAOPAY', label: '카카오페이' },
  { code: 'NAVERPAY', label: '네이버페이' },
] as const;

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const years = Array.from({ length: 2026 - 1930 + 1 }, (_, i) => String(2026 - i));
const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

interface BankResult {
  orderNo: string;
  amount: number;
  bank: string;
  account: string;
  holder: string;
  depositDueAt: string | null;
}

function productFromHash(): ReportProduct | null {
  if (typeof window === 'undefined') return null;
  if (window.location.hash === '#order-lifetime') return 'lifetime';
  if (window.location.hash === '#order-new-year') return 'new-year';
  return null;
}

export function OrderForm({ prices, bankEnabled }: { prices: ReportPrices; bankEnabled: boolean }) {
  const [product, setProduct] = useState<ReportProduct | ''>(() => productFromHash() ?? '');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [hourSlot, setHourSlot] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [memo, setMemo] = useState('');
  const [pay, setPay] = useState<string>('CARD');
  const [cashReceipt, setCashReceipt] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bankResult, setBankResult] = useState<BankResult | null>(null);

  // 상품 카드의 "이 상품 선택"(#order-lifetime / #order-new-year) 으로 내려오면 그 상품을 골라 둔다.
  useEffect(() => {
    const onHash = () => {
      const next = productFromHash();
      if (next) setProduct(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function missing(): string {
    if (!product) return '상품을 선택해 주세요.';
    if (!name.trim()) return '이름을 입력해 주세요.';
    if (!gender) return '성별을 선택해 주세요.';
    if (!year || !month || !day) return '생년월일을 선택해 주세요.';
    if (!hourSlot) return '태어난 시간을 선택해 주세요.';
    if (!phone.trim()) return '휴대폰 번호를 입력해 주세요.';
    if (!email.trim()) return '이메일을 입력해 주세요.';
    if (!consentPrivacy || !consentTerms) return '개인정보 수집·이용과 이용약관에 동의해 주세요.';
    return '';
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const problem = missing();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const payMethod = pay === 'bank' ? pay : 'card';
      const source = new URLSearchParams(window.location.search).get('utm_source');
      const res = await fetch('/api/report-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product, payMethod, name, gender, calendarType, year, month, day, hourSlot, phone, email, memo,
          cashReceipt: payMethod === 'bank' && cashReceipt, consentPrivacy, consentTerms, source,
        }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !data?.ok) {
        setError(typeof data?.error === 'string' ? data.error : '신청을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        return;
      }
      if (data.payMethod === 'bank') {
        setBankResult(data as unknown as BankResult);
        return;
      }
      await requestNicepayPayment({
        orderId: String(data.orderId),
        amount: Number(data.amount),
        goodsName: String(data.goodsName),
        method: toNicepayMethod(pay),
        onError: (message) => setError(message),
      });
    } catch {
      setError('신청을 보내지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (bankResult) {
    const due = bankResult.depositDueAt
      ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(bankResult.depositDueAt))
      : null;
    return (
      <div className={styles.bankDone} role="status">
        <h3 className={styles.h3}>신청이 접수됐어요</h3>
        <p>아래 계좌로 입금해 주시면, 확인 후 영업일 1~2일 안에 문자와 이메일로 풀이를 보내 드려요.</p>
        <dl className={styles.bankList}>
          <dt>입금 계좌</dt><dd>{bankResult.bank} {bankResult.account}</dd>
          <dt>예금주</dt><dd>{bankResult.holder}</dd>
          <dt>금액</dt><dd>{won(bankResult.amount)}</dd>
          <dt>입금자명: {name}</dt><dd>신청하신 분 이름으로 입금해 주세요.</dd>
          {due ? (<><dt>입금 기한</dt><dd>{due}까지</dd></>) : null}
          <dt>주문번호</dt><dd>{bankResult.orderNo}</dd>
        </dl>
        <p className={styles.small}>같은 내용을 문자로도 보내 드렸어요.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>상품 선택</legend>
        {PRODUCTS.map((p) => (
          <label key={p.id} className={styles.choiceCard} htmlFor={`report-order-product-${p.id}`}>
            <input id={`report-order-product-${p.id}`} type="radio" name="product" value={p.id}
              checked={product === p.id} onChange={() => setProduct(p.id)} />
            <span className={styles.choiceName}>{p.name}</span>
            <span className={styles.choicePrice}>
              {prices[p.id].compareAt ? <s>{won(prices[p.id].compareAt!)}</s> : null} <strong>{won(prices[p.id].price)}</strong>
            </span>
          </label>
        ))}
      </fieldset>

      <label className={styles.label} htmlFor="report-order-name">이름</label>
      <input id="report-order-name" className={styles.input} value={name} maxLength={20} autoComplete="name"
        onChange={(e) => setName(e.target.value)} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>성별</legend>
        <div className={styles.row}>
          {[['female', '여성'], ['male', '남성']].map(([v, l]) => (
            <label key={v} className={styles.pill} htmlFor={`report-order-gender-${v}`}>
              <input id={`report-order-gender-${v}`} type="radio" name="gender" value={v} checked={gender === v} onChange={() => setGender(v)} /> {l}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>생년월일</legend>
        <div className={styles.row}>
          {[['solar', '양력'], ['lunar', '음력']].map(([v, l]) => (
            <label key={v} className={styles.pill} htmlFor={`report-order-calendar-${v}`}>
              <input id={`report-order-calendar-${v}`} type="radio" name="calendarType" value={v}
                checked={calendarType === v} onChange={() => setCalendarType(v as 'solar' | 'lunar')} /> {l}
            </label>
          ))}
        </div>
        <div className={styles.row}>
          <select id="report-order-year" aria-label="태어난 해" className={styles.select} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">년</option>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select id="report-order-month" aria-label="태어난 달" className={styles.select} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">월</option>
            {months.map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
          <select id="report-order-day" aria-label="태어난 날" className={styles.select} value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="">일</option>
            {days.map((d) => <option key={d} value={d}>{d}일</option>)}
          </select>
        </div>
      </fieldset>

      <label className={styles.label} htmlFor="report-order-hour">태어난 시간</label>
      <select id="report-order-hour" className={styles.select} value={hourSlot} onChange={(e) => setHourSlot(e.target.value)}>
        <option value="">시간을 골라 주세요</option>
        {HOUR_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
      </select>

      <label className={styles.label} htmlFor="report-order-phone">휴대폰 번호 <span className={styles.hint}>(풀이 링크를 문자로 보내 드려요)</span></label>
      <input id="report-order-phone" className={styles.input} inputMode="tel" autoComplete="tel" placeholder="010-0000-0000"
        value={phone} onChange={(e) => setPhone(e.target.value)} />

      <label className={styles.label} htmlFor="report-order-email">이메일</label>
      <input id="report-order-email" className={styles.input} type="email" inputMode="email" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className={styles.label} htmlFor="report-order-memo">남기실 말 <span className={styles.hint}>(선택)</span></label>
      <textarea id="report-order-memo" className={styles.textarea} maxLength={300} rows={3}
        placeholder="요즘 가장 궁금한 점을 적어 주세요" value={memo} onChange={(e) => setMemo(e.target.value)} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>결제 방법</legend>
        <div className={styles.payGrid}>
          {PG_METHODS.map((m) => (
            <label key={m.code} className={styles.pill} htmlFor={`report-order-pay-${m.code}`}>
              <input id={`report-order-pay-${m.code}`} type="radio" name="pay" value={m.code} checked={pay === m.code} onChange={() => setPay(m.code)} /> {m.label}
            </label>
          ))}
          {bankEnabled ? (
            <label className={styles.pill} htmlFor="report-order-pay-bank">
              <input id="report-order-pay-bank" type="radio" name="pay" value="bank" checked={pay === 'bank'} onChange={() => setPay('bank')} /> 무통장 입금
            </label>
          ) : null}
        </div>
        {pay === 'bank' ? (
          <label className={styles.check} htmlFor="report-order-cash-receipt">
            <input id="report-order-cash-receipt" type="checkbox" checked={cashReceipt} onChange={(e) => setCashReceipt(e.target.checked)} />
            현금영수증 신청 (휴대폰 번호로 발급)
          </label>
        ) : null}
      </fieldset>

      <div className={styles.consents}>
        <label className={styles.check} htmlFor="report-order-consent-privacy">
          <input id="report-order-consent-privacy" type="checkbox" checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />
          <span>[필수] 개인정보 수집·이용 동의 — 이름·생년월일시·성별·휴대폰·이메일을 풀이 제작과 발송에 쓰고, 발송 1년 뒤 지웁니다. <a href="/privacy" target="_blank" rel="noreferrer">자세히</a></span>
        </label>
        <label className={styles.check} htmlFor="report-order-consent-terms">
          <input id="report-order-consent-terms" type="checkbox" checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
          <span>[필수] <a href="/terms" target="_blank" rel="noreferrer">이용약관</a>·<a href="/refund-policy" target="_blank" rel="noreferrer">환불 기준</a>에 동의합니다.</span>
        </label>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <button type="submit" className={styles.primary} disabled={busy}>
        {busy ? '처리 중…' : pay === 'bank' ? '무통장 입금으로 신청하기' : '결제하고 신청하기'}
      </button>
    </form>
  );
}
