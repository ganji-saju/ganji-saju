// 2026-05-15 PR-L: onboarding CTA 클릭 시 cookie set + redirect.
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ONBOARD_COOKIE = 'moonlight:onboarded';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

async function setOnboardedCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ONBOARD_COOKIE, '1', {
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false, // client 가 reset 할 수도 있도록
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function finishOnboardingAndStart() {
  await setOnboardedCookie();
  redirect('/saju/new');
}

export async function skipOnboarding() {
  await setOnboardedCookie();
  redirect('/');
}
