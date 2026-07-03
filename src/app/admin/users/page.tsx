import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPage } from '@/components/admin/admin-page';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { searchAdminUsers } from '@/lib/admin/user-detail';
import { countAdminUsers, fetchAdminUserList, fetchContactFlags } from '@/lib/admin/user-list';
import { RefreshSummaryButton } from './refresh-summary-button';
import { maskEmail } from '@/lib/admin/masking';
import {
  parseListParams,
  buildListItem,
  cursorForRow,
  encodeCursor,
} from '@/lib/admin/user-list-query';
import { SEGMENTS } from '@/lib/admin/segments';

export const metadata: Metadata = {
  title: '가입자 관리 (admin)',
  description: '전체 가입자 목록·필터·정렬·검색',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// 2026-07-04 — UTC slice 는 KST 00~09시 발생 건이 전날로 표시 → Asia/Seoul 변환(sv-SE=YYYY-MM-DD).
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) : '';
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso)
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false })
    .slice(0, 16);
}
function fmtWon(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}
// 가입경로 짧은 라벨.
const PROVIDER_LABEL: Record<string, string> = {
  email: '이메일',
  kakao: '카카오',
  google: '구글',
};
function toSP(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') out.set(k, v);
    else if (Array.isArray(v) && v[0]) out.set(k, v[0]);
  }
  return out;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const raw = await searchParams;
  const usp = toSP(raw);
  const query = (usp.get('q') ?? '').trim();

  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  // 역할 조회 실패 시 가장 제한적인 'admin'(마스킹·비PII)으로 fail-safe. 권한 상승 없음.
  const role = check.role ?? 'admin';

  const searchResults = query ? await searchAdminUsers(query) : [];

  const params = parseListParams(usp);
  // 2026-07-04 감사 — 헤더 '가입자 N명'이 현재 페이지 행수(최대 50)를 표시하던 문제:
  // 필터 적용 정확 총원(countAdminUsers, head 카운트)을 병렬 조회.
  const [page, totalCount] = await Promise.all([
    fetchAdminUserList(params),
    countAdminUsers(params),
  ]);
  const nowIso = new Date().toISOString();
  const items = page.rows.map((r) => buildListItem(r, role, nowIso));
  // 2026-07-04 — 알림톡 도달 가능 여부(전화번호 보유·광고동의) 표시용(표시 행만 IN 조회).
  const contactFlags = await fetchContactFlags(items.map((it) => it.userId));
  // 요약 신선도 — 2시간 넘게 갱신이 없으면 경고(과거 '기준 2026-06-05' 고착 사례 예방).
  const summaryAgeHours = page.refreshedAt
    ? (Date.now() - new Date(page.refreshedAt).getTime()) / 3_600_000
    : null;
  const summaryStale = summaryAgeHours == null || summaryAgeHours > 2;
  const nextCursor =
    page.hasMore && page.rows.length > 0
      ? encodeCursor(cursorForRow(page.rows[page.rows.length - 1], params.sort))
      : null;

  const nextHref = (() => {
    if (!nextCursor) return null;
    const n = new URLSearchParams(usp);
    n.set('cursor', nextCursor);
    return `/admin/users?${n.toString()}`;
  })();

  return (
    <AdminPage title="가입자 관리">

        <form method="get" className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <label htmlFor="q" className="text-[15px] font-extrabold text-[var(--app-ink)]">
            이메일 또는 UUID 빠른검색
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="kym@example.com 또는 UUID"
              className="flex-1 rounded-[10px] border border-[var(--app-line)] px-3 py-2 text-[15px]"
            />
            <button type="submit" className="rounded-[10px] bg-[var(--app-pink-strong)] px-4 py-2 text-[15px] font-extrabold text-white">
              검색
            </button>
          </div>
          {query && (
            <ul className="mt-3 space-y-2">
              {searchResults.length === 0 && (
                <li className="text-[13.8px] text-[var(--app-copy-soft)]">일치하는 사용자가 없습니다.</li>
              )}
              {searchResults.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="block rounded-[12px] border border-[var(--app-line)] p-3 hover:bg-[var(--app-pink-soft)]">
                    <span className="text-[15px] font-bold">{maskEmail(u.email, role) ?? u.id}</span>
                    <span className="ml-2 text-[12.6px] text-[var(--app-copy-soft)]">{fmtDate(u.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {SEGMENTS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/users?${s.query}`}
              title={s.description}
              className="rounded-full border border-[var(--app-line)] px-3 py-1 text-[13.8px] text-[var(--app-ink)] hover:bg-[var(--app-pink-soft)]"
            >
              {s.label}
            </Link>
          ))}
          <Link
            href="/admin/users/segments"
            className="rounded-full border border-[var(--app-pink-strong)] px-3 py-1 text-[13.8px] font-extrabold text-[var(--app-pink-strong)]"
          >
            세그먼트·코호트 개요 →
          </Link>
        </div>

        <form method="get" className="rounded-[14px] border border-[var(--app-line)] bg-white p-4 grid grid-cols-2 gap-3 md:grid-cols-4 text-[13.8px]">
          <label className="flex flex-col gap-1">회원상태
            <select name="status" defaultValue={params.status} className="rounded border px-2 py-1">
              <option value="all">전체</option><option value="active">활성</option><option value="dormant">휴면</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">결제
            <select name="paid" defaultValue={params.paid} className="rounded border px-2 py-1">
              <option value="all">전체</option><option value="yes">있음</option><option value="no">없음</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">구독
            <select name="subscription" defaultValue={params.subscription} className="rounded border px-2 py-1">
              <option value="all">전체</option><option value="active">active</option><option value="cancelled">cancelled</option><option value="expired">expired</option><option value="none">없음</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">정렬
            <select name="sort" defaultValue={params.sort} className="rounded border px-2 py-1">
              <option value="signup">가입일↓</option><option value="ltv">결제액↓</option><option value="last_active">최근활동↓</option><option value="paid_count">결제건수↓</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">최소 결제액(₩)
            <input name="minLtv" type="number" defaultValue={params.minLtv ?? ''} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">비활동 ≥(일)
            <input name="inactiveDays" type="number" defaultValue={params.inactiveDays ?? ''} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">가입경로
            <input name="provider" defaultValue={params.provider.join(',')} placeholder="email,google" className="rounded border px-2 py-1" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-[10px] bg-[var(--app-pink-strong)] px-4 py-2 font-extrabold text-white">적용</button>
            <Link href="/admin/users" className="rounded-[10px] border px-3 py-2">초기화</Link>
          </div>
        </form>

        <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">
              가입자 {totalCount.toLocaleString('ko-KR')}명
              {items.length < totalCount ? (
                <span className="ml-1 text-[12.6px] font-bold text-[var(--app-copy-soft)]">
                  (표시 {items.length})
                </span>
              ) : null}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {/* 2026-07-04 — 신선도 경고: 시간별 cron 이 죽으면 요약이 조용히 굳던 문제
                  (기준 2026-06-05 고착 사례). 2시간 초과 시 경고 + super_admin 수동 갱신. */}
              <span
                className={`text-[12.6px] ${summaryStale ? 'font-extrabold text-[var(--app-coral)]' : 'text-[var(--app-copy-soft)]'}`}
              >
                {summaryStale ? '⚠️ ' : ''}요약 기준{' '}
                {page.refreshedAt ? fmtDateTime(page.refreshedAt) : '없음'}
                {summaryAgeHours != null && summaryAgeHours > 2
                  ? ` (${Math.floor(summaryAgeHours)}시간 전 — cron 확인 필요)`
                  : ''}
              </span>
              {role === 'super_admin' ? <RefreshSummaryButton /> : null}
              <a href={`/api/admin/users/export?${usp.toString()}`} className="rounded-[10px] border px-3 py-1 text-[13.8px]">CSV 내보내기</a>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-[12px] border border-dashed border-[var(--app-line)] p-6 text-center">
              <p className="text-[15px] font-bold">조건에 맞는 가입자가 없어요</p>
              <p className="mt-1 text-[13.8px] text-[var(--app-copy-soft)]">필터를 바꾸거나 세그먼트를 눌러보세요.</p>
              <Link href="/admin/users" className="mt-3 inline-block rounded-[10px] border px-3 py-1 text-[13.8px]">필터 초기화</Link>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[13.8px]">
                <thead>
                  <tr className="text-left text-[var(--app-copy-soft)]">
                    <th className="py-1">표시명/이메일</th><th>가입일</th><th>경로</th><th>LTV</th><th>결제</th><th>구독</th><th>연락처</th><th>최근활동</th><th>뱃지</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.userId} className="border-t border-[var(--app-line)]">
                      <td className="py-2">
                        <Link href={`/admin/users/${it.userId}`} className="font-bold hover:underline">{it.displayName}</Link>
                        <div className="text-[12.6px] text-[var(--app-copy-soft)]">{it.email ?? '—'}</div>
                      </td>
                      <td>{fmtDate(it.signupAt)}</td>
                      <td>{PROVIDER_LABEL[it.signupProvider ?? ''] ?? it.signupProvider ?? '—'}</td>
                      <td>{fmtWon(it.ltvWon)}</td>
                      <td>{it.paidCount}</td>
                      <td>{it.subscriptionStatus ?? '—'}</td>
                      {/* 연락처 — 알림톡 도달 가능(📱) + 광고(친구톡) 동의(📢) 여부 */}
                      <td title={contactFlags.get(it.userId)?.hasPhone ? '전화번호 등록됨(알림톡 도달 가능)' : '전화번호 없음'}>
                        {contactFlags.get(it.userId)?.hasPhone ? (
                          <>
                            📱{contactFlags.get(it.userId)?.adConsent ? ' 📢' : ''}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{fmtDate(it.lastActiveAt)}</td>
                      <td className="space-x-1">
                        {it.badges.map((b) => (
                          <span key={b} className="rounded bg-[var(--app-pink-soft)] px-1.5 py-0.5 text-[11.5px]">{b}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextHref && (
            <div className="mt-4 text-center">
              <Link href={nextHref} className="rounded-[10px] border px-4 py-2 text-[13.8px]">다음 페이지 ›</Link>
            </div>
          )}
        </section>
    </AdminPage>
  );
}
