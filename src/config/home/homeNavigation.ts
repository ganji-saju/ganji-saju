export const HOME_ROUTES = {
  home: '/',
  sajuPersonality: '/saju/personality',
  personalityCompatibility: '/compatibility/personality',
  todayFortune: '/today-fortune?concern=general',
  tarotDaily: '/tarot/daily',
  tarotDailyPick: '/tarot/daily/pick',
  saju: '/saju',
  sajuNew: '/saju/new',
  compatibility: '/compatibility',
  compatibilityInput: '/compatibility/input',
  daewoon: '/daewoon',
  taekil: '/taekil',
  zodiac: '/zodiac',
  starSign: '/star-sign',
  dialogue: '/dialogue',
  archive: '/my',
  archiveResults: '/my/results',
  pricing: '/pricing',
  membership: '/membership',
  credits: '/credits',
} as const;

export type HomeRouteKey = keyof typeof HOME_ROUTES;
export type HomeRoute = (typeof HOME_ROUTES)[HomeRouteKey];
export type HomeRouteStatus = 'verified' | 'needs_confirmation';

export const HOME_ROUTE_STATUSES = {
  home: 'verified',
  sajuPersonality: 'verified',
  personalityCompatibility: 'verified',
  todayFortune: 'verified',
  tarotDaily: 'verified',
  tarotDailyPick: 'verified',
  saju: 'verified',
  sajuNew: 'verified',
  compatibility: 'verified',
  compatibilityInput: 'verified',
  daewoon: 'verified',
  taekil: 'verified',
  zodiac: 'verified',
  starSign: 'verified',
  dialogue: 'verified',
  archive: 'verified',
  archiveResults: 'needs_confirmation',
  pricing: 'verified',
  membership: 'verified',
  credits: 'verified',
} as const satisfies Record<HomeRouteKey, HomeRouteStatus>;

export const HOME_ROUTE_CONFIRMATION_NOTES = [
  {
    route: HOME_ROUTES.archiveResults,
    status: 'needs_confirmation',
    reason:
      '기존 navigation 일부에서 사용하지만 src/app/my/results/page.tsx route 파일은 확인되지 않았습니다. 홈 보관함 CTA는 실제 존재하는 /my를 우선 사용합니다.',
  },
] as const;
