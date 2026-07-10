'use client';

import { Sparkles, ScrollText, ChevronRight } from 'lucide-react';
import type { UnifiedBirthProfile } from './birth-profile-store';
import type { IntakeIntent } from './intake-intent';

interface IntakeChoiceCard {
  intent: IntakeIntent;
  title: string;
  desc: string;
  Icon: typeof Sparkles;
  accent: string;
  soft: string;
}

const CARDS: readonly IntakeChoiceCard[] = [
  {
    intent: 'today',
    title: '오늘의 운세',
    desc: '오늘 하루 흐름을 짧게 바로 확인해요',
    Icon: Sparkles,
    accent: 'var(--app-pink)',
    soft: 'var(--app-pink-soft)',
  },
  {
    intent: 'saju',
    title: '내 사주',
    desc: '태어난 명식을 깊이 있게 풀어드려요',
    Icon: ScrollText,
    accent: 'var(--app-indigo)',
    soft: '#eef0fb',
  },
] as const;

export interface IntakeChoiceProps {
  profile: UnifiedBirthProfile;
  onPick: (intent: IntakeIntent) => void;
  busy?: boolean;
}

export function IntakeChoice({ profile, onPick, busy = false }: IntakeChoiceProps) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[22.4px] font-extrabold tracking-tight text-[var(--app-ink)]">
          {profile.name ? `${profile.name}님, 무엇을 볼까요?` : '무엇을 볼까요?'}
        </h1>
        <p className="mt-1.5 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
          입력하신 생년월일로 바로 보여드려요.
        </p>
      </div>

      <div role="group" aria-label="무엇을 볼까요?" className="grid gap-3.5">
        {CARDS.map(({ intent, title, desc, Icon, accent, soft }) => (
          <button
            key={intent}
            type="button"
            onClick={() => onPick(intent)}
            disabled={busy}
            className="flex w-full items-center gap-4 rounded-[18px] border p-5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--app-line)',
              background: '#fff',
              boxShadow: '0 8px 24px rgba(17,17,20,0.08)',
            }}
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
              style={{ background: soft, color: accent }}
              aria-hidden="true"
            >
              <Icon className="h-7 w-7" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19.2px] font-extrabold tracking-tight text-[var(--app-ink)]">
                {title}
              </span>
              <span className="mt-1 block text-[15px] leading-[1.5] text-[var(--app-copy-muted)]">
                {desc}
              </span>
            </span>
            <ChevronRight
              className="h-6 w-6 shrink-0 text-[var(--app-copy-soft)]"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
