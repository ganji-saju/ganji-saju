'use client';

// Phase 3-B (2026-05-18): 정책 관리 admin UI client component.
//
// 좌측: 9 정책 종류 nav (활성 버전 + 시행일)
// 우측: 선택 정책의 현재 활성 + 이력 + 신규 버전 생성 form

import { useEffect, useState } from 'react';
import { POLICY_LABELS, POLICY_URLS, type PolicyKind, type PolicyVersion } from '@/shared/policies/types';

interface Props {
  kinds: string[]; // PolicyKind[]
  initialActive: Partial<Record<PolicyKind, PolicyVersion>>;
}

interface FormState {
  version: string;
  effectiveDate: string;
  content: string;
  contentFormat: 'markdown' | 'html' | 'plaintext';
  requiresReconsent: boolean;
  changelog: string;
}

const EMPTY_FORM: FormState = {
  version: '',
  effectiveDate: '',
  content: '',
  contentFormat: 'markdown',
  requiresReconsent: false,
  changelog: '',
};

export function PoliciesAdminClient({ kinds, initialActive }: Props) {
  const [selectedKind, setSelectedKind] = useState<PolicyKind>(kinds[0] as PolicyKind);
  const [active, setActive] = useState(initialActive);
  const [history, setHistory] = useState<PolicyVersion[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 종류 변경 시 이력 다시 fetch
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/policies?kind=${encodeURIComponent(selectedKind)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          setHistory(data.history ?? []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedKind]);

  const activePolicy = active[selectedKind];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: selectedKind,
          version: form.version.trim(),
          effectiveDate: form.effectiveDate,
          content: form.content,
          contentFormat: form.contentFormat,
          requiresReconsent: form.requiresReconsent,
          changelog: form.changelog.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `요청 실패 (${res.status})`);
      }
      setMessage({ type: 'ok', text: `${POLICY_LABELS[selectedKind]} ${form.version} 저장 완료` });
      setActive((prev) => ({ ...prev, [selectedKind]: data.policy }));
      setHistory((prev) => [data.policy, ...prev]);
      setForm(EMPTY_FORM);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'err', text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* 좌측 nav — 9 정책 종류 */}
      <aside className="space-y-1">
        {kinds.map((k) => {
          const policy = active[k as PolicyKind];
          const isSelected = selectedKind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedKind(k as PolicyKind)}
              className={
                'block w-full rounded-[10px] border px-3 py-2 text-left text-[13px] leading-[1.5] ' +
                (isSelected
                  ? 'border-[var(--app-pink-strong)] bg-[var(--app-pink-tint)] font-bold text-[var(--app-ink)]'
                  : 'border-[var(--app-line)] bg-white text-[var(--app-copy)]')
              }
            >
              <div className="font-bold">{POLICY_LABELS[k as PolicyKind]}</div>
              <div className="mt-0.5 text-[11px] text-[var(--app-copy-muted)]">
                {policy ? `${policy.version} (${policy.effectiveDate})` : '미입력'}
              </div>
            </button>
          );
        })}
      </aside>

      {/* 우측 — 활성 + 이력 + 신규 form */}
      <section className="space-y-4">
        <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: 'var(--app-line)' }}>
          <h2 className="text-[14px] font-extrabold">
            {POLICY_LABELS[selectedKind]}{' '}
            <a
              href={POLICY_URLS[selectedKind]}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-[11px] font-normal text-[var(--app-copy-muted)] underline"
            >
              사용자 페이지 열기 →
            </a>
          </h2>
          <p className="mt-1 text-[12px] text-[var(--app-copy-muted)]">
            {activePolicy
              ? `현재 활성: ${activePolicy.version} · 시행일 ${activePolicy.effectiveDate}` +
                (activePolicy.requiresReconsent ? ' · 재동의 필요' : '')
              : '활성 버전 없음 — 사용자 페이지는 "고객센터 안내" 상태 + noindex'}
          </p>
        </div>

        {/* 신규 버전 생성 form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-[14px] border bg-white p-4 space-y-3"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <h3 className="text-[13px] font-extrabold">신규 버전 생성</h3>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--app-copy-muted)]">
                버전 (semver, 예: v1.0.0)
              </span>
              <input
                type="text"
                required
                pattern="^v\d+\.\d+\.\d+$"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="v1.0.0"
                className="mt-1 w-full rounded border px-3 py-2 text-[14px]"
                style={{ borderColor: 'var(--app-line)' }}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--app-copy-muted)]">
                시행일 (YYYY-MM-DD)
              </span>
              <input
                type="date"
                required
                value={form.effectiveDate}
                onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                className="mt-1 w-full rounded border px-3 py-2 text-[14px]"
                style={{ borderColor: 'var(--app-line)' }}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-[var(--app-copy-muted)]">
              본문 ({form.contentFormat})
            </span>
            <textarea
              required
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={20}
              placeholder="markdown 본문 (헤더 # ## ###, 리스트 -, **bold**, *italic*, `code` 지원)"
              className="mt-1 w-full rounded border px-3 py-2 text-[13px] font-mono leading-[1.6]"
              style={{ borderColor: 'var(--app-line)' }}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--app-copy-muted)]">
                본문 형식
              </span>
              <select
                value={form.contentFormat}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    contentFormat: e.target.value as 'markdown' | 'html' | 'plaintext',
                  }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-[14px]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <option value="markdown">markdown (권장)</option>
                <option value="html">html (운영자 책임)</option>
                <option value="plaintext">plaintext</option>
              </select>
            </label>
            <label className="mt-7 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.requiresReconsent}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requiresReconsent: e.target.checked }))
                }
              />
              <span>
                재동의 필요 (사용자에게 불리한 변경 · MAJOR semver — 정기 사용자 재동의 모달 트리거)
              </span>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-[var(--app-copy-muted)]">
              변경 사유 (선택 — 변경 이력 페이지에 표시)
            </span>
            <input
              type="text"
              value={form.changelog}
              onChange={(e) => setForm((f) => ({ ...f, changelog: e.target.value }))}
              placeholder="예: 환불 기준 7일 → 14일로 연장"
              className="mt-1 w-full rounded border px-3 py-2 text-[14px]"
              style={{ borderColor: 'var(--app-line)' }}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-[10px] bg-[var(--app-pink-strong)] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {submitting ? '저장 중...' : '신규 버전 저장'}
            </button>
            {message && (
              <span
                className={
                  message.type === 'ok'
                    ? 'text-[12px] text-[var(--app-jade)]'
                    : 'text-[12px] text-[var(--app-pink-strong)]'
                }
              >
                {message.text}
              </span>
            )}
          </div>
        </form>

        {/* 이력 */}
        <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: 'var(--app-line)' }}>
          <h3 className="text-[13px] font-extrabold">버전 이력</h3>
          {history.length === 0 ? (
            <p className="mt-2 text-[12px] text-[var(--app-copy-muted)]">이력 없음.</p>
          ) : (
            <table className="mt-2 w-full text-[12px]">
              <thead>
                <tr className="text-left text-[var(--app-copy-muted)]">
                  <th className="py-1">버전</th>
                  <th className="py-1">시행일</th>
                  <th className="py-1">재동의</th>
                  <th className="py-1">변경 사유</th>
                  <th className="py-1">생성</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t" style={{ borderColor: 'var(--app-line)' }}>
                    <td className="py-1.5 font-bold">{h.version}</td>
                    <td className="py-1.5">{h.effectiveDate}</td>
                    <td className="py-1.5">{h.requiresReconsent ? '✓' : ''}</td>
                    <td className="py-1.5">{h.changelog ?? ''}</td>
                    <td className="py-1.5 text-[var(--app-copy-muted)]">
                      {new Date(h.createdAt).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
