'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { DecisionTraceConfidence, DecisionTraceItem, ReportMetadata } from '@/lib/saju/report-contract';

export type DecisionTracePanelProps = {
  items?: DecisionTraceItem[];
  metadata?: ReportMetadata | null;
  engineVersion?: string;
  ruleSetVersion?: string;
  timeRule?: string;
  isTimeUnknown?: boolean;
  title?: string;
  description?: string;
  compact?: boolean;
};

const FALLBACK_DECISION_TRACE: DecisionTraceItem[] = [
  {
    step: '01',
    title: '출생 정보 확인',
    rule: '양력/음력과 계절 흐름 확인',
    result:
      '현재 화면에 연결된 사주 정보를 바탕으로, 날짜와 계절 흐름부터 먼저 정리해 보여드립니다.',
    confidence: 'orthodox',
  },
  {
    step: '02',
    title: '시간 보정 검토',
    rule: '출생지와 시간 정보 확인',
    result:
      '출생시각과 출생지 정보가 충분하면 시간 흐름을 함께 보고, 부족하면 시간대별 풀이는 줄여서 읽습니다.',
    confidence: 'input_limited',
  },
  {
    step: '03',
    title: '타고난 역할 흐름',
    rule: '태어난 달의 기운과 전체 균형 확인',
    result:
      '한 가지 이름으로 단정하기보다, 반복해서 드러나는 역할감과 반응 방식을 함께 정리합니다.',
    confidence: 'orthodox',
  },
  {
    step: '04',
    title: '보완 힌트 확인',
    rule: '전체 균형과 계절 흐름을 함께 확인',
    result:
      '부족한 부분을 기계적으로 채우기보다, 생활에서 어떻게 균형을 잡을지 중심으로 정리합니다.',
    confidence: 'orthodox',
  },
  {
    step: '05',
    title: '현재 흐름 연결',
    rule: '큰 흐름, 올해 흐름, 이번 달 흐름을 질문과 연결',
    result:
      '현재 질문은 큰 흐름과 올해, 이번 달의 흐름을 함께 보고 연결하며, 한 시점의 감각만으로 단정하지 않습니다.',
    confidence: 'reference',
  },
  {
    step: '06',
    title: '참고 단계 분리',
    rule: '논쟁적 해석은 참고 단계로 낮춰 표시',
    result:
      '학파 차이가 큰 구간이나 보조 해석은 중심 해석과 분리해 두고, 참고 단계로 낮춰 보여드립니다.',
    confidence: 'disputed',
  },
];

const CONFIDENCE_META: Record<
  DecisionTraceConfidence,
  { label: string; className: string }
> = {
  orthodox: {
    label: '중심 단서',
    className: 'border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  },
  disputed: {
    label: '참고 관점',
    className: 'border-[var(--app-coral)]/24 bg-[var(--app-coral)]/10 text-[var(--app-coral)]',
  },
  reference: {
    label: '보조 단서',
    className: 'border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10 text-[var(--app-jade)]',
  },
  input_limited: {
    label: '조심해서 읽기',
    className: 'border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] text-[var(--app-copy-soft)]',
  },
};

function buildMetaLine({
  timeRule,
  isTimeUnknown,
}: Pick<DecisionTracePanelProps, 'timeRule' | 'isTimeUnknown'>) {
  const parts = ['현재 풀이 정보'];

  if (timeRule) parts.push(timeRule);
  if (isTimeUnknown) parts.push('출생시각 미입력은 보수적으로 반영');

  return parts.join(' · ');
}

export function DecisionTracePanel({
  items = FALLBACK_DECISION_TRACE,
  metadata,
  timeRule,
  isTimeUnknown = false,
  title = '세부 흐름 보기',
  description = '처음 읽을 때는 건너뛰어도 괜찮습니다. 더 깊게 보고 싶을 때만 펼쳐보세요.',
  compact = false,
}: DecisionTracePanelProps) {
  const hasTrackedOpenRef = useRef(false);
  const resolvedItems =
    items.length > 0 ? items : metadata?.decisionTrace && metadata.decisionTrace.length > 0 ? metadata.decisionTrace : FALLBACK_DECISION_TRACE;
  const handleToggle = useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    if (nextOpen && !hasTrackedOpenRef.current) {
      hasTrackedOpenRef.current = true;
      trackMoonlightEvent('report_decision_trace_open', {
        title,
        timeRule,
        itemCount: resolvedItems.length,
      });
    }
  }, [resolvedItems.length, timeRule, title]);

  return (
    <details
      className="rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
      onToggle={handleToggle}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-semibold text-[var(--app-ivory)]">{title}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--app-copy-soft)]">{description}</p>
          </div>
          <span className="rounded-full border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-sm text-[var(--app-copy-soft)]">
            펼쳐서 보기
          </span>
        </div>
      </summary>

      {/* 2026-05-15 — decision trace 항목 본문이 김. 1열 stack 으로 가독성 회복. */}
      <div className="mt-4 grid gap-3">
        {resolvedItems.map((item) => {
          const confidence = CONFIDENCE_META[item.confidence];

          return (
            <article
              key={`${item.step}-${item.title}`}
              className="rounded-[18px] border border-[var(--app-line)] bg-[rgba(7,9,16,0.28)] px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-base text-[var(--app-gold)]/60">{item.step}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-[var(--app-ivory)]">{item.title}</div>
                    <span className={cn('rounded-full border px-3 py-1 text-sm leading-6', confidence.className)}>
                      {confidence.label}
                    </span>
                  </div>

                  {item.input ? (
                    <div className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm leading-6 text-[var(--app-copy-soft)]">
                      입력 정보 · {item.input}
                    </div>
                  ) : null}

                  {item.rule ? (
                    <div className="mt-2 text-sm leading-6 text-[var(--app-gold-text)]">세부 메모 · {item.rule}</div>
                  ) : null}

                  <p className="mt-3 text-base leading-7 text-[var(--app-copy)]">{item.result}</p>

                  {item.note ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--app-copy-soft)]">{item.note}</p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-[18px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
        <div className="app-caption text-[var(--app-gold-soft)]">풀이 정보</div>
        <p className="mt-3 text-sm leading-6 text-[var(--app-copy-soft)]">
          {buildMetaLine({
            timeRule,
            isTimeUnknown,
          })}
        </p>
      </div>
    </details>
  );
}
