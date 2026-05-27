'use server';

import { Lunar } from 'lunar-typescript';
import { redirect } from 'next/navigation';
import { deriveZodiacSlug, deriveZodiacSlugFromBirthInput } from '@/lib/profile-personalization';
import type { BirthInput } from '@/lib/saju/types';

// 띠운세 진입용 경량 액션 — 생년월일만 받아 입춘 반영 띠를 계산하고 상세로 이동.
// 사주(/saju/new)와 달리 시간·성별·출생지는 받지 않는다(띠 판정에 불필요).
export async function resolveZodiacByBirth(formData: FormData) {
  const year = Number.parseInt(String(formData.get('year') ?? ''), 10);
  const month = Number.parseInt(String(formData.get('month') ?? ''), 10);
  const day = Number.parseInt(String(formData.get('day') ?? ''), 10);
  const calendarType = String(formData.get('calendarType') ?? 'solar');

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    redirect('/zodiac');
  }

  let solarYear = year;
  let solarMonth = month;
  let solarDay = day;
  if (calendarType === 'lunar') {
    const solar = Lunar.fromYmd(year, month, day).getSolar();
    solarYear = solar.getYear();
    solarMonth = solar.getMonth();
    solarDay = solar.getDay();
  }

  const input: BirthInput = {
    year: solarYear,
    month: solarMonth,
    day: solarDay,
    unknownTime: true,
  };

  let slug: string;
  try {
    slug = deriveZodiacSlugFromBirthInput(input);
  } catch {
    // 사주 엔진 계산 실패 시 연도 바탕으로 폴백(입춘 경계만 부정확)
    slug = deriveZodiacSlug(solarYear);
  }

  redirect(`/zodiac/${slug}`);
}
