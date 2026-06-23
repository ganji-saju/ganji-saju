// 2026-05-16 PR #148 (Part B) — 사용자 입력 상황이 풀이에 반영됐음을 명시하는 chip 카드.
// /saju/[slug] hero 아래 + /today-fortune 결과에서 재사용.
import Link from 'next/link';
import type { UserSituation } from '@/lib/saju/types';

// PR #147 의 *_PREVIEW 매핑과 동일 — 입력 페이지 chip 톤과 결과 페이지 chip 톤 일치.
const RELATIONSHIP_PREVIEW: Record<string, { label: string; emoji: string }> = {
  single: { label: '솔로', emoji: '💛' },
  dating: { label: '연애 중', emoji: '💑' },
  married: { label: '기혼', emoji: '💍' },
  separated: { label: '이별·정리 중', emoji: '🍂' },
};

const OCCUPATION_PREVIEW: Record<string, { label: string; emoji: string }> = {
  employee: { label: '직장인', emoji: '💼' },
  'self-employed': { label: '자영업·프리랜서', emoji: '🛠' },
  student: { label: '학생', emoji: '📚' },
  homemaker: { label: '주부', emoji: '🏠' },
  'job-seeking': { label: '구직 중', emoji: '🔎' },
  other: { label: '기타', emoji: '✨' },
};

const CONCERN_PREVIEW: Record<string, { label: string; emoji: string }> = {
  business: { label: '사업·이직', emoji: '🚀' },
  romance: { label: '결혼·연애', emoji: '💞' },
  family: { label: '자녀·가족', emoji: '👨‍👩‍👧' },
  health: { label: '건강·멘탈', emoji: '🩺' },
  wealth: { label: '재물·투자', emoji: '💰' },
  other: { label: '직접 입력', emoji: '✍️' },
};

interface Props {
  situation: UserSituation | null | undefined;
  /** 미입력 시 보여줄 CTA href (default /saju/new). */
  fallbackInputHref?: string;
  /** 컴팩트 (작은 카드, 결과 페이지의 hero 직하용) vs 일반. */
  variant?: 'default' | 'compact';
}

interface PreviewItem {
  key: string;
  emoji: string;
  label: string;
}

function buildPreviewItems(situation: UserSituation | null | undefined): PreviewItem[] {
  if (!situation) return [];
  const items: PreviewItem[] = [];
  const rel = situation.relationshipStatus
    ? RELATIONSHIP_PREVIEW[situation.relationshipStatus]
    : null;
  const occ = situation.occupation ? OCCUPATION_PREVIEW[situation.occupation] : null;
  const con = situation.currentConcern ? CONCERN_PREVIEW[situation.currentConcern] : null;
  if (rel) items.push({ key: 'rel', emoji: rel.emoji, label: rel.label });
  if (occ) items.push({ key: 'occ', emoji: occ.emoji, label: occ.label });
  if (con) {
    const concernLabel =
      situation.currentConcern === 'other' && situation.concernNote?.trim()
        ? situation.concernNote.trim().slice(0, 24)
        : con.label;
    items.push({ key: 'con', emoji: con.emoji, label: concernLabel });
  }
  return items;
}

export function SituationReflectionCard({
  situation,
  fallbackInputHref = '/saju/new',
  variant = 'default',
}: Props) {
  const items = buildPreviewItems(situation);
  const hasAny = items.length > 0;

  if (variant === 'compact') {
    if (!hasAny) return null;
    return (
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-[12px] border bg-white px-3 py-2"
        style={{ borderColor: 'var(--app-pink-line)' }}
      >
        <span className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          ✓ 반영
        </span>
        {items.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-0.5 rounded-full bg-[var(--app-pink-soft)] px-2 py-0.5 text-[15px] font-bold text-[var(--app-pink-strong)] border"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    );
  }

  // default variant
  if (!hasAny) {
    return (
      <article
        className="rounded-[16px] border p-4"
        style={{
          background: 'rgba(212,148,38,0.04)',
          borderColor: 'rgba(212,148,38,0.28)',
        }}
      >
        <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-amber)]">
          💡 더 정확한 풀이를 받으시려면
        </div>
        <p
          className="mt-1.5 text-[14.4px] leading-[1.55] text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          현재 관계·직업·고민을 알려주시면 본인 상황에 맞춘 호명으로 풀이가 만들어져요.
          입력값은 사주 본문과 오늘의 운세 점수에 즉시 반영됩니다.
        </p>
        <Link
          href={fallbackInputHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[15px] font-extrabold text-[var(--app-pink-strong)]"
          style={{ borderColor: 'var(--app-pink-line)' }}
        >
          현재 상황 입력하기 →
        </Link>
      </article>
    );
  }

  return (
    <article
      className="rounded-[16px] border p-4"
      style={{
        background: 'var(--app-pink-soft)',
        borderColor: 'var(--app-pink-line)',
      }}
    >
      <div className="text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
        ✓ 이 풀이는 당신의 상황을 반영했어요
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[15px] font-bold text-[var(--app-pink-strong)] border"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <span>{item.label}</span>
          </span>
        ))}
      </div>
      <p
        className="mt-2.5 text-[15px] leading-[1.45] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        본문의 일간 풀이 · 십성 · 대운 해석이 위 상황을 호명하여 작성됐어요.
      </p>
      <Link
        href={fallbackInputHref}
        className="mt-2 inline-block text-[15px] font-bold text-[var(--app-copy-muted)] underline-offset-2 hover:underline"
      >
        상황 다시 입력하기 →
      </Link>
    </article>
  );
}
