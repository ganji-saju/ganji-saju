'use client';

// 2026-05-18: 정책 hub 의 탭 UI (client) — 가로 스크롤 chip + 본문 영역.
//
// URL 동기화: 탭 클릭 시 ?tab={kind} 갱신 (browser back 지원).
// 본문 없으면 PolicyNotReady fallback (운영자 admin 입력 전).

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PolicyContent } from '@/components/policies/policy-content';
import { PolicyNotReady } from '@/components/policies/policy-not-ready';
import type { PolicyKind, PolicyVersion } from '@/shared/policies/types';

interface Props {
  kinds: PolicyKind[];
  labels: Record<PolicyKind, string>;
  initialTab: PolicyKind;
  initialActive: Partial<Record<PolicyKind, PolicyVersion>>;
}

// 9 라벨 줄임 표기 — 모바일 chip 너비 제한 대응.
const SHORT_LABELS: Record<PolicyKind, string> = {
  terms: '이용약관',
  privacy: '개인정보',
  refund: '환불',
  subscription: '구독',
  coin: '재화',
  'digital-content': '디지털',
  appointment: '예약상담',
  'ai-disclaimer': 'AI 한계',
  'commerce-disclosure': '사업자고지',
};

export function LegalTabsClient({ kinds, labels, initialTab, initialActive }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<PolicyKind>(initialTab);

  const active = useMemo(() => initialActive, [initialActive]);
  const currentPolicy = active[selected];

  function selectTab(kind: PolicyKind) {
    setSelected(kind);
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', kind);
    router.replace(`/legal?${next.toString()}`, { scroll: false });
  }

  return (
    <section className="legal-tabs space-y-4">
      {/* 가로 스크롤 chip 탭 */}
      <nav
        aria-label="정책 탭"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {kinds.map((kind) => {
          const isSelected = selected === kind;
          const hasContent = Boolean(active[kind]);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => selectTab(kind)}
              aria-pressed={isSelected}
              className={
                'shrink-0 rounded-[12px] border px-3 py-1.5 text-[14.4px] font-bold leading-none transition-colors ' +
                (isSelected
                  ? 'border-[var(--app-pink-strong)] bg-[var(--app-pink-strong)] text-white'
                  : 'border-[var(--app-line)] bg-white text-[var(--app-copy)]')
              }
              title={labels[kind]}
            >
              <span>{SHORT_LABELS[kind]}</span>
              {!hasContent && (
                <span
                  aria-label="본문 출시 예정"
                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--app-copy-muted)] align-middle"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* 본문 영역 */}
      <div
        className="rounded-[14px] border bg-white p-4 sm:p-6"
        style={{ borderColor: 'var(--app-line)' }}
      >
        {currentPolicy ? (
          <PolicyContent policy={currentPolicy} />
        ) : (
          <PolicyNotReady kind={selected} />
        )}
      </div>
    </section>
  );
}
