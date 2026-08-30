// 2026-08-31 — LLM 한도 경보.
//
//   배경: 8/31 에 OpenAI 사용량 한도가 소진돼 대화방·총평 등 **전 LLM 기능**이 죽었는데,
//   사용자가 "왜 안 되냐" 고 물어볼 때까지 아무도 몰랐다. 로그는 남았지만 아무도 안 본다.
//
//   ⚠️ 우리는 벤더 계정의 **실제 잔액을 알 수 없다.** 그래서 두 가지를 본다:
//     ① 감지(사후) — ai_llm_runs 에 fallback_reason='quota_exceeded' 행이 있는가.
//        이건 예측이 아니라 **이미 막혔다는 증거**다. 다만 첫 사용자가 겪은 그 순간부터
//        보이므로, 제보를 기다리는 것보다 몇 시간~며칠 빠르다.
//     ② 예측(사전) — 이번 달 **우리 추정 지출** vs 우리가 정한 예산(LLM_MONTHLY_BUDGET_USD).
//        벤더의 실제 한도가 아니라 **우리가 적어둔 숫자**다. env 를 안 넣으면 ①만 동작한다.
//
//   즉 level='ok' 는 "한도에 여유가 있다" 가 아니라 "우리가 볼 수 있는 신호가 없다" 는 뜻이다.
//   화면에도 그렇게 적을 것.
import { getLlmCostStats, type DayStat } from '@/lib/admin/llm-cost-stats';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 예산 대비 이 비율을 넘으면 경고. */
export const BUDGET_WARN_RATIO = 0.8;

export type LlmQuotaAlertLevel = 'ok' | 'warn' | 'critical';

export interface LlmQuotaAlert {
  level: LlmQuotaAlertLevel;
  headline: string;
  detail: string;
  /** 오늘+어제(KST) 한도 초과 실패 건수. >0 이면 지금 사용자가 답변을 못 받고 있다. */
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
}

/**
 * 순수 판정. 화면·크론이 같은 규칙을 쓰도록 여기 한 곳에만 둔다.
 *
 * critical — 지금 막혀 있다(오늘/어제 한도 실패) 또는 예산을 넘겼다.
 * warn     — 예산의 80% 이상, 또는 이번 달에 한도로 막힌 적이 있다(재발 확인 필요).
 * ok       — 볼 수 있는 신호가 없다.
 */
export function evaluateLlmQuotaAlert(input: EvaluateLlmQuotaAlertInput): LlmQuotaAlert {
  const { daily, monthSpendUsd, budgetUsd, todayKey } = input;
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

  const budgetRatio =
    budgetUsd != null && budgetUsd > 0 ? monthSpendUsd / budgetUsd : null;
  const noData = daily.length === 0;

  const budgetLine =
    budgetRatio == null
      ? `이번 달 추정 지출 ${fmtUsd(monthSpendUsd)} · 예산 미설정(LLM_MONTHLY_BUDGET_USD)`
      : `이번 달 추정 지출 ${fmtUsd(monthSpendUsd)} / 예산 ${fmtUsd(budgetUsd!)} (${Math.round(budgetRatio * 100)}%)`;

  const base = { recentQuotaFallbacks, lastQuotaFallbackDate, monthSpendUsd, budgetUsd, budgetRatio, noData };

  if (recentQuotaFallbacks > 0) {
    return {
      ...base,
      level: 'critical',
      headline: `LLM 한도 초과 — 최근 이틀 ${recentQuotaFallbacks}건 실패`,
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

/** 이번 달(KST 1일~오늘) 집계로 경보를 만든다. service env 없으면 신호 없음으로 degrade. */
export async function getLlmQuotaAlert(now: Date = new Date()): Promise<LlmQuotaAlert> {
  const todayKey = kstDateKey(now);
  // getLlmCostStats 의 윈도우는 KST (오늘 - N + 1)일 자정부터다.
  // N = 오늘의 일(day of month) 로 주면 정확히 이번 달 1일~오늘이 된다.
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const stats = await getLlmCostStats(dayOfMonth);
  return evaluateLlmQuotaAlert({
    daily: stats.daily,
    monthSpendUsd: stats.summary.totalCostUsd,
    budgetUsd: parseMonthlyBudgetUsd(process.env.LLM_MONTHLY_BUDGET_USD),
    todayKey,
  });
}
