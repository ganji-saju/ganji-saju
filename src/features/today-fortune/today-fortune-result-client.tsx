'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';
import { PremiumLockCard } from '@/components/today-fortune/premium-lock-card';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
// 2026-05-15 handoff PR-C: 52 m-reveal — 오늘운세 결과 카드 stagger 등장.
import { MotionResultReveal } from '@/components/motion/motion-primitives';
import '@/components/motion/motion-primitives.css';
// 2026-05-15 handoff PR-G3: 58 m-push + push-modal 보드 production mount.
// 결과 페이지 진입 후 20초 + 권한 미허용 + cooldown 7일 경과 시 자동 prompt.
import { PushPermissionPrompt } from '@/components/notifications/push-permission-prompt';

const WEB_PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '';
import { trackMoonlightEvent } from '@/lib/analytics';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import { markPendingUnlock } from '@/lib/today-fortune/unlock-marker';
import type { ConcernId, TodayFortuneFreeResult } from '@/lib/today-fortune/types';
// 2026-07-03 — 오늘운세 공개 공유 티저(/today-fortune/share/[slug]).
import { ShareActions } from '@/features/saju-detail/share-actions';
import { buildKakaoShare } from '@/lib/kakao/share';
import { getCanonicalUrl } from '@/lib/site';

// PR #166 — prefix 버전업. 옛 캐시 (점수 미통일 / 이름 누락) 자동 무효화.
const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:v3:';

// 2026-07-03 — 공유 티저 경로: 날짜를 URL 에 고정해 수신자가 다음 날 열어도
// 발신자가 본 그 날 결과가 재현된다. 이름·걱정도 유지.
function formatShareDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function buildShareTeaserPath(result: TodayFortuneFreeResult): string {
  const query = new URLSearchParams({
    d: result.dateKey,
    ...(result.userName ? { n: result.userName } : {}),
    ...(result.concernId !== 'general' ? { c: result.concernId } : {}),
  });
  return `/today-fortune/share/${result.shareSlug}?${query.toString()}`;
}

// 2026-05-15: 어제 캐시가 오늘 화면을 가리지 않도록 sessionStorage 키에 dateKey 가 붙는다.
// 결과 페이지는 URL 의 sourceSessionId 만 알고 dateKey 는 모르므로, prefix 매칭 후
// dateKey 가 가장 최신인 항목 1건을 선택. (sessionStorage 라 어차피 하루 단위로 비워짐)
function findLatestStoredResult(
  sourceSessionId: string
): TodayFortuneFreeResult | null {
  try {
    // 2026-06-28 — '오늘(KST)' 결과만 사용. sessionStorage 가 모바일/PWA 에서 며칠 살아남으면
    //   '가장 최신' 저장분(이전 날)이 그대로 떠 "오늘운세가 매일 똑같다"고 보이던 문제.
    //   dateKey 가 오늘과 다르면 stale 로 무시 → 결과 페이지가 '다시 보기' 안내 → 오늘 자로 재생성.
    //   (엔진은 일진 기반이라 날마다 달라짐. dateKey 포맷은 getTodayPillarSnapshot 와 동일 YYYY-MM-DD.)
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const exactPrefix = `${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}:`;
    let latest: { dateKey: string; payload: TodayFortuneFreeResult } | null = null;
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key || !key.startsWith(exactPrefix)) continue;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as TodayFortuneFreeResult;
        if (parsed.sourceSessionId !== sourceSessionId) continue;
        const dk = parsed.dateKey ?? '';
        if (dk !== todayKey) continue; // 이전 날 캐시는 표시하지 않는다.
        if (!latest || dk > latest.dateKey) {
          latest = { dateKey: dk, payload: parsed };
        }
      } catch {
        // skip malformed entries
      }
    }
    return latest?.payload ?? null;
  } catch {
    return null;
  }
}


function readStoredResult(sourceSessionId: string | undefined) {
  if (!sourceSessionId) return null;

  // 1) Try date-suffixed key first (new path; today's writer always uses this).
  const latest = findLatestStoredResult(sourceSessionId);
  if (latest) return latest;

  // 2) Backward compatibility — pre-2026-05-15 builds wrote a date-less key.
  //    If found, treat as stale and don't surface it (would replay yesterday's copy).
  try {
    const legacyRaw = window.sessionStorage.getItem(
      `${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}`
    );
    if (legacyRaw) {
      window.sessionStorage.removeItem(`${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}`);
    }
  } catch {
    // ignore
  }
  return null;
}

function buildTodayDetailHref(result: TodayFortuneFreeResult) {
  const params = new URLSearchParams({
    sourceSessionId: result.sourceSessionId,
    concern: result.concernId,
  });

  return `/today-fortune/detail?${params.toString()}`;
}

export function TodayFortuneResultClient({
  sourceSessionId,
  concern,
}: {
  sourceSessionId?: string;
  concern?: string;
}) {
  const router = useRouter();
  const [freeResult, setFreeResult] = useState<TodayFortuneFreeResult | null>(null);
  const concernId = normalizeConcernId(concern);

  useEffect(() => {
    const stored = readStoredResult(sourceSessionId);
    if (!stored) return;

    setFreeResult(stored);
    trackMoonlightEvent('premium_teaser_viewed', {
      from: 'today-fortune-result',
      concern: stored.concernId,
      sourceSessionId: stored.sourceSessionId,
    });
  }, [sourceSessionId]);

  function handleUnlock() {
    if (!freeResult) return;
    // 2026-05-17 PR #201 — detail page 가 자동 POST 트리거할 수 있게 sessionStorage marker.
    markPendingUnlock(freeResult.sourceSessionId);
    // 2026-05-16 fix — window.location.href 는 풀-페이지 리로드라
    //   페이지 전환 직전에 브라우저 default 동작(focus 이동/스크롤)이 노출되며
    //   "화면이 푸터로 점프했다가 페이지 전환" 회귀를 만들었음.
    //   router.push 로 soft navigation 사용해 매끄럽게 전환.
    router.push(buildTodayDetailHref(freeResult));
  }

  return (
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="오늘의 운세" backHref="/today-fortune" />

      {/* 2026-05-15 handoff PR-G3: 오늘운세 결과 진입 + 20초 dwell + 권한 미허용 시
          PushPermissionModal 자동 prompt. 7일 cooldown. */}
      <PushPermissionPrompt delayMs={20_000} webPushPublicKey={WEB_PUSH_PUBLIC_KEY} />

      {/* 2026-07-18 — 무료는 1장 요약(총운·점수·언락 CTA·내 사주·공유·추천)만.
          기회/주의 · 사주 단서 · 후속 질문 · 관련 링크 접힘 블록은 제거됐다. */}
      <div className="grid gap-4 px-4 py-5">
        {!freeResult ? (
          <section className="rounded-[1.8rem] border border-[var(--app-line)] bg-white p-6 text-center shadow-[0_14px_42px_rgba(0,0,0,0.06)]">
            <div className="app-caption">결과를 다시 불러와 주세요</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--app-ink)]">
              무료 결과가 이 브라우저에 남아 있지 않아요
            </h1>
            <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">
              개인정보가 담긴 결과라 공개 URL로 다시 불러오지 않습니다. 오늘운세에서 한 번 더 눌러주세요.
            </p>
            <Link href={`/today-fortune?concern=${concernId}`} className="mt-5 inline-flex">
              <span className="rounded-full bg-[var(--app-pink)] px-5 py-3 text-base font-bold text-white">
                오늘운세 다시 보기
              </span>
            </Link>
          </section>
        ) : (
          <>
            {/* 2026-07-18 — 무료 오늘운세를 **1장짜리 요약본**으로 축소(20260718 PPTX slide6).
                기존엔 총운·상황칩·점수·일진산출내역·카테고리별 풀이·행운패키지 12종·사주 명식·
                대운 CTA·피드백·접힘 추가콘텐츠까지 13개 섹션이 쌓여 무료만으로 배가 불렀다.
                남기는 것: ①총운 헤드라인 ②종합점수 ③유료 언락 CTA ④내 사주 보기 ⑤공유 ⑥하단 추천.
                걷어낸 섹션들의 로직·컴포넌트는 삭제하지 않았다 —
                  · 일진 산출내역/카테고리별/행운패키지/명식은 **유료 '오늘 자세히 보기'** 화면의
                    가치로 유지(무료에서 다 보여주던 것을 유료로 되돌리는 것이 이번 변경의 취지).
                  · 대운 CTA 는 하단 PaidFunnelGrid 의 '대운' 행이 대체.
                  · TodayFeedbackCard(ML 가중치 학습 수집)는 무료 화면에서 제거 —
                    ⚠️ today_fortune_feedback 유입이 끊기므로 학습 데이터가 필요하면
                    유료 detail 화면으로 옮겨 붙일 것. */}
            <MotionResultReveal staggerSeconds={0.08}>
              {/* §1 — date eyebrow + 총운 헤드라인 */}
              <TodayFortuneSummaryCard result={freeResult} />

              {/* §2 — 핑크 banner 큰 점수 + 등급 이모지 */}
              <TodayScoreReveal result={freeResult} />

              {/* §3 — 자세히 보기 unlock + 묶음 비교 CTA(사주 결과 있을 때만) */}
              <PremiumLockCard
                copy={freeResult.nextAction.copy}
                coinCost={freeResult.nextAction.coinCost}
                onUnlock={handleUnlock}
                loading={false}
                sourceSessionId={freeResult.sourceSessionId}
                concernId={freeResult.concernId}
                bundleHref={
                  freeResult.sajuSlug
                    ? `/membership/checkout?product=bundle_today_set&slug=${encodeURIComponent(
                        freeResult.sajuSlug
                      )}&from=today-fortune`
                    : undefined
                }
              />

              {/* §4 — Task 7 크로스링크: 저장된 공통 프로필로 재입력 없이 사주로 전환.
                  시니어 UI 대형 터치 영역 pink pill. */}
              <Link
                href="/saju/new"
                className="flex items-center justify-center gap-2 rounded-full bg-[var(--app-pink)] px-5 py-4 text-[17px] font-extrabold text-white shadow-[0_14px_32px_rgba(216,27,114,0.28)]"
              >
                이 정보로 내 사주 보기
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>

              {/* 친구에게 공유 — 2026-07-03 공개 티저(/today-fortune/share/[slug]?d=날짜):
                  수신자가 로그인 없이 같은 날 무료 결과(한 줄+점수)를 재계산해 봄. 유료 미포함.
                  shareSlug 는 신규 결과부터 존재(구 sessionStorage payload 는 미노출). */}
              {freeResult.shareSlug ? (
                <section>
                  <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">친구에게 공유</h2>
                  <ShareActions
                    text={`${freeResult.userName ?? '나'}님의 ${formatShareDateLabel(freeResult.dateKey)} 운세 — ${freeResult.oneLine.headline}`}
                    url={getCanonicalUrl(buildShareTeaserPath(freeResult))}
                    className="mt-2.5"
                    kakao={buildKakaoShare({
                      title: `${freeResult.userName ?? '나'}님의 ${formatShareDateLabel(freeResult.dateKey)} 운세`,
                      description: freeResult.oneLine.headline,
                      path: buildShareTeaserPath(freeResult),
                      buttonTitle: '운세 보기',
                    })}
                  />
                </section>
              ) : null}

              {/* §6 — 하단 추천(썸네일 리스트). 사주·궁합·대운·택일 + 멤버십 진입점.
                  2026-07-18: 접혀 있던 '더 깊이 들여다보기'(기회/주의 · 사주 단서 · 후속 질문 ·
                  관련 링크) 블록을 제거하면서, 다음 행동 진입점은 이 리스트로 일원화했다. */}
              <PaidFunnelGrid from="today-fortune" tone="light" includeMembership />
            </MotionResultReveal>
          </>

        )}
      </div>
    </div>
  );
}
