import { Badge } from '@/components/ui/badge';
import {
  getClassicEvidence,
  type ClassicEvidenceItem,
} from '@/server/classics/evidence';
import { cn } from '@/lib/utils';

interface ClassicEvidencePanelProps {
  concept: string;
  className?: string;
}

function formatClassicEvidenceStatus(status: string, count: number) {
  if (count > 0) return `${count}개 문단`;
  if (status === 'missing-env') return '연결 준비 중';
  if (status === 'db-error') return '원문 준비 중';
  return '검수 대기';
}

function formatClassicEvidenceSummary(item: ClassicEvidenceItem) {
  if (item.passage.commentaryKo) return item.passage.commentaryKo;

  return `${item.work.titleKo} ${item.section.titleKo} 자료입니다. 한글 풀이가 준비되면 이 영역에 표시됩니다.`;
}

function ClassicEvidenceCard({ item }: { item: ClassicEvidenceItem }) {
  const summary = formatClassicEvidenceSummary(item);

  return (
    <article className="moon-classic-quote p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-[var(--app-gold)]/30 bg-[var(--app-gold)]/12 text-[var(--app-gold-text)]">
          {item.work.titleKo}
        </Badge>
        <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
          {item.work.editionName ?? item.work.sourceItemTitle}
        </Badge>
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.22em] text-[var(--app-copy-soft)]">
        {item.section.path} · {item.section.titleKo}
      </div>

      <div className="mt-3 rounded-2xl border border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-gold-soft)]">
          한글 풀이
        </div>
        <p className="mt-2 text-sm leading-7 text-[var(--app-ivory)]">{summary}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm leading-7 text-[var(--app-copy-muted)]">
        {item.passage.readingKo ? <p>독음 · {item.passage.readingKo}</p> : null}
        {item.passage.literalKo ? <p>직역 · {item.passage.literalKo}</p> : null}
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--app-copy)] transition-colors hover:border-[var(--app-gold)]/30 hover:text-[var(--app-ivory)]">
          <span>원문 보기</span>
          <span
            aria-hidden="true"
            className="text-[var(--app-copy-soft)] transition-transform group-open:rotate-180"
          >
            ˅
          </span>
        </summary>
        <blockquote
          lang="zh-Hant"
          className=" mt-3 break-words rounded-2xl border border-[var(--app-gold)]/14 bg-[var(--app-surface-muted)] px-4 py-4 text-base leading-8 text-[var(--app-gold-text)]"
        >
          {item.passage.originalZh}
        </blockquote>
      </details>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-[var(--app-copy)]">
          {item.provenance.sourceName}
        </span>
        <span className="max-w-full break-all rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-[var(--app-copy-soft)]">
          {item.provenance.sourceRef}
        </span>
        {item.provenance.license ? (
          <span className="rounded-full border border-[var(--app-gold)]/20 bg-[var(--app-gold)]/8 px-3 py-1 text-[var(--app-gold-soft)]">
            {item.provenance.license}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export async function ClassicEvidencePanel({
  concept,
  className,
}: ClassicEvidencePanelProps) {
  const evidence = await getClassicEvidence({ concept });

  return (
    <section className={cn('border-t border-[var(--app-line)] pt-6', className)}>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-3 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-4 transition-colors hover:border-[var(--app-gold)]/30 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="app-caption">참고 원문</span>
            <span className="mt-2 block text-lg font-semibold text-[var(--app-ivory)]">
              {evidence.concept} 참고 자료
            </span>
            <span className="mt-2 block text-sm leading-7 text-[var(--app-copy-muted)]">
              출처 확인이 필요한 경우에만 열어보세요.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
              {formatClassicEvidenceStatus(evidence.status, evidence.count)}
            </Badge>
            <span
              aria-hidden="true"
              className="text-[var(--app-copy-soft)] transition-transform group-open:rotate-180"
            >
              ˅
            </span>
          </span>
        </summary>

        {/* 2026-05-15 — 고전 인용문 + 풀이 본문이 김. 1열 stack 으로 가독성 회복. */}
        {evidence.items.length > 0 ? (
          <div className="mt-5 grid gap-4">
            {evidence.items.map((item) => (
              <ClassicEvidenceCard key={item.passage.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-5 py-5">
            <div className="text-sm font-semibold text-[var(--app-ivory)]">
              원문 코퍼스 적재를 기다리고 있습니다
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">
              검수된 문단이 연결되면 원문, 독음, 직역, 해설, 출처와 라이선스가 이 영역에 함께
              표시됩니다. 지금은 신뢰할 수 있는 판본과 출처 기준을 먼저 맞추고 있습니다.
            </p>
          </div>
        )}
      </details>
    </section>
  );
}
