// Redesign 2026-05-13: 공유 채널 5개 (카톡·인스타·스레드·트위터·복사) — 클라이언트 컴포넌트.
// Web Share API 우선, 미지원 시 클립보드 fallback. 카카오 SDK 가 있으면 카톡 send 시도.
'use client';

// 2026-05-15 handoff PR-J: 자체 setTimeout 토스트 → sonner 전역 토스트 인프라로 마이그레이션.
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareActionsProps {
  text: string;
  url: string;
  className?: string;
}

type ChannelKey = 'kakao' | 'instagram' | 'threads' | 'twitter' | 'copy';

interface ChannelConfig {
  key: ChannelKey;
  label: string;
  glyph: string;
  bg: string;
  color: string;
}

const CHANNELS: ChannelConfig[] = [
  { key: 'kakao', label: '카톡', glyph: 'K', bg: '#fee500', color: '#191919' },
  {
    key: 'instagram',
    label: '인스타',
    glyph: '◯',
    bg: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)',
    color: '#fff',
  },
  { key: 'threads', label: '스레드', glyph: '@', bg: '#000', color: '#fff' },
  { key: 'twitter', label: '트위터', glyph: '𝕏', bg: '#000', color: '#fff' },
  { key: 'copy', label: '복사', glyph: '⎘', bg: 'rgba(0,0,0,0.04)', color: 'var(--app-ink)' },
];

async function copyToClipboard(text: string) {
  if (typeof navigator === 'undefined') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function triggerWebShare({
  text,
  url,
  title,
}: {
  text: string;
  url: string;
  title?: string;
}) {
  if (typeof navigator === 'undefined') return false;
  const share = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
  if (!share) return false;
  try {
    await share({ title: title ?? '간지사주', text, url });
    return true;
  } catch {
    return false;
  }
}

export function ShareActions({ text, url, className }: ShareActionsProps) {
  // 2026-05-15: 자체 setTimeout 토스트 제거 — sonner `toast.success / toast.error` 사용.
  function notifySuccess(message: string) {
    toast.success(message);
  }
  function notifyError(message: string) {
    toast.error(message);
  }

  async function handle(channel: ChannelKey) {
    const shareText = `${text}\n${url}`;
    if (channel === 'copy') {
      const ok = await copyToClipboard(shareText);
      if (ok) notifySuccess('링크를 복사했어요');
      else notifyError('복사가 안 됐어요. 길게 눌러 복사해 주세요.');
      return;
    }

    if (channel === 'twitter') {
      const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
      window.open(intent, '_blank', 'noopener,noreferrer');
      return;
    }

    if (channel === 'threads') {
      const intent = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`;
      window.open(intent, '_blank', 'noopener,noreferrer');
      return;
    }

    if (channel === 'instagram') {
      // Instagram 은 web share intent 미지원 → 일반 Web Share 또는 안내
      const ok = await triggerWebShare({ text, url });
      if (!ok) {
        const copied = await copyToClipboard(shareText);
        if (copied) {
          notifySuccess('인스타 앱은 자동 공유가 막혀 있어요. 링크가 복사됐어요!');
        } else {
          notifyError('인스타 공유는 직접 붙여넣기로 진행해 주세요.');
        }
      }
      return;
    }

    if (channel === 'kakao') {
      const ok = await triggerWebShare({ text, url });
      if (!ok) {
        const copied = await copyToClipboard(shareText);
        if (copied) {
          notifySuccess('카톡에 붙여넣으세요. 링크가 복사됐어요!');
        } else {
          notifyError('카톡 공유 준비가 안 됐어요. 잠시 후 다시 시도해 주세요.');
        }
      }
      return;
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div className="grid grid-cols-5 gap-2.5">
        {CHANNELS.map((channel) => (
          <button
            key={channel.key}
            type="button"
            onClick={() => handle(channel.key)}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-[14px] text-[20.7px] font-extrabold"
              style={{ background: channel.bg, color: channel.color }}
              aria-hidden="true"
            >
              {channel.glyph}
            </span>
            <span className="text-[12.1px] font-bold text-[var(--app-copy)]">
              {channel.label}
            </span>
          </button>
        ))}
      </div>
      {/* 2026-05-15 PR-J: 인라인 토스트 제거 — 전역 sonner `<AppToaster>` 가 상단 중앙에 표시. */}
    </div>
  );
}
