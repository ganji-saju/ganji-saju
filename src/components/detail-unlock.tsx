'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DALBIT_TEACHERS } from '@/content/moonlight';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import { limitSajuSentences, simplifySajuCopy } from '@/lib/saju/public-copy';

type DetailSectionKey = 'wealth' | 'love' | 'career' | 'health';

interface DetailTopicBlock {
  title: string;
  body: string;
  keywords?: string[];
  tone?: 'core' | 'basis' | 'action' | 'caution' | 'flow' | 'safety';
}

interface DetailTopicContent {
  lead: string;
  scoreLabel?: string;
  highlights?: string[];
  blocks: DetailTopicBlock[];
}

interface DetailContent {
  wealth: string;
  love: string;
  career: string;
  health: string;
  detailSections?: Partial<Record<DetailSectionKey, DetailTopicContent>>;
  luckyColor: string;
  luckyKeywords: string[];
}

interface Props {
  slug: string;
  children?: ReactNode;
  referenceChildren?: ReactNode;
  premiumAccessLabel?: string | null;
  premiumHref?: string;
}

const SECTIONS = [
  { key: 'wealth', label: '돈 흐름' },
  { key: 'love', label: '연애 흐름' },
  { key: 'career', label: '일 흐름' },
  { key: 'health', label: '생활 리듬' },
] as const;

const SAJU_TEACHER = DALBIT_TEACHERS.find((teacher) => teacher.slug === 'saju-yong') ?? DALBIT_TEACHERS[0];

const DETAIL_SECTION_META: Record<
  DetailSectionKey,
  {
    eyebrow: string;
    focus: string;
    guidance: string;
    color: string;
    soft: string;
    line: string;
    label: string;
  }
> = {
  wealth: {
    eyebrow: '돈',
    focus: '지금 볼 돈 흐름',
    guidance: '수입·지출·기회 판단을 분리해서 읽어보세요.',
    color: '#34d399',
    soft: 'rgba(52,211,153,0.11)',
    line: 'rgba(52,211,153,0.35)',
    label: '재물',
  },
  love: {
    eyebrow: '연애',
    focus: '지금 볼 마음 흐름',
    guidance: '상대의 반응보다 표현 방식과 속도에 주목해 보세요.',
    color: '#fb7185',
    soft: 'rgba(251,113,133,0.11)',
    line: 'rgba(251,113,133,0.34)',
    label: '연애',
  },
  career: {
    eyebrow: '일',
    focus: '지금 볼 일 흐름',
    guidance: '자리, 책임, 제안 타이밍을 나눠서 확인해 보세요.',
    color: '#38bdf8',
    soft: 'rgba(56,189,248,0.11)',
    line: 'rgba(56,189,248,0.34)',
    label: '직업',
  },
  health: {
    eyebrow: '생활',
    focus: '지금 볼 생활 리듬',
    guidance: '생활 리듬에서 먼저 손볼 포인트를 봅니다.',
    color: '#a78bfa',
    soft: 'rgba(167,139,250,0.12)',
    line: 'rgba(167,139,250,0.34)',
    label: '건강',
  },
};

const TONE_LABELS: Record<NonNullable<DetailTopicBlock['tone']>, string> = {
  core: '핵심',
  basis: '이유',
  action: '실천',
  caution: '주의',
  flow: '운 흐름',
  safety: '안전',
};

function splitReadableParagraphs(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({
  text,
  keywords = [],
  color,
}: {
  text: string;
  keywords?: string[];
  color: string;
}) {
  const cleanKeywords = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  if (cleanKeywords.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${cleanKeywords.map(escapeRegExp).join('|')})`, 'g');
  const exact = new Set(cleanKeywords);

  return (
    <>
      {text.split(pattern).map((part, index) =>
        exact.has(part) ? (
          <strong key={`${part}-${index}`} className="font-semibold" style={{ color }}>
            {part}
          </strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function fallbackTopicContent(text: string): DetailTopicContent {
  const [lead = '', ...rest] = splitReadableParagraphs(simplifySajuCopy(text));

  return {
    lead: limitSajuSentences(lead, 2),
    blocks: rest.map((body, index) => ({
      title: index === 0 ? '세부 풀이' : `세부 풀이 ${index + 1}`,
      body: limitSajuSentences(body, 2),
      tone: index === 0 ? 'basis' : 'flow',
    })),
  };
}

function DetailTopicReport({
  topic,
  label,
  content,
}: {
  topic: DetailSectionKey;
  label: string;
  content: DetailTopicContent;
}) {
  const meta = DETAIL_SECTION_META[topic];

  return (
    <article
      className="overflow-hidden rounded-[26px] border bg-white"
      style={{ borderColor: meta.line }}
    >
      <div
        className="border-b px-5 py-5"
        style={{
          borderColor: meta.line,
          background: `linear-gradient(135deg, ${meta.soft}, #ffffff)`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-caption" style={{ color: meta.color }}>
              {meta.eyebrow}
            </div>
            <div className="mt-2 text-xl font-semibold text-[var(--app-ivory)]">{label}</div>
          </div>
          <Badge
            className="border text-xs"
            style={{
              borderColor: meta.line,
              backgroundColor: meta.soft,
              color: meta.color,
            }}
          >
            {meta.label} 심화
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-7 text-[var(--app-copy-soft)]">{meta.guidance}</p>
      </div>

      <div className="grid gap-4 p-5">
        <div
          className="rounded-[22px] border px-4 py-4"
          style={{
            borderColor: meta.line,
            backgroundColor: meta.soft,
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-caption" style={{ color: meta.color }}>
              {meta.focus}
            </span>
            {content.scoreLabel ? (
              <span
                className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: meta.line, color: meta.color }}
              >
                {content.scoreLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-base font-semibold leading-8 text-[var(--app-ivory)] sm:text-lg">
            <HighlightedText
              text={limitSajuSentences(content.lead, 2)}
              keywords={content.highlights}
              color={meta.color}
            />
          </p>
          {content.highlights && content.highlights.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {content.highlights.map((keyword) => (
                <span
                  key={`${topic}-${keyword}`}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    borderColor: meta.line,
                    backgroundColor: '#ffffff',
                    color: meta.color,
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {content.blocks.map((block, index) => (
            <section
              key={`${topic}-${block.title}-${index}`}
              className="rounded-[22px] border border-[var(--app-line)] bg-white px-4 py-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: block.tone === 'caution' ? '#fb7185' : meta.color }}
                />
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-copy-soft)]">
                  {block.tone ? TONE_LABELS[block.tone] : '풀이'}
                </div>
              </div>
              <h3 className="mt-3 text-base font-semibold text-[var(--app-ivory)]">{block.title}</h3>
              <p className="mt-3 text-sm leading-8 text-[var(--app-copy)]">
                <HighlightedText
                  text={limitSajuSentences(block.body, 2)}
                  keywords={[...(content.highlights ?? []), ...(block.keywords ?? [])]}
                  color={block.tone === 'caution' ? '#fb7185' : meta.color}
                />
              </p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function getTopicContent(
  content: DetailContent,
  topic: DetailSectionKey
): DetailTopicContent {
  const structured = content.detailSections?.[topic];
  if (structured?.lead && structured.blocks.length > 0) {
    return structured;
  }

  return fallbackTopicContent(content[topic]);
}

function ReferenceDetails({ children }: { children?: ReactNode }) {
  if (!children) return null;

  return (
    <details className="mt-6 rounded-[24px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--app-copy)]">
        전문 정보 보기
      </summary>
      <div className="mt-4 space-y-5">{children}</div>
    </details>
  );
}

export default function DetailUnlock({
  slug,
  children,
  referenceChildren,
  premiumAccessLabel,
  premiumHref,
}: Props) {
  const { counselorId } = usePreferredCounselor();
  const [state, setState] = useState<'locked' | 'loading' | 'unlocked' | 'error'>('locked');
  const [content, setContent] = useState<DetailContent | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [access, setAccess] = useState<'charged' | 'reused' | null>(null);
  const isIncludedInPremium = Boolean(premiumAccessLabel);

  useEffect(() => {
    if (isIncludedInPremium) return;

    let active = true;

    async function checkExistingAccess() {
      try {
        const params = new URLSearchParams({
          feature: 'detail_report',
          slug,
          counselorId,
        });
        const res = await fetch(`/api/credits/use?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!active || !res.ok) return;

        const data = await res.json();
        if (data.unlocked && data.content) {
          setContent(data.content);
          setAccess('reused');
          setState('unlocked');
        }
      } catch {
        // 기존 해금 확인 실패는 사용자가 직접 여는 흐름을 막지 않습니다.
      }
    }

    checkExistingAccess();

    return () => {
      active = false;
    };
  }, [counselorId, isIncludedInPremium, slug]);

  async function handleUnlock() {
    setState('loading');
    try {
      const res = await fetch('/api/credits/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'detail_report', slug, counselorId }),
      });

      const data = await res.json();

      if (res.status === 401) {
        location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error ?? '오류가 발생했습니다.');
        setRemaining(data.remaining ?? 0);
        setState('error');
        return;
      }

      setContent(data.content);
      setRemaining(data.remaining);
      if (typeof data.remaining === 'number') {
        window.dispatchEvent(
          new CustomEvent('moonlight:credits-updated', {
            detail: { remaining: data.remaining },
          })
        );
      }
      setAccess(data.access === 'reused' ? 'reused' : 'charged');
      setState('unlocked');
    } catch {
      setErrorMsg('서버 오류가 발생했습니다.');
      setState('error');
    }
  }

  if (state === 'unlocked' && content) {
    return (
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--app-pink-line)] bg-[linear-gradient(180deg,#ffffff,#fff7fb)] p-5 shadow-[0_18px_48px_rgba(216,27,114,0.08)] sm:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,79,154,0.56),transparent)]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-caption">분야별 깊이보기</div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--app-ivory)]">
              돈·연애·일·생활 리듬 풀이가 열려 있습니다
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
              {access === 'reused' ? '이미 구매함' : '해금 완료'}
            </Badge>
            <Badge className="border-[var(--app-line)] bg-[var(--app-surface-strong)] text-[var(--app-copy-muted)]">
              {SAJU_TEACHER.teacherName}
            </Badge>
            {remaining !== null ? (
              <span className="text-xs text-[var(--app-copy-soft)]">잔여 코인 {remaining}개</span>
            ) : null}
          </div>
        </div>

        <p className="app-body-copy text-sm">
          {access === 'reused'
            ? '이전에 열었던 같은 결과라 코인 차감 없이 다시 보여드립니다.'
            : '지금 실제로 궁금한 장면부터 읽을 수 있게 분야별 핵심과 조심할 점을 먼저 정리했습니다.'}
        </p>

        {children ? <div className="mt-6 space-y-5">{children}</div> : null}

        <div className="mt-6 grid gap-4">
          {SECTIONS.map(({ key, label }) => (
            <DetailTopicReport
              key={key}
              topic={key}
              label={label}
              content={getTopicContent(content, key)}
            />
          ))}
        </div>

        <div className="rounded-[24px] border border-[var(--app-line)] bg-[var(--app-surface-muted)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-[var(--app-ivory)]">이번 심화 해석에서 기억할 키워드</div>
            <Badge className="border-[var(--app-line)] bg-[var(--app-surface-strong)] text-[var(--app-copy-muted)]">
              추천 포인트
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {content.luckyKeywords.map((kw) => (
              <Badge
                key={kw}
                className="border text-xs"
                style={{
                  backgroundColor: `${content.luckyColor}18`,
                  borderColor: `${content.luckyColor}45`,
                  color: content.luckyColor,
                }}
              >
                {kw}
              </Badge>
            ))}
          </div>
        </div>

        <ReferenceDetails>{referenceChildren}</ReferenceDetails>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="app-panel space-y-4 border-rose-400/20 p-6 text-center">
        <div className="app-caption text-rose-200/80">분야별 깊이보기 오류</div>
        <p className="font-medium text-rose-200">{errorMsg}</p>
        {errorMsg.includes('부족') ? (
          <>
            <p className="app-body-copy text-sm">잔여 코인: {remaining}개</p>
            <Link href="/credits">
              <Button className="border border-[var(--app-gold)]/35 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)] hover:bg-[var(--app-gold)]/18">
                코인 충전하기
              </Button>
            </Link>
          </>
        ) : (
          <Button
            onClick={() => setState('locked')}
            variant="outline"
            className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-ivory)] hover:bg-[var(--app-surface-strong)]"
          >
            다시 시도
          </Button>
        )}
      </section>
    );
  }

  if (isIncludedInPremium) {
    return (
      <section className="relative overflow-hidden rounded-[32px] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#ecfdf5)] p-5 shadow-[0_18px_48px_rgba(15,159,122,0.08)] sm:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(52,211,153,0.55),transparent)]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="app-caption text-emerald-700">이미 포함된 긴 풀이</div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--app-ivory)]">
              깊은 사주풀이 안에 포함된 내용입니다
            </h2>
            <p className="app-body-copy mt-3 text-sm">
              이 결과는 {premiumAccessLabel}으로 전체 리포트 열람이 가능합니다. 기본 결과 아래에서
              1코인을 다시 쓰게 하지 않고, 포함된 풀이로 이어 보여드립니다.
            </p>
          </div>
          <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            추가 차감 없음
          </Badge>
        </div>

        {premiumHref ? (
          <Link
            href={premiumHref}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--app-gold)]/38 bg-[var(--app-gold)]/14 px-6 text-sm font-semibold text-[var(--app-gold-text)] shadow-[0_16px_42px_rgba(210,176,114,0.12)] transition hover:bg-[var(--app-gold)]/20"
          >
            깊은 사주풀이 이어보기
          </Link>
        ) : null}

        {children ? <div className="mt-6 space-y-5">{children}</div> : null}
        <ReferenceDetails>{referenceChildren}</ReferenceDetails>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {children ? <div className="space-y-5">{children}</div> : null}

      <div className="relative overflow-hidden rounded-[28px] border border-[var(--app-pink-line)] bg-[linear-gradient(180deg,#ffffff,#fff7fb)] p-6 shadow-[0_18px_48px_rgba(216,27,114,0.08)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,79,154,0.12),transparent_42%)]" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-caption">선택 심화</div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--app-ivory)]">
              필요한 분야만 1코인으로 더 읽어보세요
            </h2>
          </div>
          <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
            코인 1개
          </Badge>
        </div>

        <p className="app-body-copy mt-4 max-w-2xl text-sm">
          기본 결과를 먼저 읽고, 재물·연애·직업·생활 리듬 중 더 궁금한 장면만 선택해서 펼칩니다.
          깊은 사주풀이에는 이 흐름이 더 넓게 포함됩니다.
          {' '}
          {SAJU_TEACHER.teacherName}이 오늘 바로 볼 결론과 보류할 지점을 먼저 잡아드립니다.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            '이미 충분하면 열지 않아도 되는 선택형 심화입니다.',
            '한 번 연 같은 결과는 다시 코인이 차감되지 않습니다.',
            '더 큰 흐름은 깊은 사주풀이에서 한 번에 이어집니다.',
          ].map((item) => (
            <div
              key={item}
              className="rounded-[18px] border border-[var(--app-line)] bg-white/75 px-4 py-4 text-sm leading-7 text-[var(--app-copy)]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 blur-[1.5px] select-none pointer-events-none">
          {SECTIONS.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-[22px] border border-[var(--app-line)] bg-white/70 p-4"
            >
              <div className="text-sm font-medium text-[var(--app-ivory)]">{label}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--app-copy)]">
                {getPreviewCopy(key)}
              </p>
            </div>
          ))}
        </div>

        <div className="relative z-20 mt-6 rounded-[24px] border border-[var(--app-line)] bg-white/86 p-5 text-center backdrop-blur-sm">
          <p className="font-semibold text-[var(--app-ivory)]">분야별 깊이보기</p>
          <p className="mt-2 text-sm text-[var(--app-copy-muted)]">
            돈·연애·일·건강 4개 영역을 한 번에 열고, 같은 결과는 이후에도 다시 차감하지 않습니다.
          </p>
          <Button
            onClick={handleUnlock}
            disabled={state === 'loading'}
            className="mt-5 min-w-[200px]"
            size="lg"
          >
            {state === 'loading' ? '처리 중...' : '1코인으로 분야별 보기'}
          </Button>
          <p className="mt-3 text-xs text-[var(--app-copy-soft)]">
            이미 열었던 같은 결과는 코인 차감 없이 다시 열립니다.
          </p>
          </div>
        </div>
      </div>

      <ReferenceDetails>{referenceChildren}</ReferenceDetails>
    </section>
  );
}

function getPreviewCopy(key: (typeof SECTIONS)[number]['key']) {
  switch (key) {
    case 'wealth':
      return '현재 운 흐름 안에서 금전 감각이 살아나는 구간과 지출을 조심할 구간을 함께 읽습니다.';
    case 'love':
      return '관계의 속도와 표현 온도를 지금 시점의 운세 문맥에 맞춰 차분하게 풀어드립니다.';
    case 'career':
      return '큰 흐름과 올해 흐름을 바탕으로 포지션 변화, 확장 타이밍, 일의 결을 더 구체적으로 읽습니다.';
    case 'health':
      return '많이 쓰는 기운과 채워야 할 기운을 함께 보고 생활 리듬에서 먼저 손볼 포인트를 제안합니다.';
  }
}
