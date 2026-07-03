'use client';
// 2026-07-04 — 계정 관리 카드(super_admin): 이용정지/해제 · 정보수정(이름/전화번호) · 삭제.
// POST /api/admin/users/manage. 삭제는 대상 이메일 타이핑 확인(오클릭 방지 이중 안전장치).
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AccountManagementActions({
  role,
  userId,
  email,
  bannedUntil,
  currentDisplayName,
  currentPhone,
}: {
  role: 'admin' | 'super_admin';
  userId: string;
  email: string | null;
  bannedUntil: string | null;
  currentDisplayName: string | null;
  currentPhone: string | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(currentDisplayName ?? '');
  const [phone, setPhone] = useState(currentPhone ?? '');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (role !== 'super_admin') {
    return <p className="text-xs text-neutral-500">계정 관리는 super_admin 만 가능합니다.</p>;
  }

  const banned = Boolean(bannedUntil);

  async function call(body: Record<string, unknown>, confirmText?: string) {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/users/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reason, ...body }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; action?: string }
        | null;
      if (res.ok && data?.ok) {
        if (data.action === 'delete') {
          setMsg('삭제 완료 — 목록으로 이동합니다.');
          window.location.href = '/admin/users';
          return;
        }
        setMsg('처리 완료');
        router.refresh();
      } else {
        setMsg(`실패: ${data?.error ?? res.status}`);
      }
    } catch {
      setMsg('실패: 네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full rounded-[8px] border border-[var(--app-line)] px-2.5 py-1.5 text-[13.8px]';

  return (
    <div className="space-y-4 text-[13.8px]">
      {/* 상태 + 사유 */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[12.1px] font-extrabold ${
            banned
              ? 'bg-[var(--app-coral)] text-white'
              : 'bg-[var(--app-pink-soft)] text-[var(--app-ink)]'
          }`}
        >
          {banned ? '⛔ 이용정지 중' : '정상 이용 중'}
        </span>
        <input
          type="text"
          placeholder="사유(감사로그 기록, 선택)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${inputCls} max-w-[280px]`}
        />
      </div>

      {/* 이용정지/해제 */}
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(
              { action: banned ? 'unban' : 'ban' },
              banned
                ? '이용정지를 해제할까요? 즉시 로그인 가능해집니다.'
                : '이 사용자를 이용정지할까요?\n신규 로그인이 차단됩니다(기존 토큰은 만료 시까지 유효할 수 있음).'
            )
          }
          className={`rounded-[10px] px-3 py-1.5 font-extrabold text-white disabled:opacity-60 ${
            banned ? 'bg-[var(--app-jade)]' : 'bg-[var(--app-coral)]'
          }`}
        >
          {banned ? '정지 해제' : '이용정지'}
        </button>
      </div>

      {/* 정보 수정 */}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12.1px] text-[var(--app-copy-soft)]">표시명(이름)</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputCls}
            placeholder="프로필 저장 후 수정 가능"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12.1px] text-[var(--app-copy-soft)]">
            전화번호(비우면 삭제 · 광고동의는 불변)
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            placeholder="010-0000-0000"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          call({
            action: 'update_info',
            ...(displayName.trim() && displayName.trim() !== (currentDisplayName ?? '')
              ? { displayName: displayName.trim() }
              : {}),
            ...(phone.trim() !== (currentPhone ?? '') ? { phone: phone.trim() } : {}),
          })
        }
        className="rounded-[10px] border px-3 py-1.5 font-extrabold disabled:opacity-60"
      >
        정보 저장
      </button>

      {/* 계정 삭제 — 이메일 타이핑 확인 */}
      <div
        className="rounded-[10px] border px-3 py-2.5"
        style={{ borderColor: 'var(--app-coral)' }}
      >
        <div className="font-extrabold text-[var(--app-coral)]">계정 삭제 (복구 불가)</div>
        <p className="mt-1 text-[12.6px] text-[var(--app-copy-soft)]" style={{ wordBreak: 'keep-all' }}>
          사주·결제·전 잔액 등 연결 데이터가 함께 삭제됩니다. 확인을 위해 대상 이메일
          (<code className="text-[12.1px]">{email ?? userId}</code>)을 정확히 입력하세요.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="text"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={email ?? userId}
            className={`${inputCls} max-w-[280px]`}
          />
          <button
            type="button"
            disabled={busy || confirmEmail.trim() !== (email ?? userId)}
            onClick={() =>
              call(
                { action: 'delete', confirmEmail: confirmEmail.trim() },
                `정말 이 계정을 영구 삭제할까요?\n${email ?? userId}\n\n이 작업은 되돌릴 수 없습니다.`
              )
            }
            className="rounded-[10px] bg-[var(--app-coral)] px-3 py-1.5 font-extrabold text-white disabled:opacity-40"
          >
            영구 삭제
          </button>
        </div>
      </div>

      {msg ? <p className="text-[12.6px] text-[var(--app-copy-soft)]">{msg}</p> : null}
    </div>
  );
}
