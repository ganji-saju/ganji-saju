// 2026-08-31 — LLM 한도 경보.
//
//   배경: 8/31 에 OpenAI 사용량 한도가 소진돼 대화방·총평 등 **전 LLM 기능**이 죽었는데,
//   사용자가 "왜 안 되냐" 고 물어볼 때까지 아무도 몰랐다. 로그는 남았지만 아무도 안 본다.
//   실측으로는 8/1~8/10 열흘도 같은 상태였다(openai 호출 0).
//
//   ⚠️ 우리는 벤더 계정의 **실제 잔액을 알 수 없다.** 그래서 두 가지를 본다:
//     ① 감지(사후) — ai_llm_runs 에 fallback_reason='quota_exceeded' 행이 있는가.
//        이건 예측이 아니라 **이미 막혔다는 증거**다. 다만 첫 사용자가 겪은 그 순간부터
//        보이므로, 제보를 기다리는 것보다 몇 시간~며칠 빠르다.
//     ② 예측(사전) — 이번 달 **우리 추정 지출** vs 우리가 정한 예산(LLM_MONTHLY_BUDGET_USD).
//        벤더의 실제 한도가 아니라 **우리가 적어둔 숫자**다. env 를 안 넣으면 ①만 동작한다.
//
//   🔴 "긴급" 은 **지금 막혀 있을 때만**이다(2026-08-31 첫 실행에서 잡은 결함):
//     처음엔 "오늘+어제 실패 건수 > 0 → critical" 이었다. 그러면 결제로 복구한 뒤에도 이틀간
//     긴급이 유지되고, 수신자를 넣는 순간 **이미 해결된 장애에 대한 오경보**가 첫 메일이 된다.
//     오경보를 내는 경보는 무시된다 → 다음 진짜 장애 때 아무도 안 본다.
//     그래서 판정을 시각으로 한다: 최근 2시간 안에 실패가 있으면 지금 막힌 것(critical),
//     실패 뒤에 성공 호출이 있으면 복구된 것(warn·이력), 실패 뒤 호출 자체가 없으면 판단 보류(warn·확인 필요).
//     밤새 트래픽이 0 이라 warn 이었다가 아침 첫 실패로 critical 이 되면 그때 메일이 간다(1시간 이내).
//
//   level='ok' 는 "한도에 여유가 있다" 가 아니라 "우리가 볼 수 있는 신호가 없다" 는 뜻이다.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getLlmCostStats, type DayStat } from '@/lib/admin/llm-cost-stats';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 예산 대비 이 비율을 넘으면 경고. */
export const BUDGET_WARN_RATIO = 0.8;
/** 이 시간 안에 한도 실패가 있으면 "지금 막혀 있다" 로 본다. */
export const ACTIVE_WINDOW_HOURS = 2;

export type LlmQuotaAlertLevel = 'ok' | 'warn' | 'critical';

export interface LlmQuotaAlert {
  level: LlmQuotaAlertLevel;
  headline: string;
  detail: string;
  /** 최근 ACTIVE_WINDOW_HOURS 시간 안에 한도 실패가 있는가 = 지금 사용자가 답변을 못 받고 있다. */
  activeNow: boolean;
  /** 오늘+어제(KST) 한도 초과 실패 건수(이력·문구용). */
  recentQuotaFallbacks: number;
  /** 이번 달 마지막으로 한도 초과가 난 날(KST). 없으면 null. */
  lastQuotaFallbackDate: string | null;
  /** 이번 달 누적 추정 지출(USD). 저장값이 아니라 현재 단가표 기준 재계산값. */
  monthSpendUsd: number;
  /** env LLM_MONTHLY_BUDGET_USD. 미설정이면 null(예측 경보 비활성). */
  budgetUsd: number | null;
  /** monthSpendUsd / budgetUsd. 예산 미설정이면 null. */
  budgetRatio: number | null;
  /** 집계 대상 행이 하나도 없었는가 — 이 경우 'ok' 는 "신호 없음" 이지 "정상" 이 아니다. */
  noData: boolean;
}

export function kstDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function kstClock(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(5, 16).replace('T', ' ');
}

function previousDateKey(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** env 파싱 — 숫자가 아니거나 0 이하면 미설정으로 본다. */
export function parseMonthlyBudgetUsd(raw: string | undefined): number | null {
  const value = Number(raw?.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

export interface EvaluateLlmQuotaAlertInput {
  /** 이번 달(1일~오늘) 일별 집계. KST 날짜 오름차순. */
  daily: ReadonlyArray<DayStat>;
  monthSpendUsd: number;
  budgetUsd: number | null;
  todayKey: string;
  /** 최근 ACTIVE_WINDOW_HOURS 시간 안의 한도 실패 건수. */
  quotaFailsInActiveWindow: number;
  /** 마지막 한도 실패 시각(ISO). 없으면 null. 월 경계와 무관(원본 테이블 최신 행). */
  lastQuotaFailAt: string | null;
  /** 마지막 성공(openai) 호출 시각(ISO). 실패보다 뒤면 복구된 것. */
  lastSuccessAt: string | null;
}

/**
 * 순수 판정. 화면·크론·이메일이 같은 규칙을 쓰도록 여기 한 곳에만 둔다.
 *
 * critical — 지금 막혀 있다(최근 2시간 실패) 또는 예산을 넘겼다.
 * warn     — 최근 이틀 실패 이력(복구됨 / 확인 필요), 예산 80% 이상, 이번 달 이력.
 * ok       — 볼 수 있는 신호가 없다.
 */
export function evaluateLlmQuotaAlert(input: EvaluateLlmQuotaAlertInput): LlmQuotaAlert {
  const { daily, monthSpendUsd, budgetUsd, todayKey, quotaFailsInActiveWindow, lastQuotaFailAt, lastSuccessAt } =
    input;
  const yesterdayKey = previousDateKey(todayKey);

  let recentQuotaFallbacks = 0;
  let lastQuotaFallbackDate: string | null = null;
  for (const day of daily) {
    if (day.quotaFallbacks <= 0) continue;
    lastQuotaFallbackDate = day.date;
    if (day.date === todayKey || day.date === yesterdayKey) {
      recentQuotaFallbacks += day.quotaFallbacks;
    }
  }
  // 월 경계(1일)에는 daily 에 어제가 없다 — 원본 최신 행으로 보강.
  if (lastQuotaFailAt && !lastQuotaFallbackDate) {
    const failDay = kstDateKey(new Date(lastQuotaFailAt));
    if (failDay === todayKey || failDay === yesterdayKey) lastQuotaFallbackDate = failDay;
  }

  const activeNow = quotaFailsInActiveWindow > 0;
  const recovered =
    Boolean(lastQuotaFailAt && lastSuccessAt) && (lastSuccessAt as string) > (lastQuotaFailAt as string);

  const budgetRatio = budgetUsd != null && budgetUsd > 0 ? monthSpendUsd / budgetUsd : null;
  const noData = daily.length === 0;

  const budgetLine =
    budgetRatio == null
      ? `이번 달 추정 지출 ${fmtUsd(monthSpendUsd)} · 예산 미설정(LLM_MONTHLY_BUDGET_USD)`
      : `이번 달 추정 지출 ${fmtUsd(monthSpendUsd)} / 예산 ${fmtUsd(budgetUsd!)} (${Math.round(budgetRatio * 100)}%)`;

  const base = {
    activeNow,
    recentQuotaFallbacks,
    lastQuotaFallbackDate,
    monthSpendUsd,
    budgetUsd,
    budgetRatio,
    noData,
  };

  if (activeNow) {
    return {
      ...base,
      level: 'critical',
      headline: `LLM 한도 초과 — 지금 막혀 있음 (최근 ${ACTIVE_WINDOW_HOURS}시간 ${quotaFailsInActiveWindow}건 실패)`,
      detail: `지금 사용자가 AI 답변을 받지 못하고 있습니다. 벤더 계정 결제·한도를 확인하세요. ${budgetLine}`,
    };
  }

  if (budgetRatio != null && budgetRatio >= 1) {
    return {
      ...base,
      level: 'critical',
      headline: '이번 달 LLM 예산 초과',
      detail: `${budgetLine} — 벤더 한도에 걸리기 전에 예산·결제를 확인하세요.`,
    };
  }

  const recentFailDay =
    lastQuotaFailAt && [todayKey, yesterdayKey].includes(kstDateKey(new Date(lastQuotaFailAt)));
  if (recentQuotaFallbacks > 0 || recentFailDay) {
    const count = recentQuotaFallbacks > 0 ? `${recentQuotaFallbacks}건` : '';
    if (recovered) {
      return {
        ...base,
        level: 'warn',
        headline: `한도 초과 복구됨 — 오늘·어제 ${count} 실패 이력`,
        detail: `마지막 실패 ${kstClock(lastQuotaFailAt!)}(KST) 이후 성공 호출이 있어 지금은 정상입니다. 재발하면 긴급으로 올라갑니다. ${budgetLine}`,
      };
    }
    return {
      ...base,
      level: 'warn',
      headline: `한도 초과 이력 — 실패 이후 호출 없음 (확인 필요)`,
      detail: `마지막 실패 ${lastQuotaFailAt ? kstClock(lastQuotaFailAt) : '?'}(KST) 뒤로 LLM 호출 자체가 없어 복구 여부를 알 수 없습니다. 대화방에서 질문 한 번 해 보세요 — 실패하면 1시간 안에 긴급 메일이 갑니다. ${budgetLine}`,
    };
  }

  if (budgetRatio != null && budgetRatio >= BUDGET_WARN_RATIO) {
    return {
      ...base,
      level: 'warn',
      headline: '이번 달 LLM 예산 임박',
      detail: `${budgetLine} — 남은 기간을 감안해 한도를 올려두세요.`,
    };
  }

  if (lastQuotaFallbackDate) {
    return {
      ...base,
      level: 'warn',
      headline: `이번 달 한도 초과 이력 있음 (${lastQuotaFallbackDate})`,
      detail: `최근 이틀은 정상입니다. 그날의 조치가 유지되고 있는지만 확인하세요. ${budgetLine}`,
    };
  }

  return {
    ...base,
    level: 'ok',
    headline: noData ? 'LLM 호출 기록 없음' : '한도 관련 신호 없음',
    detail: noData
      ? '이번 달 집계된 LLM 호출이 없습니다. 텔레메트리가 끊겼을 수도 있으니 기능이 실제로 동작하는지 확인하세요.'
      : `벤더 계정의 실제 잔액은 조회할 수 없습니다 — 실패 기록과 우리 추정 지출만 봅니다. ${budgetLine}`,
  };
}

interface ActivitySignals {
  quotaFailsInActiveWindow: number;
  lastQuotaFailAt: string | null;
  lastSuccessAt: string | null;
}

/** 원본 테이블에서 "지금" 을 읽는다. 실패 시 null → 호출자가 보수적으로 처리. */
async function readActivitySignals(now: Date): Promise<ActivitySignals | null> {
  if (!hasSupabaseServiceEnv) return null;
  try {
    const service = await createServiceClient();
    const since = new Date(now.getTime() - ACTIVE_WINDOW_HOURS * 3600_000).toISOString();
    const [active, lastFail, lastOk] = await Promise.all([
      service
        .from('ai_llm_runs')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'fallback')
        .eq('fallback_reason', 'quota_exceeded')
        .gte('created_at', since),
      service
        .from('ai_llm_runs')
        .select('created_at')
        .eq('source', 'fallback')
        .eq('fallback_reason', 'quota_exceeded')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from('ai_llm_runs')
        .select('created_at')
        .eq('source', 'openai')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (active.error || lastFail.error || lastOk.error) return null;
    return {
      quotaFailsInActiveWindow: active.count ?? 0,
      lastQuotaFailAt: (lastFail.data as { created_at: string } | null)?.created_at ?? null,
      lastSuccessAt: (lastOk.data as { created_at: string } | null)?.created_at ?? null,
    };
  } catch {
    return null;
  }
}

/** 이번 달(KST 1일~오늘) 집계 + 원본 최신 행으로 경보를 만든다. service env 없으면 신호 없음으로 degrade. */
export async function getLlmQuotaAlert(now: Date = new Date()): Promise<LlmQuotaAlert> {
  const todayKey = kstDateKey(now);
  // getLlmCostStats 의 윈도우는 KST (오늘 - N + 1)일 자정부터다.
  // N = 오늘의 일(day of month) 로 주면 정확히 이번 달 1일~오늘이 된다.
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const [stats, signals] = await Promise.all([getLlmCostStats(dayOfMonth), readActivitySignals(now)]);

  // 신호 조회에 실패하면 옛 규칙(오늘·어제 실패 = 지금 실패)으로 **보수적으로** 판정한다 —
  // 조회 실패가 경보를 조용히 끄면 안 된다.
  const yesterdayKey = previousDateKey(todayKey);
  const fallbackActive = stats.daily
    .filter((d) => d.date === todayKey || d.date === yesterdayKey)
    .reduce((sum, d) => sum + d.quotaFallbacks, 0);

  return evaluateLlmQuotaAlert({
    daily: stats.daily,
    monthSpendUsd: stats.summary.totalCostUsd,
    budgetUsd: parseMonthlyBudgetUsd(process.env.LLM_MONTHLY_BUDGET_USD),
    todayKey,
    quotaFailsInActiveWindow: signals ? signals.quotaFailsInActiveWindow : fallbackActive,
    lastQuotaFailAt: signals?.lastQuotaFailAt ?? null,
    lastSuccessAt: signals?.lastSuccessAt ?? null,
  });
}
