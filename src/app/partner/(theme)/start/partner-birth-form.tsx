'use client';

// 사주 생성은 간지사주와 같은 POST /api/readings. 로그인 여부는 결제 페이지(서버)가 판정해 /partner/login 으로 보낸다.
import { useState } from 'react';
import { toSlug } from '@/lib/saju/pillars';
import { NOTE_CARD, NOTE_PRIMARY_BUTTON } from '@/features/partner-theme/note-theme';
import { toPartnerBirthInput, type PartnerBirthForm } from '@/features/partner-theme/partner-birth';

const FIELD = 'w-full rounded-[12px] border border-[var(--note-line)] bg-white px-3 py-3 text-[17px] text-[var(--note-ink)]';
const HOURS = Array.from({ length: 24 }, (_, h) => String(h));

const checkoutHref = (slug: string) => `/partner/checkout?slug=${encodeURIComponent(slug)}`;

export function PartnerBirthFormView() {
  const [form, setForm] = useState<PartnerBirthForm>({ calendarType: 'solar', year: '', month: '', day: '', hour: '', unknownBirthTime: false, gender: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PartnerBirthForm>) => setForm((prev) => ({ ...prev, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.unknownBirthTime && form.hour === '') return setError("태어난 시간을 고르거나 '태어난 시간을 몰라요'를 눌러 주세요.");
    const parsed = toPartnerBirthInput(form);
    if (!parsed.ok) return setError(parsed.error);
    setError('');
    setBusy(true);
    let response: Response;
    try {
      response = await fetch('/api/readings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.input) });
    } catch {
      // 간지사주 입력과 같은 규칙: 요청 자체가 실패하면 계산된 사주 주소로 넘어간다(submit-saju.ts).
      return location.assign(checkoutHref(toSlug(parsed.input)));
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!response.ok || !data.id) {
      setBusy(false);
      // 서버 원문 오류는 5xx 에서 노출하지 않는다.
      return setError(response.status >= 500 || !data.error ? '사주를 만들지 못했어요. 잠시 후 다시 시도해 주세요.' : data.error);
    }
    location.assign(checkoutHref(data.id));
  }

  return (
    <form onSubmit={submit} className={`${NOTE_CARD} grid gap-4`}>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-[15px] font-bold">달력</legend>
        {(['solar', 'lunar'] as const).map((value) => (
          <label key={value} className={`${FIELD} flex items-center gap-2`}>
            <input type="radio" name="calendarType" checked={form.calendarType === value} onChange={() => set({ calendarType: value })} />
            {value === 'solar' ? '양력' : '음력'}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-3 gap-2">
        <label className="grid gap-1 text-[14px]">년<input className={FIELD} inputMode="numeric" maxLength={4} placeholder="1990" value={form.year} onChange={(e) => set({ year: e.target.value })} required /></label>
        <label className="grid gap-1 text-[14px]">월<input className={FIELD} inputMode="numeric" maxLength={2} placeholder="5" value={form.month} onChange={(e) => set({ month: e.target.value })} required /></label>
        <label className="grid gap-1 text-[14px]">일<input className={FIELD} inputMode="numeric" maxLength={2} placeholder="15" value={form.day} onChange={(e) => set({ day: e.target.value })} required /></label>
      </div>
      <label className="grid gap-1 text-[14px]">
        태어난 시간
        <select className={FIELD} value={form.hour} disabled={form.unknownBirthTime} onChange={(e) => set({ hour: e.target.value })}>
          <option value="">선택</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={form.unknownBirthTime} onChange={(e) => set({ unknownBirthTime: e.target.checked })} />
        태어난 시간을 몰라요
      </label>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-2 text-[15px] font-bold">성별</legend>
        {([['female', '여성'], ['male', '남성']] as const).map(([value, label]) => (
          <label key={value} className={`${FIELD} flex items-center gap-2`}>
            <input type="radio" name="gender" checked={form.gender === value} onChange={() => set({ gender: value })} />
            {label}
          </label>
        ))}
      </fieldset>
      {error ? <p role="alert" className="text-[15px] font-bold text-[var(--note-coral-ink)]">{error}</p> : null}
      <button type="submit" disabled={busy} className={NOTE_PRIMARY_BUTTON}>{busy ? '확인하는 중…' : '다음'}</button>
    </form>
  );
}
