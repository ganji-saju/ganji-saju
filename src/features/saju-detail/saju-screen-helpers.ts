import type { SajuDataV1, SajuPillar } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { BirthInput } from '@/lib/saju/types';
import { koreanizeGanzi } from '@/lib/saju/terminology';

export function formatBirthSummary(input: BirthInput) {
  const minuteLabel =
    input.hour !== undefined && input.minute !== undefined
      ? ` ${String(input.minute).padStart(2, '0')}분`
      : '';
  const solarTimeLabel =
    input.solarTimeMode === 'longitude' ? '진태양시' : '표준시';
  const timeLabel =
    input.hour !== undefined
      ? `${input.hour}시${minuteLabel} 입력 · ${solarTimeLabel}`
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

// 2026-08-30 #713 — 사주 도식의 한자 밑 라벨.
//
//   제보: "천간 천간 천간 천간 / 지지 지지 지지 지지 — 이게 맞는 거야? 원래 한자에 따라
//   밑에 글씨도 다른 거 아니야?" 맞다. '천간'·'지지' 는 **행 이름**이지 칸 값이 아니라
//   네 기둥에 같은 글자가 반복되고 있었다(열마다 정보량 0).
//
//   PDF(report-document)는 처음부터 기둥별 십신을 찍고 있었다 — 웹 도식만 버리고 있었다.
//
//   ⚠️ 지지의 십신은 **지장간 본기(정기)** 기준이다. BRANCH_HIDDEN_STEMS 는 12지 전부
//      정기를 첫 번째로 두므로 hiddenStems[0] 이 본기다(hidden-stem-order.spec.ts 가 고정).
//      순서가 뒤집히면 도식에 **틀린 십신**이 조용히 박힌다 — 화면은 멀쩡해 보인다.
export function pillarCellLabels(pillar: SajuPillar | null, isDayPillar: boolean) {
  if (!pillar) return { stem: '-', branch: '-' };
  // 일간은 자기 자신이라 십신이 없다(stemTenGod = null). 만세력 관례대로 '일원'.
  const stemGod = isDayPillar ? '일원' : pillar.stemTenGod ?? '-';
  const branchGod = pillar.hiddenStems[0]?.tenGod ?? '-';
  return {
    stem: `${koreanizeGanzi(pillar.stem)} · ${stemGod}`,
    branch: `${koreanizeGanzi(pillar.branch)} · ${branchGod}`,
  };
}
