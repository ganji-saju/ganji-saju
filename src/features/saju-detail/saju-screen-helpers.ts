import type { SajuDataV1, SajuPillar } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { BirthInput } from '@/lib/saju/types';

export function formatBirthSummary(input: BirthInput) {
  const minuteLabel =
    input.hour !== undefined && input.minute !== undefined
      ? ` ${String(input.minute).padStart(2, '0')}분`
      : '';
  const solarTimeLabel =
    input.solarTimeMode === 'longitude' ? '진태양시' : '표준시';
  const timeLabel =
    input.hour !== undefined
      ? `${input.hour}시${minuteLabel} 기준 · ${solarTimeLabel}`
      : '태어난 시간 미입력';
  const genderLabel = input.gender
    ? input.gender === 'male'
      ? '남성'
      : '여성'
    : '성별 미선택';
  const locationSource = input.birthLocation?.label ?? input.birthLocation?.code ?? null;
  const locationLabel = locationSource
    ? `${locationSource}${input.solarTimeMode === 'longitude' ? ' · 경도 보정 반영' : ''}`
    : '출생 지역 미입력';

  return `${input.year}년 ${input.month}월 ${input.day}일 · ${timeLabel} · ${genderLabel} · ${locationLabel}`;
}

export function getPillarEntries(data: SajuDataV1 | SajuDataV2) {
  return [
    { label: '시', pillar: data.pillars.hour },
    { label: '일', pillar: data.pillars.day },
    { label: '월', pillar: data.pillars.month },
    { label: '년', pillar: data.pillars.year },
  ] as const;
}

export function formatHiddenStems(pillar: SajuPillar | null) {
  if (!pillar || pillar.hiddenStems.length === 0) return null;
  return pillar.hiddenStems.map((item) => item.stem).join(' · ');
}

export function formatElementPercent(value: number) {
  return `${Math.round(value)}%`;
}
