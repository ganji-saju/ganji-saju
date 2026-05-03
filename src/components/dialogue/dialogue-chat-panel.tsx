'use client';

import Link from 'next/link';
import { FormEvent, startTransition, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiSourceBadge } from '@/components/ai/ai-source-badge';
import { CounselorSelector } from '@/components/counselor/counselor-selector';
import { Button } from '@/components/ui/button';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { AiChatBillingSummary } from '@/lib/credits/ai-chat-access';
import type { MoonlightCounselorId } from '@/lib/counselors';

type AiSource = 'openai' | 'fallback' | 'safe_redirect';
type FallbackReason = 'ai_not_configured' | 'empty_ai_response' | 'openai_error';
type ChatStatus = 'idle' | 'loading' | 'error';

interface DialoguePresetOption {
  category: string;
  question: string;
}

interface DialogueAiResponse {
  ok?: boolean;
  source?: AiSource;
  text?: string;
  model?: string | null;
  configured?: boolean;
  billing?: AiChatBillingSummary;
  profileContext?: {
    used: boolean;
    summary: string | null;
  } | null;
  fallbackReason?: FallbackReason | null;
  errorMessage?: string | null;
  redirectPath?: string | null;
  counselorId?: MoonlightCounselorId | null;
  cta?: {
    label: string;
    href: string;
  } | null;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  animate?: boolean;
  source?: AiSource;
  model?: string | null;
  configured?: boolean;
  billing?: AiChatBillingSummary;
  profileContext?: {
    used: boolean;
    summary: string | null;
  } | null;
  fallbackReason?: FallbackReason | null;
  errorMessage?: string | null;
  counselorId?: MoonlightCounselorId | null;
  cta?: {
    label: string;
    href: string;
  } | null;
}

interface DialogueChatPanelProps {
  presets: DialoguePresetOption[];
  initialQuestion?: string;
  sourceSessionId?: string;
  concernId?: string;
  entrySource?: string;
  autoStart?: boolean;
}

interface ProfileApiProfile {
  displayName: string;
  calendarType: 'solar' | 'lunar';
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  birthMinute: number | null;
  birthLocationLabel: string;
  gender: 'male' | 'female' | null;
}

type ProfileConnectionState =
  | { status: 'checking'; summary: string; detail: string }
  | { status: 'guest'; summary: string; detail: string }
  | { status: 'ready'; summary: string; detail: string }
  | { status: 'partial'; summary: string; detail: string }
  | { status: 'error'; summary: string; detail: string };

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-intro',
  role: 'assistant',
  source: undefined,
  fallbackReason: null,
  model: null,
  errorMessage: null,
  text:
    '편하게 물으세요. 로그인되어 있고 MY 프로필에 생년월일이 저장돼 있으면 깊은 사주풀이를 다시 입력하지 않아도 그 정보를 먼저 놓고 바로 풀어드립니다. 처음 3회는 무료이고, 이후에는 3회 묶음마다 3코인으로 이어집니다.',
};

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getBadgeState(status: ChatStatus, latestAssistant?: ChatMessage) {
  if (status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  if (latestAssistant?.source === 'openai') return 'openai';
  if (latestAssistant?.source === 'safe_redirect') return 'safe_redirect';
  if (latestAssistant?.source === 'fallback') return 'fallback';
  return 'idle';
}

function getFallbackLabel(reason: FallbackReason | null | undefined) {
  switch (reason) {
    case 'ai_not_configured':
      return '정밀 답변 연결 전이라 기본 답변으로 표시 중입니다.';
    case 'empty_ai_response':
      return '정밀 답변 내용이 비어 있어 기본 답변으로 표시 중입니다.';
    case 'openai_error':
      return '정밀 답변을 불러오지 못해 기본 답변으로 표시 중입니다.';
    default:
      return '기본 답변으로 표시 중입니다.';
  }
}

function getBillingLabel(billing: AiChatBillingSummary | null | undefined) {
  if (!billing) return null;

  switch (billing.status) {
    case 'free_intro':
      return `첫 3회 무료 · ${billing.freeTurnsRemaining ?? 0}회 남음`;
    case 'result_intro_free':
      return '오늘 결과 기반 첫 질문 무료 · 코인 차감 없음';
    case 'charged_bundle':
      return `${billing.bundleSize}회 묶음 시작 · ${billing.cost}코인 차감 · 이번 묶음 ${billing.bundleTurnsRemaining ?? 0}회 남음 · 잔여 ${billing.remaining ?? 0}개`;
    case 'bundle_included':
      return `결제된 ${billing.bundleSize}회 묶음 사용 중 · 이번 묶음 ${billing.bundleTurnsRemaining ?? 0}회 남음`;
    case 'not_charged_fallback':
      return `기본 답변 · 횟수/코인 차감 없음 · 잔여 ${billing.remaining ?? 0}개`;
    case 'not_charged_safe_redirect':
      return '안전 안내 전환 · 횟수/코인 차감 없음';
    case 'auth_required':
      return '대화는 로그인 후 사용할 수 있습니다.';
    case 'insufficient_credits':
      return `${billing.bundleSize}회 묶음 시작에 ${billing.cost}코인이 필요합니다 · 현재 ${billing.remaining ?? 0}개`;
    default:
      return null;
  }
}

function getConnectionSummary(
  latestAssistant: ChatMessage | undefined,
  status: ChatStatus
) {
  if (status === 'loading') {
    return '저장된 내 정보와 상담 가능 횟수를 확인한 뒤 답변을 준비하고 있습니다.';
  }

  if (!latestAssistant || latestAssistant.id === INITIAL_MESSAGE.id) {
    return 'MY 프로필에 생년월일이 있으면 상담에서 다시 입력하지 않습니다. 처음 3회는 무료이고, 이후에는 정밀 답변 기준으로 3회 묶음마다 3코인이 차감됩니다.';
  }

  if (latestAssistant.source === 'openai') {
    const billingLabel = getBillingLabel(latestAssistant.billing);
    const profileLabel =
      latestAssistant.profileContext?.used && latestAssistant.profileContext.summary
        ? ` 저장 프로필 기준: ${latestAssistant.profileContext.summary}`
        : '';
    return `최근 답변은 상담 답변으로 정리되었습니다.${billingLabel ? ` ${billingLabel}` : ''}${profileLabel}`;
  }

  if (latestAssistant.source === 'fallback') {
    const profileLabel = latestAssistant.profileContext?.summary
      ? ` ${latestAssistant.profileContext.used ? '저장 프로필 기준으로' : ''} ${latestAssistant.profileContext.summary}`
      : '';
    return `최근 답변은 기본 답변으로 표시되었습니다.${latestAssistant.configured === false ? ' 상담 답변 연결 전입니다.' : ''}${profileLabel}`;
  }

  return '안전 안내 기준으로 일반 대화를 중단했습니다.';
}

function hasBirthProfile(
  profile: ProfileApiProfile | null | undefined
): profile is ProfileApiProfile & {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
} {
  return Boolean(profile?.birthYear && profile.birthMonth && profile.birthDay);
}

function formatProfileConnection(profile: ProfileApiProfile | null): ProfileConnectionState {
  if (!hasBirthProfile(profile)) {
    return {
      status: 'partial',
      summary: '저장된 내 정보가 아직 부족합니다',
      detail: 'MY 프로필에 생년월일을 저장하면 상담에서 풀이를 다시 입력하지 않아도 됩니다.',
    };
  }

  const dateLabel = `${profile.calendarType === 'lunar' ? '음력' : '양력'} ${profile.birthYear}.${profile.birthMonth}.${profile.birthDay}`;
  const genderLabel =
    profile.gender === 'female' ? '여성' : profile.gender === 'male' ? '남성' : '성별 미입력';
  const timeLabel =
    profile.birthHour === null
      ? '태어난 시간 미입력'
      : `${profile.birthHour}시${
          profile.birthMinute === null ? '' : ` ${String(profile.birthMinute).padStart(2, '0')}분`
        }`;
  const locationLabel = profile.birthLocationLabel || '출생지 미입력';
  const timeRuleLabel =
    profile.timeRule === 'trueSolarTime'
      ? '진태양시 기준'
      : profile.timeRule === 'nightZi'
        ? '야자시 기준'
        : profile.timeRule === 'earlyZi'
          ? '조자시 기준'
          : '표준시 기준';
  const nameLabel = profile.displayName.trim() || '내 정보';

  return {
    status: 'ready',
    summary: `${nameLabel} 정보 연결됨`,
    detail: [dateLabel, genderLabel, timeLabel, locationLabel, timeRuleLabel].join(' · '),
  };
}

function getProfileStateClass(status: ProfileConnectionState['status']) {
  if (status === 'ready') {
    return 'border-[var(--app-jade)]/30 bg-[var(--app-jade)]/10 text-[var(--app-jade)]';
  }

  if (status === 'checking') {
    return 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]';
  }

  return 'border-[var(--app-line)] bg-[var(--app-surface-soft)] text-[var(--app-copy)]';
}

function DialogueMessageText({
  text,
  animate,
}: {
  text: string;
  animate?: boolean;
}) {
  const [visibleText, setVisibleText] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      return;
    }

    let index = 0;
    setVisibleText('');
    const charactersPerTick = text.length > 520 ? 7 : text.length > 260 ? 5 : 3;
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + charactersPerTick);
      setVisibleText(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [animate, text]);

  const isTyping = animate && visibleText.length < text.length;

  return (
    <p className="whitespace-pre-line text-[0.95rem] leading-8">
      {visibleText}
      {isTyping ? (
        <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-[var(--app-gold)]/70" />
      ) : null}
    </p>
  );
}

export function DialogueChatPanel({
  presets,
  initialQuestion,
  sourceSessionId,
  concernId,
  entrySource,
  autoStart = false,
}: DialogueChatPanelProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoStartedRef = useRef(false);
  const { counselorId, selectCounselor } = usePreferredCounselor();
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileConnection, setProfileConnection] = useState<ProfileConnectionState>({
    status: 'checking',
    summary: '내 정보 확인 중',
    detail: '로그인 상태와 MY 프로필 저장 여부를 확인하고 있습니다.',
  });

  const latestAssistant = messages.findLast((message) => message.role === 'assistant');
  const badgeState = getBadgeState(status, latestAssistant);
  const connectionSummary = getConnectionSummary(latestAssistant, status);

  function applyPreset(question: string) {
    setInput(question);
    setErrorMessage(null);
    if (status === 'error') setStatus('idle');

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const length = question.length;
      textareaRef.current?.setSelectionRange(length, length);
    });
  }

  useEffect(() => {
    if (!initialQuestion || input.trim()) return;
    setInput(initialQuestion);
  }, [initialQuestion, input]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileConnection() {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        if (!response.ok) throw new Error('profile_failed');
        const payload = (await response.json()) as {
          authenticated?: boolean;
          profile?: ProfileApiProfile | null;
        };

        if (cancelled) return;

        if (!payload.authenticated) {
          setProfileConnection({
            status: 'guest',
            summary: '로그인하면 내 정보가 자동 연결됩니다',
            detail: 'MY 프로필을 저장해두면 상담에서 생년월일을 다시 입력하지 않습니다.',
          });
          return;
        }

        setProfileConnection(formatProfileConnection(payload.profile ?? null));
      } catch {
        if (cancelled) return;
        setProfileConnection({
          status: 'error',
          summary: '내 정보 확인을 잠시 불러오지 못했습니다',
          detail: '질문은 보낼 수 있습니다. 저장 프로필은 답변 생성 단계에서 다시 확인합니다.',
        });
      }
    }

    void loadProfileConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, status]);

  async function submitDialogueMessage(rawInput: string, via: 'manual' | 'auto') {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) {
      setStatus('error');
      setErrorMessage('확인할 질문을 한 줄 이상 적어 주세요.');
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      text: trimmedInput,
    };

    setStatus('loading');
    setErrorMessage(null);
    startTransition(() => {
      setMessages((current) => [...current, userMessage]);
      setInput('');
    });

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dialogue',
          message: trimmedInput,
          counselorId,
          sourceSessionId,
          concernId,
          from: entrySource,
        }),
      });
      const payload = (await response.json()) as DialogueAiResponse;

      if (payload.source === 'safe_redirect' && payload.redirectPath) {
        router.push(payload.redirectPath);
        return;
      }

      if (!response.ok || !payload.ok) {
        const billingLabel = getBillingLabel(payload.billing);
        throw new Error(
          [payload.error ?? 'AI 답변을 불러오지 못했습니다.', billingLabel]
            .filter(Boolean)
            .join(' ')
        );
      }

      const assistantMessage: ChatMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        animate: true,
        source: payload.source ?? 'fallback',
        text: payload.text ?? '기본 안내를 불러왔습니다.',
        model: payload.model ?? null,
        configured: payload.configured,
        billing: payload.billing,
        profileContext: payload.profileContext ?? null,
        fallbackReason: payload.fallbackReason ?? null,
        errorMessage: payload.errorMessage ?? null,
        counselorId: payload.counselorId ?? counselorId,
        cta: payload.cta ?? null,
      };

      startTransition(() => {
        setMessages((current) => [...current, assistantMessage]);
      });
      setStatus('idle');

      if (sourceSessionId && entrySource === 'today-fortune') {
        trackMoonlightEvent('dialogue_started_from_result', {
          from: entrySource,
          concern: concernId,
          sourceSessionId,
          mode: via,
        });
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '잠시 후 다시 확인해 주세요.'
      );
    }
  }

  useEffect(() => {
    if (!autoStart || !initialQuestion || autoStartedRef.current || status !== 'idle') return;
    autoStartedRef.current = true;
    void submitDialogueMessage(initialQuestion, 'auto');
  }, [autoStart, initialQuestion, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitDialogueMessage(input, 'manual');
  }

  return (
    <article className="app-panel overflow-hidden p-0 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="border-b border-[var(--app-line)] bg-[linear-gradient(135deg,rgba(210,176,114,0.12),rgba(10,18,36,0.96))] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="app-caption">AI 대화</div>
            <h2 className="mt-3 font-[var(--font-heading)] text-3xl text-[var(--app-ivory)]">
              내 정보를 불러와 바로 상담합니다
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy)]">
              로그인되어 있고 MY 프로필에 생년월일이 저장되어 있으면
              깊은 사주풀이를 다시 입력하지 않아도 됩니다. 질문만 남기시면
              저장된 기준을 먼저 놓고 상담하듯 답변을 이어갑니다.
            </p>
            {sourceSessionId && concernId ? (
              <p className="mt-3 max-w-3xl text-xs leading-6 text-[var(--app-gold-text)]">
                오늘 결과에서 이어진 질문입니다. 첫 결과 기반 질문은 코인 차감 없이 먼저 답해드립니다.
              </p>
            ) : null}
            <div className="mt-4 max-w-4xl">
              <CounselorSelector
                value={counselorId}
                onChange={(nextCounselor) => void selectCounselor(nextCounselor)}
                variant="compact"
                title="대화를 맡을 선생"
                description="고르신 선생의 말투로 질문을 받아드립니다. 명식 계산 기준은 그대로 유지됩니다."
              />
            </div>
            <div className={`mt-4 rounded-[1.15rem] border px-4 py-3 ${getProfileStateClass(profileConnection.status)}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{profileConnection.summary}</div>
                  <p className="mt-1 text-xs leading-6 opacity-85">{profileConnection.detail}</p>
                </div>
                {profileConnection.status === 'ready' ? (
                  <span className="w-fit rounded-full border border-current/20 px-3 py-1 text-[11px] font-medium">
                    자동 적용
                  </span>
                ) : (
                  <Link
                    href="/my/profile"
                    className="w-fit rounded-full border border-[var(--app-gold)]/30 bg-[var(--app-gold)]/10 px-3 py-1 text-[11px] font-medium text-[var(--app-gold-text)] transition hover:border-[var(--app-gold)]/55 hover:bg-[var(--app-gold)]/16"
                  >
                    MY 정보 저장
                  </Link>
                )}
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-6 text-[var(--app-copy-soft)]">
              {connectionSummary}
            </p>
          </div>
          <AiSourceBadge state={badgeState} />
        </div>
      </div>

      <div
        className="h-[min(42vh,28rem)] min-h-[16rem] space-y-4 overflow-y-auto scroll-smooth px-5 py-5 sm:h-[min(54vh,38rem)] sm:min-h-[22rem] sm:px-6 lg:h-[min(62vh,46rem)]"
        aria-live="polite"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[min(100%,42rem)] rounded-[1.25rem] border px-4 py-4 ${
                  isUser
                    ? 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/12 text-[var(--app-ivory)]'
                    : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy)]'
                }`}
              >
                <DialogueMessageText text={message.text} animate={!isUser && message.animate} />
                {!isUser && message.cta ? (
                  <div className="mt-4">
                    <Button
                      type="button"
                      onClick={() => router.push(message.cta!.href)}
                      variant="outline"
                      size="sm"
                    >
                      {message.cta.label}
                    </Button>
                  </div>
                ) : null}
                {!isUser && (message.source || message.errorMessage || message.billing) ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs leading-6 text-[var(--app-copy-soft)]">
                    {message.source === 'openai' ? (
                      <span>
                        {message.counselorId === 'male' ? '달빛 남선생' : '달빛 여선생'} · 정밀 답변
                      </span>
                    ) : (
                      <span>
                        {message.counselorId === 'male' ? '달빛 남선생' : '달빛 여선생'} ·{' '}
                        {message.configured === false
                          ? '기본 답변 · 정밀 답변 연결 전'
                          : getFallbackLabel(message.fallbackReason)}
                      </span>
                    )}
                    {message.profileContext?.summary ? (
                      <span>
                        {message.profileContext.used ? '저장 프로필 기준' : '프로필 안내'} ·{' '}
                        {message.profileContext.summary}
                      </span>
                    ) : null}
                    {getBillingLabel(message.billing) ? <span>{getBillingLabel(message.billing)}</span> : null}
                    {message.errorMessage ? <span>오류: {message.errorMessage}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {status === 'loading' ? (
          <div className="flex justify-start">
            <div className="rounded-[1.25rem] border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm leading-7 text-[var(--app-copy-muted)]">
              <span>달빛인생이 답변을 정리하고 있습니다</span>
              <span className="ml-2 inline-flex gap-1 align-middle">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-gold)]/70" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-gold)]/55 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-gold)]/40 [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <form
        id="dialogue-input"
        onSubmit={handleSubmit}
        className="scroll-mt-24 border-t border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5 sm:p-6"
      >
        <label className="block text-sm font-medium text-[var(--app-gold-text)]">
          지금 묻고 싶은 말
        </label>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (status === 'error') {
                setStatus('idle');
                setErrorMessage(null);
              }
            }}
            rows={3}
            className="min-h-24 w-full resize-y rounded-[1.15rem] border border-[var(--app-line)] bg-[var(--app-surface-strong)] px-4 py-3 text-sm leading-7 text-[var(--app-ivory)] outline-none transition-colors placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-gold)]/60"
            placeholder="예: 내 사주 기준으로 올해 재물 흐름을 단도직입적으로 말해줘."
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="moon-action-primary"
          >
            {status === 'loading' ? '답변 확인 중' : '보내기'}
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium tracking-[0.08em] text-[var(--app-gold-text)]">
            자주 여쭙는 이야기
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const active = input.trim() === preset.question;
              return (
                <button
                  key={preset.question}
                  type="button"
                  onClick={() => applyPreset(preset.question)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all duration-200 ${
                    active
                      ? 'border-[var(--app-gold)]/50 bg-[var(--app-gold)]/14 text-[var(--app-ivory)] shadow-[0_0_0_1px_rgba(210,176,114,0.12)]'
                      : 'border-[var(--app-line)] bg-[var(--app-surface-strong)] text-[var(--app-copy)] hover:-translate-y-0.5 hover:border-[var(--app-gold)]/32 hover:bg-[var(--app-surface)] hover:text-[var(--app-ivory)]'
                  }`}
                >
                  <span className="text-[var(--app-gold-text)]">{preset.category}</span>
                  <span className="mx-1.5 text-[var(--app-copy-soft)]">·</span>
                  <span>{preset.question}</span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs leading-6 text-[var(--app-copy-soft)]">
          처음 3회는 무료입니다. 이후에는 정밀 답변 기준으로 3회 묶음마다
          3코인이 차감되고, 기본 답변과 안전 안내는 횟수와 코인을 차감하지
          않습니다. 오늘 결과에서 이어진 첫 질문은 코인 차감 없이 먼저 답해드립니다.
          로그인 후 MY 프로필에 저장된 출생 정보가 있으면 대화에서도
          기본 명식으로 자동 사용합니다. 대화 저장은 아직 하지 않으며, 새로고침하면
          현재 화면의 메시지는 사라집니다.
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded-[1.1rem] border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-4 py-3 text-sm leading-7 text-[var(--app-ivory)]">
            {errorMessage}
          </div>
        ) : null}
      </form>
    </article>
  );
}
