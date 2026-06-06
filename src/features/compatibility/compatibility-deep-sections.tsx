'use client';

// 2026-05-23 — 유료 §8 "깊은 풀이" 점진적 강화(②-b).
//   결정론 deepSections 를 즉시 보여주고(빈 화면 방지), 플래그 ON 일 때만 LLM 깊은 풀이를
//   비동기로 받아 교체한다. 실패 시 결정론 섹션을 그대로 유지(사용자 비차단).
import { useEffect, useState } from 'react';
import type { CompatibilityRelationshipSlug } from '@/content/moonlight';
import type { CompatibilityDeepSection } from '@/lib/compatibility';
import type { BirthInput } from '@/lib/saju/types';

interface CompatibilityDeepSectionsProps {
  relationship: CompatibilityRelationshipSlug;
  self: { name: string; birthInput: BirthInput };
  partner: { name: string; birthInput: BirthInput };
  fallbackSections: CompatibilityDeepSection[];
  /** 서버가 OPENAI_INTERPRET_COMPATIBILITY 플래그를 평가해 전달. false 면 fetch 안 함. */
  enabled: boolean;
}

export function CompatibilityDeepSections({
  relationship,
  self,
  partner,
  fallbackSections,
  enabled,
}: CompatibilityDeepSectionsProps) {
  const [sections, setSections] = useState<CompatibilityDeepSection[]>(fallbackSections);
  const [loading, setLoading] = useState(false);

  // 값 동일성 기반 의존성(객체 신원 변화로 인한 반복 호출 방지).
  const requestBody = JSON.stringify({ relationship, self, partner });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    fetch('/api/interpret/compatibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (
          cancelled ||
          !data?.ok ||
          !Array.isArray(data.sections) ||
          data.sections.length === 0
        ) {
          return;
        }
        if (data.source === 'llm' || data.source === 'cache') {
          setSections(data.sections as CompatibilityDeepSection[]);
        }
      })
      .catch(() => {
        // 네트워크/서버 오류 시 결정론 fallback 유지.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, requestBody]);

  return (
    <div className="grid gap-2.5">
      {loading && (
        <div className="text-[12px] font-medium text-[var(--app-copy-muted)]" aria-live="polite">
          두 분께 맞춘 더 깊은 풀이를 불러오는 중입니다…
        </div>
      )}
      {sections.map((item, index) => (
        <article
          key={item.key}
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-pink-line)' }}
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
              style={{ background: 'var(--app-pink)' }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="break-keep text-[14.5px] font-extrabold leading-[1.5] text-[var(--app-ink)]"
                style={{ wordBreak: 'keep-all' }}
              >
                {item.title}
              </div>
              <p className="mt-1.5 break-keep text-[13px] leading-[1.7] text-[var(--app-copy)]">
                {item.body}
              </p>
              {item.evidence ? (
                <p
                  className="mt-1.5 break-keep text-[11px] leading-[1.6] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {item.evidence}
                </p>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
