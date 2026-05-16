'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GangiPageHeader, GangiSection } from '@/components/gangi/gangi-ui';
import { FollowUpQuestionChips } from '@/components/today-fortune/follow-up-question-chips';
import { OpportunityRiskCards } from '@/components/today-fortune/opportunity-risk-cards';
import { PremiumLockCard } from '@/components/today-fortune/premium-lock-card';
import { SajuReasonSnippet } from '@/components/today-fortune/saju-reason-snippet';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { SituationReflectionCard } from '@/components/saju/situation-reflection-card';
// 2026-05-15 PR 1 — 운세톡톡 벤치마크 적용 (간지사주_무료일진운세_적용방안.md).
// 카테고리 카드 stacked 풀이 + 사주 명식 신뢰 카드 + 대운 CTA.
import { TodayCategoryReadings } from '@/components/today-fortune/today-category-readings';
import { TodaySajuChartCard } from '@/components/today-fortune/today-saju-chart-card';
import { TodayDaewoonCtaCard } from '@/components/today-fortune/today-daewoon-cta-card';
// 2026-05-15 PR 2 — 운세톡톡 벤치마크: 행운 패키지 12종 + 로또 번호 오행색 시각화.
import { TodayLuckyPackageCard } from '@/components/today-fortune/today-lucky-package-card';
// 2026-05-15 PR 3 — 운세톡톡 벤치마크: 일진 점수 산출 내역 + 발동 케이스 메시지.
import { TodayIljinBreakdownCard } from '@/components/today-fortune/today-iljin-breakdown-card';
// 2026-05-15 PR 9 — 03 ML 가중치 학습: 사용자 피드백 카드.
import { TodayFeedbackCard } from '@/components/today-fortune/today-feedback-card';
// 2026-05-15 handoff PR-C: 52 m-reveal — 오늘운세 결과 카드 stagger 등장.
import { MotionResultReveal } from '@/components/motion/motion-primitives';
import '@/components/motion/motion-primitives.css';
// 2026-05-15 handoff PR-G3: 58 m-push + push-modal 보드 production mount.
// 결과 페이지 진입 후 20초 + 권한 미허용 + cooldown 7일 경과 시 자동 prompt.
import { PushPermissionPrompt } from '@/components/notifications/push-permission-prompt';

const WEB_PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '';
import { trackMoonlightEvent } from '@/lib/analytics';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type { ConcernId, TodayFortuneFreeResult } from '@/lib/today-fortune/types';

// PR #166 — prefix 버전업. 옛 캐시 (점수 미통일 / 이름 누락) 자동 무효화.
const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:v3:';

// 2026-05-15: 어제 캐시가 오늘 화면을 가리지 않도록 sessionStorage 키에 dateKey 가 붙는다.
// 결과 페이지는 URL 의 sourceSessionId 만 알고 dateKey 는 모르므로, prefix 매칭 후
// dateKey 가 가장 최신인 항목 1건을 선택. (sessionStorage 라 어차피 하루 단위로 비워짐)
function findLatestStoredResult(
  sourceSessionId: string
): TodayFortuneFreeResult | null {
  try {
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

const RELATED_LINKS: Record<ConcernId, Array<{ label: string; href: string; body: string }>> = {
  love_contact: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '상대와의 거리와 속도를 더 넓게 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 어떤 말투가 편한지 바로 물어볼 수 있어요.' },
  ],
  money_spend: [
    { label: '사주로 더 보기', href: '/saju/new', body: '돈이 새는 습관과 선택 패턴을 이어서 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 결제해도 되는지 짧게 물어볼 수 있어요.' },
  ],
  work_meeting: [
    { label: '사주로 더 보기', href: '/saju/new', body: '일과 역할의 큰 흐름을 이어서 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '미팅에서 꺼낼 말과 줄일 말을 물어볼 수 있어요.' },
  ],
  relationship_conflict: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '상대와 부딪히는 지점을 같이 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오해를 줄이는 한마디를 바로 물어볼 수 있어요.' },
  ],
  energy_health: [
    { label: '사주로 더 보기', href: '/saju/new', body: '생활 리듬과 회복 패턴을 이어서 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 무리하지 않는 기준을 물어볼 수 있어요.' },
  ],
  general: [
    { label: '타로로 보완하기', href: '/tarot/daily', body: '지금 마음의 결을 카드 한 장으로 가볍게 봅니다.' },
    { label: '사주로 더 보기', href: '/saju/new', body: '오늘을 넘어서 내 기본 흐름까지 이어서 봅니다.' },
  ],
};

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
  // 2026-05-15 PR 9: 피드백 카드 dwell 측정용 — 결과 페이지 mount 시점.
  const [enterAt] = useState(() => Date.now());
  const concernId = normalizeConcernId(concern);
  const relatedLinks = useMemo(() => RELATED_LINKS[freeResult?.concernId ?? concernId], [concernId, freeResult]);

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

      {/* Redesign 2026-05-13: mockup screens-a.jsx ScreenToday 의 4 핵심 섹션을 상단에 배치하고,
          기존 추가 무료 콘텐츠(기회/주의 / 사주 단서 / 후속 질문 / 관련 링크)는 하단 details 로 접어 보존. */}
      <div className="grid gap-4 px-4 py-5">
        {!freeResult ? (
          <section className="rounded-[1.8rem] border border-[var(--app-line)] bg-white p-6 text-center shadow-[0_14px_42px_rgba(0,0,0,0.06)]">
            <div className="app-caption">결과를 다시 불러와 주세요</div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--app-ink)]">
              무료 결과가 이 브라우저에 남아 있지 않아요
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
              개인정보가 담긴 결과라 공개 URL로 다시 불러오지 않습니다. 오늘운세에서 한 번 더 눌러주세요.
            </p>
            <Link href={`/today-fortune?concern=${concernId}`} className="mt-5 inline-flex">
              <span className="rounded-full bg-[var(--app-pink)] px-5 py-3 text-sm font-bold text-white">
                오늘운세 다시 보기
              </span>
            </Link>
          </section>
        ) : (
          <>
            {/* 2026-05-15 handoff 52 m-reveal — 오늘운세 결과 카드 stagger 등장.
                PR 1: 운세톡톡 벤치마크 적용으로 §3 카테고리 stacked + §5 사주 명식
                + §7 대운 CTA 추가. 기존 §1·§2·§4·§6 unlock 은 유지. */}
            <MotionResultReveal staggerSeconds={0.08}>
              {/* §1 — date eyebrow + 총운 헤드라인 */}
              <TodayFortuneSummaryCard result={freeResult} />

              {/* §1.2 — PR #149 (Part C) — 사용자 상황 chip strip (compact).
                  미입력이면 silent null, 입력 있으면 "✓ 반영 · 💼 직장인 · ..." 한 줄. */}
              {freeResult.userSituation ? (
                <div className="px-1">
                  <SituationReflectionCard
                    situation={freeResult.userSituation}
                    variant="compact"
                    fallbackInputHref="/saju/new"
                  />
                </div>
              ) : null}

              {/* §2 — 핑크 banner 큰 점수 + 등급 이모지 (PR 1: 🌟😊🙂😐😕⚠️) */}
              <TodayScoreReveal result={freeResult} />

              {/* §2.5 — 일진 점수 산출 내역 (PR 3 신설): 8영역 +/- 점수 + 발동 케이스 메시지.
                  운세톡톡 6-2: "총점뿐 아니라 영역별 점수도 보여주면 명리 신뢰도가 올라간다". */}
              {freeResult.iljinScore ? (
                <TodayIljinBreakdownCard
                  iljinScore={freeResult.iljinScore}
                  iljinMessages={freeResult.iljinMessages ?? null}
                />
              ) : null}

              {/* §3 — 카테고리별 자세히 (PR 1 신설): 직장/재물/애정/관계/컨디션
                  블루 헤드라인 + 4~6줄 본문. 운세톡톡 핵심 차용.
                  2026-05-16 — §4 한눈에 보기 2x3 grid 는 §3 와 같은 영역 점수를
                    중복 노출해 사용자 혼란 유발. 제거. */}
              <TodayCategoryReadings result={freeResult} />

              {/* §4.5 — 행운 패키지 12종 (PR 2 신설): 색/숫자/방향/시간/음식/향/보석/음악/성씨/띠
                  + 로또 번호 6개 오행색 원 + 피해야 할 것. 운세톡톡 5종 대비 압도적 차별화. */}
              {freeResult.luckyPackage ? (
                <TodayLuckyPackageCard luckyPackage={freeResult.luckyPackage} />
              ) : null}

              {/* §5 — 사주 명식 신뢰 카드 (PR 1 신설): 4기둥 + 오행 분포 + 일주 강약 + 격국.
                  운세톡톡의 "신뢰 장치" 패턴 + 한자/한글 병기. */}
              {freeResult.sajuChart ? (
                <TodaySajuChartCard chart={freeResult.sajuChart} />
              ) : null}

              {/* §6 — 550원 자세히 보기 unlock */}
              <PremiumLockCard
                copy={freeResult.nextAction.copy}
                coinCost={freeResult.nextAction.coinCost}
                onUnlock={handleUnlock}
                loading={false}
                sourceSessionId={freeResult.sourceSessionId}
                concernId={freeResult.concernId}
              />

              {/* §7 — 대운 CTA (PR 1 신설): 무료 일진 → 무료 대운 풀이 (8단) 로 자연 연결. */}
              <TodayDaewoonCtaCard sajuSlug={freeResult.sajuSlug ?? null} />

              {/* §8 — ML 피드백 카드 (PR 9 신설): 30초 dwell 후 노출.
                  사용자 평가 → today_fortune_feedback 테이블 → 추후 가중치 학습. */}
              <TodayFeedbackCard result={freeResult} enterAt={enterAt} />
            </MotionResultReveal>

            {/* 하단 — 추가 무료 콘텐츠 (기존 가치 보존, 접힘 상태가 기본) */}
            <details className="group rounded-[20px] border border-[var(--app-line)] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-[14px] font-bold text-[var(--app-ink)] [&::-webkit-details-marker]:hidden">
                <span>더 깊이 들여다보기</span>
                <span
                  aria-hidden="true"
                  className="text-[var(--app-copy-muted)] transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="grid gap-4 border-t border-[var(--app-line)] px-4 py-5">
                <OpportunityRiskCards result={freeResult} />
                <SajuReasonSnippet result={freeResult} />

                <section className="app-panel p-5">
                  <FollowUpQuestionChips
                    questions={freeResult.followUpQuestions}
                    sourceSessionId={freeResult.sourceSessionId}
                    concernId={freeResult.concernId}
                  />
                </section>

                <GangiSection
                  eyebrow="더 보고 싶을 때"
                  title="궁금한 부분만 이어보세요"
                  description="오늘운세는 빠른 체크입니다. 더 보고 싶을 때만 사주, 타로, 대화로 이어가면 됩니다."
                >
                  <div className="grid gap-3">
                    {relatedLinks.map((item) => (
                      <Link key={item.label} href={item.href} className="gangi-list-link">
                        <span className="gangi-list-copy">
                          <strong>{item.label}</strong>
                          <em>{item.body}</em>
                        </span>
                        <ArrowRight className="h-5 w-5 text-[rgba(17,17,20,0.44)]" />
                      </Link>
                    ))}
                  </div>
                </GangiSection>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
