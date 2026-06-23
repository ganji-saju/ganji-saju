/**
 * 정책 본문 렌더러 — Phase 3-B (2026-05-18).
 *
 * format = 'markdown' | 'html' | 'plaintext'
 *
 * markdown: 헤더 + 단락 + 리스트 정도만 (외부 markdown 라이브러리 의존 없이 직접 구현).
 *           복잡한 마크업 필요 시 html format 사용.
 * html:     운영자 입력 HTML 그대로 (XSS 위험 → admin 검증 신뢰).
 * plaintext: 단순 줄바꿈만.
 */

import { POLICY_LABELS, type PolicyContentFormat, type PolicyVersion } from '@/shared/policies/types';
import { formatKoreanDate } from '@/shared/utils/kst';

interface PolicyContentProps {
  policy: PolicyVersion;
}

export function PolicyContent({ policy }: PolicyContentProps) {
  return (
    <article
      className="policy-content space-y-4"
      data-policy-kind={policy.kind}
      data-policy-version={policy.version}
    >
      <header className="space-y-1">
        <h1 className="text-[23px] font-extrabold leading-tight text-[var(--app-ink)]">
          {POLICY_LABELS[policy.kind]}
        </h1>
        <p className="text-[13.8px] text-[var(--app-copy-muted)]">
          버전 {policy.version} · 시행일 {formatKoreanDate(new Date(policy.effectiveDate))}
        </p>
      </header>
      <PolicyBody content={policy.content} format={policy.contentFormat} />
    </article>
  );
}

function PolicyBody({
  content,
  format,
}: {
  content: string;
  format: PolicyContentFormat;
}) {
  if (format === 'html') {
    return (
      <div
        className="policy-body text-[16.1px] leading-[1.8] text-[var(--app-copy)]"
        // 운영자 입력 HTML 신뢰 (admin 인증 + 본인 입력 가정)
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  if (format === 'plaintext') {
    return (
      <pre
        className="policy-body whitespace-pre-wrap text-[16.1px] leading-[1.8] text-[var(--app-copy)]"
        style={{ fontFamily: 'inherit' }}
      >
        {content}
      </pre>
    );
  }
  // markdown — 간단한 헤더/단락/리스트만 처리. 외부 의존 없음.
  return <MarkdownLite content={content} />;
}

/**
 * 외부 의존 없는 마크다운 lite 렌더러.
 * 지원: `#`/`##`/`###` 헤더, `-` `*` 리스트, 빈 줄 단락, **bold**, *italic*.
 * 운영자가 복잡한 마크업 필요 시 contentFormat='html' 권장.
 */
function MarkdownLite({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // 헤더
    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const HeaderTag = (`h${level + 1}` as 'h2' | 'h3' | 'h4');
      const headerSize = level === 1 ? 'text-[20.7px]' : level === 2 ? 'text-[18.4px]' : 'text-[16.1px]';
      blocks.push(
        <HeaderTag
          key={key++}
          className={`mt-5 font-extrabold ${headerSize} text-[var(--app-ink)]`}
        >
          {renderInline(text)}
        </HeaderTag>
      );
      i++;
      continue;
    }

    // 리스트 (연속된 `-` 또는 `*` 줄)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul
          key={key++}
          className="ml-5 list-disc space-y-1 text-[16.1px] leading-[1.8] text-[var(--app-copy)]"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 단락 (연속된 비-빈 줄)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s)/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p
        key={key++}
        className="text-[16.1px] leading-[1.8] text-[var(--app-copy)]"
        style={{ wordBreak: 'keep-all' }}
      >
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="policy-body space-y-3">{blocks}</div>;
}

/** **bold** / *italic* / `code` 인라인 처리. */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // 매우 간단한 토큰화 — bold 우선, italic 다음, code 다음
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  tokens.forEach((tok, idx) => {
    if (/^\*\*.+\*\*$/.test(tok)) {
      parts.push(<strong key={idx}>{tok.slice(2, -2)}</strong>);
    } else if (/^\*.+\*$/.test(tok)) {
      parts.push(<em key={idx}>{tok.slice(1, -1)}</em>);
    } else if (/^`.+`$/.test(tok)) {
      parts.push(
        <code key={idx} className="rounded bg-[var(--app-line)] px-1 text-[15px]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok) {
      parts.push(<span key={idx}>{tok}</span>);
    }
  });
  return parts;
}
