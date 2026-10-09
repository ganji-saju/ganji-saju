// 올해운 노트 입력 → 사주 입력. 간지사주 입력(submit-saju.ts)과 **같은 해석기·같은 기본값**이어야
//   같은 사주로 인식되고 재구매 차단이 맞는다(설계 §3-3). 분·출생지·시간 규칙은 간지사주 입력처럼 받지 않는다.
import type { BirthInput } from '@/lib/saju/types';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';

export interface PartnerBirthForm {
  calendarType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  hour: string;
  unknownBirthTime: boolean;
  gender: string;
}

export function toPartnerBirthInput(form: PartnerBirthForm): { ok: true; input: BirthInput } | { ok: false; error: string } {
  const hour = form.unknownBirthTime ? '' : form.hour;
  const parsed = resolveUnifiedBirthInput(
    {
      calendarType: form.calendarType, timeRule: 'standard', year: form.year, month: form.month, day: form.day,
      hour, minute: '', unknownBirthTime: hour === '', gender: form.gender,
      birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '',
    },
    { requireGender: true },
  );
  return parsed.ok ? { ok: true, input: parsed.input } : { ok: false, error: parsed.error };
}
