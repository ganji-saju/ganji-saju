// 2026-07-18 — 무료 메뉴 "하루 1번" 제한(20260718 PPTX slide3).
//
// 배경: 무료 4종(오늘운세·타로·꿈해몽·대화상담)에 하루 제한이 **전혀 없었다**.
//   오늘운세·타로·꿈해몽은 비로그인 익명에게도 무제한 서빙 중이었고, 대화상담만
//   "평생 3턴"(일 단위 아님) 제한이 있었다.
//
// 설계(사용자 확정: 디바이스 + 계정 병행):
//   · 비로그인 → **쿠키에 KST 날짜키**를 남겨 같은 날 재사용을 차단. 쿠키를 지우면 우회되지만
//     무료 진입에 로그인 장벽을 만들지 않는 쪽을 택했다(가입은 결제 직전에만 요구하는 현 설계 유지).
//   · 로그인 → membership_benefit_usage 의 consume_member_benefit RPC(056)로 **계정 기준** 차단.
//     이 테이블은 (user_id, benefit, period_key, used_count) 로 generic 이라 benefit 키만
//     새로 쓰면 되고 **마이그레이션이 필요 없다**. (user_id 가 auth.users FK 라 익명은 못 담는다
//     — 익명을 쿠키로 처리하는 이유.)
//   · 로그인 사용자는 쿠키·계정 **둘 다** 소비한다. 계정 기록이 진실이고, 쿠키는 같은 기기에서
//     로그아웃 후 이어 쓰는 것을 막는 보조 장치.
//
// 멤버십 회원은 제한 대상이 아니다 — 이미 결제한 사용자를 무료 요약에서 막는 건 순수 손해라
//   호출부에서 isPremiumMember 등으로 선판정해 skip 한다(이 모듈은 판정하지 않는다).

import { cookies } from 'next/headers';
import {
  consumeMemberBenefit,
  dailyPeriodKey,
  getMemberBenefitUsed,
} from '@/lib/credits/member-benefits';
import { getMemberTier } from '@/lib/subscription';

export const FREE_DAILY_LIMIT = 1;

export const FREE_DAILY_SURFACES = {
  today: { cookie: 'gj_free_today', benefit: 'free_today_daily', label: '간단운세' },
  tarot: { cookie: 'gj_free_tarot', benefit: 'free_tarot_daily', label: '딱 3장 타로' },
  dream: { cookie: 'gj_free_dream', benefit: 'free_dream_daily', label: '한 단어 꿈해몽' },
  dialogue: {
    cookie: 'gj_free_dialogue',
    benefit: 'free_dialogue_daily',
    label: '질문 하나 대화상담',
  },
} as const;

export type FreeSurface = keyof typeof FREE_DAILY_SURFACES;

/**
 * 하루 1회 제한 면제 여부. 유료 멤버(프리미엄·라이트 모두)는 면제한다 —
 * 이미 결제한 사용자를 무료 요약에서 막는 건 전환에 도움이 안 되고 CS 만 늘린다.
 */
export async function isFreeDailyExempt(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await getMemberTier(userId)) !== null;
}

/** 쿠키 만료 = KST 다음 자정. 날짜가 바뀌면 쿠키도 자연 소멸. */
function secondsUntilKstMidnight(now: Date = new Date()): number {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstMidnight = new Date(kstNow);
  kstMidnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((kstMidnight.getTime() - kstNow.getTime()) / 1000));
}

/**
 * 오늘 이미 썼는지 판정(소비 없음).
 * userId 가 있으면 계정 사용량이 우선 진실 — 쿠키가 없어도 계정에 기록이 있으면 차단.
 */
export async function isFreeDailyUsed(
  surface: FreeSurface,
  userId: string | null | undefined
): Promise<boolean> {
  const conf = FREE_DAILY_SURFACES[surface];
  const periodKey = dailyPeriodKey();

  if (userId) {
    const used = await getMemberBenefitUsed(userId, conf.benefit, periodKey);
    if (used >= FREE_DAILY_LIMIT) return true;
  }

  try {
    const store = await cookies();
    return store.get(conf.cookie)?.value === periodKey;
  } catch {
    // cookies() 사용 불가 컨텍스트 — 쿠키 판정만 건너뛴다(계정 판정은 위에서 끝).
    return false;
  }
}

/**
 * 1회 소비 처리. 이미 소진이면 false(호출부가 차단 응답).
 * 쿠키 set 은 route handler 응답에 실어야 하므로 cookieToSet 을 돌려준다.
 */
export async function consumeFreeDaily(
  surface: FreeSurface,
  userId: string | null | undefined
): Promise<{ allowed: boolean; cookie: { name: string; value: string; maxAge: number } }> {
  const conf = FREE_DAILY_SURFACES[surface];
  const periodKey = dailyPeriodKey();
  const cookie = {
    name: conf.cookie,
    value: periodKey,
    maxAge: secondsUntilKstMidnight(),
  };

  // 쿠키 선판정 — 익명/로그인 공통. 같은 기기에서 오늘 이미 썼으면 계정 카운트를 태우지 않는다.
  let cookieBlocked = false;
  try {
    const store = await cookies();
    cookieBlocked = store.get(conf.cookie)?.value === periodKey;
  } catch {
    cookieBlocked = false;
  }
  if (cookieBlocked) return { allowed: false, cookie };

  if (userId) {
    // 원자적 소비. 한도 초과면 false.
    const ok = await consumeMemberBenefit(userId, conf.benefit, periodKey, FREE_DAILY_LIMIT);
    if (!ok) return { allowed: false, cookie };
  }

  return { allowed: true, cookie };
}

/**
 * 은/는 조사 선택 — 받침 유무로 결정.
 * ('꿈해몽는' / '대화상담는' 같은 비문 방지. 라벨이 자유 문자열이라 하드코딩 불가.)
 */
function topicParticle(word: string): '은' | '는' {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  // 한글 음절 영역이 아니면 기본 '는'.
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return '는';
  // (음절 - 0xAC00) % 28 === 0 이면 받침 없음.
  return (code - 0xac00) % 28 === 0 ? '는' : '은';
}

/** 차단 응답 본문 — 클라가 그대로 노출할 수 있는 한국어 문구. */
export function freeDailyLimitMessage(surface: FreeSurface): string {
  const { label } = FREE_DAILY_SURFACES[surface];
  return `${label}${topicParticle(label)} 하루 한 번 볼 수 있어요. 내일 다시 만나요.`;
}
