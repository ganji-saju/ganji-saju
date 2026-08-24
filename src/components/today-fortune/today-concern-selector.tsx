// Redesign 2026-05-14 (PR6+ 디자인 언어 통일):
// 오늘운세 진입 화면의 "오늘 어떤 부분이 가장 궁금해요?" picker.
// - intro 를 컴포넌트 내부에 통합 (pink-soft hero 카드)
// - 각 카드: 원형 아이콘 배지 + 라벨 + 짧은 설명
// - 활성 상태: 핑크 2px border + pink-soft 배경 + 우상단 체크 배지 + scale lift
//   → 어떤 항목이 선택됐는지 명확히 식별 가능.
'use client';

import type { ComponentType, SVGProps } from 'react';
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  HeartHandshake,
  Leaf,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { getTodayConcernEntries } from '@/lib/today-fortune/concerns';
import type { ConcernId } from '@/lib/today-fortune/types';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface ConcernVisual {
  Icon: IconComponent;
  label: string;
  desc: string;
  accent: string; // 활성 시 사용할 배경 색 (var token)
  soft: string; // 비활성 아이콘 배경 (var token)
  iconColor: string; // 비활성 아이콘 색
}

const CONCERN_VISUAL: Record<ConcernId, ConcernVisual> = {
  general: {
    Icon: Sparkles,
    label: '전체 흐름',
    desc: '오늘 하루를 한 줄로',
    accent: 'var(--app-pink)',
    soft: 'var(--app-pink-soft)',
    iconColor: 'var(--app-pink-strong)',
  },
  love_contact: {
    Icon: Heart,
    label: '연애·연락',
    desc: '오늘 연락해도 될까',
    accent: '#ec4899',
    soft: '#fff0f7',
    iconColor: '#d81b72',
  },
  money_spend: {
    Icon: Wallet,
    label: '돈·지출',
    desc: '돈이 새는 날일까',
    accent: 'var(--app-amber)',
    soft: '#fdf6e7',
    iconColor: '#b87a14',
  },
  work_meeting: {
    Icon: Briefcase,
    label: '일·미팅',
    desc: '미팅·계약 괜찮을까',
    accent: 'var(--app-indigo)',
    soft: '#eef0fb',
    iconColor: '#4a5cb8',
  },
  relationship_conflict: {
    Icon: HeartHandshake,
    label: '말·관계',
    desc: '말실수 조심해야 할까',
    accent: 'var(--app-coral)',
    soft: '#fdecec',
    iconColor: '#c64545',
  },
  energy_health: {
    Icon: Leaf,
    label: '컨디션',
    desc: '무리해도 되는 날',
    accent: 'var(--app-jade)',
    soft: '#e8f5ee',
    iconColor: '#2d8758',
  },
};

interface TodayConcernSelectorProps {
  value: ConcernId;
  onChange: (value: ConcernId) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  /** intro 를 비활성화하고 grid 만 렌더 (다른 페이지에서 재사용 시) */
  compact?: boolean;
}

export function TodayConcernSelector({
  value,
  onChange,
  expanded = false,
  onToggleExpanded,
  compact = false,
}: TodayConcernSelectorProps) {
  const items = getTodayConcernEntries(expanded);

  return (
    <div className="space-y-4">
      {/* §Intro — pink-soft hero (compact 모드에선 숨김) */}
      {!compact ? (
        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[15px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            오늘운세
          </div>
          <h1
            className="mt-1.5 text-[25.3px] font-extrabold leading-[1.3] tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            오늘 어떤 부분이
            <br />
            가장 궁금해요?
          </h1>
          <p className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
            한 가지를 골라야 더 또렷이 보여드려요.
          </p>
        </article>
      ) : null}

      {/* §Picker grid — 2col */}
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item) => {
          const visual: ConcernVisual =
            CONCERN_VISUAL[item.id] ?? CONCERN_VISUAL.general;
          const { Icon } = visual;
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-pressed={active}
              className="relative flex flex-col items-start gap-3 rounded-[16px] border p-3.5 text-left transition-all"
              style={{
                background: active ? 'var(--app-pink-soft)' : '#fff',
                borderColor: active ? 'var(--app-pink)' : 'var(--app-line)',
                borderWidth: active ? 2 : 1,
                padding: active ? 'calc(0.875rem - 1px)' : '0.875rem',
                boxShadow: active
                  ? '0 12px 26px rgba(216,27,114,0.18), 0 2px 6px rgba(216,27,114,0.10)'
                  : '0 1px 0 rgba(17,17,20,0.03)',
                transform: active ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              {/* 활성 시 우상단 체크 배지 */}
              {active ? (
                <span
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full text-white"
                  style={{
                    background: 'var(--app-pink)',
                    boxShadow: '0 4px 10px rgba(216,27,114,0.35)',
                    border: '2px solid #fff',
                  }}
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </span>
              ) : null}

              {/* 원형 아이콘 배지 */}
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors"
                style={{
                  background: active ? visual.accent : visual.soft,
                  color: active ? '#fff' : visual.iconColor,
                  boxShadow: active
                    ? `0 6px 14px ${visual.accent}33`
                    : 'inset 0 0 0 1px rgba(17,17,20,0.02)',
                }}
                aria-hidden="true"
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              </span>

              {/* Copy */}
              <span className="min-w-0">
                <span
                  className="block text-[16.1px] font-extrabold tracking-tight"
                  style={{
                    color: active ? 'var(--app-pink-strong)' : 'var(--app-ink)',
                  }}
                >
                  {visual.label}
                </span>
                <span className="mt-0.5 block text-[15px] leading-[1.5] text-[var(--app-copy-muted)]">
                  {visual.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* §Toggle expanded */}
      {onToggleExpanded ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-1.5 rounded-[12px] border bg-white px-3.5 py-1.5 text-[15px] font-extrabold transition-colors"
            style={{
              borderColor: 'var(--app-line)',
              color: 'var(--app-copy-muted)',
            }}
          >
            {expanded ? (
              <>
                접기 <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                다른 주제 더 보기 <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
