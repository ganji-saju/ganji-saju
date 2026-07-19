// 2026-05-15 — 택일(좋은 날) 클라이언트.
// 사용자가 목적을 선택하면 서버 API 가 사주 + 다음 60일 → 길일 7개 산출 → 노출.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TaekilDayResult, TaekilPurpose } from '@/lib/taekil/find-good-days';
import { TAEKIL_PURPOSES } from '@/lib/taekil/find-good-days';
// 2026-05-18 Phase 5-E: 결과 없음 시 표준 EmptyState + 4 CTA (사용자 directive).
import { EmptyState } from '@/components/state/empty-state';
import { Price } from '@/components/payments/price-provider';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

interface TaekilApiResponse {
  ok: boolean;
  hasProfile?: boolean;
  results?: TaekilDayResult[];
  error?: string;
}

function formatDate(iso: string, weekday: number): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 (${WEEKDAY_KO[weekday]})`;
}

export function TaekilClient() {
  const [purpose, setPurpose] = useState<TaekilPurpose>('wedding');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'no-profile' | 'error'>('idle');
  const [results, setResults] = useState<TaekilDayResult[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setError('');

    fetch(`/api/taekil/find-good-days?purpose=${purpose}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setState('no-profile');
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((data: TaekilApiResponse | null) => {
        if (data === null) return;
        if (data.ok === false && !data.hasProfile) {
          setState('no-profile');
          return;
        }
        if (!data.ok) {
          setError(data.error ?? '길일을 산출하지 못했습니다');
          setState('error');
          return;
        }
        setResults(data.results ?? []);
        setState('success');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setError('네트워크 오류');
        setState('error');
      });

    return () => controller.abort();
  }, [purpose]);

  return (
    <section className="space-y-5 px-1">
      {/* §Hero — pink-soft */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          좋은 날 택일
        </div>
        <h1
          className="mt-1.5 text-[25.3px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          어떤 날을 잡아드릴까요?
        </h1>
        <p
          className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          본인 사주 + 다음 60일 일진을 분석해 목적에 가장 좋은 7일을 찾아드립니다.
        </p>
      </article>

      {/* §목적 선택 */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          목적 선택
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TAEKIL_PURPOSES.map((p) => {
            const isActive = p.key === purpose;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPurpose(p.key)}
                className="rounded-[14px] border bg-white p-3 text-center transition-transform active:scale-95"
                style={{
                  borderColor: isActive ? 'var(--app-pink)' : 'var(--app-line)',
                  background: isActive ? 'var(--app-pink-soft)' : 'white',
                  boxShadow: isActive ? '0 4px 12px rgba(216,27,114,0.16)' : 'none',
                }}
              >
                <div className="text-[25.3px] leading-none">{p.emoji}</div>
                <div className="mt-1.5 text-[13.8px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                  {p.label}
                </div>
              </button>
            );
          })}
        </div>
        <p
          className="mt-2 px-1 text-[12.1px] leading-[1.55] text-[var(--app-copy-soft)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {TAEKIL_PURPOSES.find((p) => p.key === purpose)?.hint}
        </p>
      </section>

      {/* §결과 */}
      {state === 'loading' ? (
        <article className="rounded-[16px] border bg-white p-8 text-center" style={{ borderColor: 'var(--app-line)' }}>
          <div className="motion-spinner-inline mx-auto" aria-hidden="true" />
          <p className="mt-3 text-[15px] font-bold text-[var(--app-copy-muted)]">길일 산출 중...</p>
        </article>
      ) : state === 'no-profile' ? (
        <article
          className="rounded-[18px] border bg-white p-5 text-center"
          style={{ borderColor: 'var(--app-pink-line)' }}
        >
          <div className="text-[36.8px]">📅</div>
          <h2 className="mt-2 text-[18.4px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
            먼저 내 사주 정보를 등록해 주세요
          </h2>
          <p className="mt-2 text-[13.8px] leading-[1.65] text-[var(--app-copy-muted)]" style={{ wordBreak: 'keep-all' }}>
            택일은 본인 사주 원국을 기반으로 합니다. 사주를 한 번 보면 그 정보로
            자동 산출됩니다.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/saju/new"
              className="inline-flex items-center justify-center rounded-[12px] bg-[var(--app-pink)] px-5 py-3 text-[15px] font-extrabold text-white"
            >
              사주 시작하기 →
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[12px] border bg-white px-5 py-3 text-[14.4px] font-bold text-[var(--app-copy-muted)]"
              style={{ borderColor: 'var(--app-line)' }}
            >
              로그인
            </Link>
          </div>
        </article>
      ) : state === 'error' ? (
        <article
          className="rounded-[16px] border bg-white p-5 text-center"
          style={{ borderColor: 'rgba(220,79,79,0.28)', background: 'rgba(220,79,79,0.05)' }}
        >
          <p className="text-[15px] font-bold text-[var(--app-coral)]">{error}</p>
        </article>
      ) : results && results.length > 0 ? (
        <section>
          <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
            추천 {results.length}일 — 점수 높은 순
          </h2>
          <div className="mt-2 grid gap-2.5">
            {results.map((day, idx) => (
              <article
                key={day.isoDate}
                className="flex items-center gap-3 rounded-[16px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                {/* 순위 + 날짜 박스 */}
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-[14px] border text-center"
                  style={{
                    background: idx === 0 ? 'var(--app-pink-soft)' : 'white',
                    borderColor: idx === 0 ? 'var(--app-pink-line)' : 'var(--app-line)',
                  }}
                >
                  <div className="text-[10.9px] font-extrabold text-[var(--app-pink-strong)]">
                    {idx + 1}순위
                  </div>
                  <div className="text-[17.3px] font-extrabold leading-none text-[var(--app-ink)]">
                    {parseInt(day.isoDate.split('-')[2], 10)}일
                  </div>
                  <div className="text-[10.9px] font-bold text-[var(--app-copy-soft)]">
                    {WEEKDAY_KO[day.weekday]}요
                  </div>
                </div>

                {/* 내용 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden="true">{day.gradeEmoji}</span>
                    <span className="text-[15px] font-extrabold text-[var(--app-ink)]">
                      {day.grade}
                    </span>
                    <span className="text-[13.2px] font-bold tabular-nums text-[var(--app-pink-strong)]">
                      · {day.adjustedScore}점
                    </span>
                  </div>
                  <div
                    className="mt-0.5 text-[12.6px] font-bold text-[var(--app-copy-soft)]"
                    style={{ fontFamily: 'var(--font-han)' }}
                  >
                    {formatDate(day.isoDate, day.weekday)} · {day.iljinKorean}({day.iljinGanzi})일
                  </div>
                  <p
                    className="mt-1 text-[13.2px] leading-[1.55] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {day.reasonHint}
                  </p>
                  {day.positiveSinsals.length > 0 || day.negativeSinsals.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {day.positiveSinsals.map((s) => (
                        <span
                          key={`pos-${s}`}
                          className="rounded-[12px] border px-2 py-0.5 text-[11.5px] font-bold"
                          style={{
                            background: 'rgba(45,135,88,0.08)',
                            borderColor: 'rgba(45,135,88,0.28)',
                            color: 'var(--app-jade)',
                          }}
                        >
                          + {s}
                        </span>
                      ))}
                      {day.negativeSinsals.map((s) => (
                        <span
                          key={`neg-${s}`}
                          className="rounded-[12px] border px-2 py-0.5 text-[11.5px] font-bold"
                          style={{
                            background: 'rgba(220,79,79,0.06)',
                            borderColor: 'rgba(220,79,79,0.28)',
                            color: 'var(--app-coral)',
                          }}
                        >
                          − {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {/* 2026-06-07 업셀: 택일(좋은 날 찾기)은 무료, 월간 좋은날 캘린더는 유료(9,900원). */}
          <Link
            href="/saju/new?product=monthly-calendar"
            className="mt-3 flex items-center gap-3 rounded-[16px] border bg-white p-4 no-underline"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            <span aria-hidden="true" className="text-[23px]">🗓️</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-[var(--app-ink)]">
                이번 달 좋은 날을 달력으로 한눈에
              </span>
              <span className="block text-[13.2px] font-bold text-[var(--app-copy-soft)]">
                월간 좋은날 캘린더 · <Price priceKey="taste_monthly_calendar" />
              </span>
            </span>
            <span aria-hidden="true" className="text-[var(--app-pink-strong)]">→</span>
          </Link>
        </section>
      ) : (
        // 2026-05-18 Phase 5-E: "결과가 없습니다" 단순 문구 → EmptyState + 4 CTA.
        //   사용자 directive: 다시 선택 / 생년월일 확인 / 추천 날짜 / 유료 상세 풀이 + 명확 설명.
        <EmptyState
          title="현재 조건에 맞는 좋은 날을 찾지 못했습니다"
          description={`선택하신 목적(${TAEKIL_PURPOSES.find((p) => p.key === purpose)?.label ?? ''})과 사주 원국, 향후 60일 일진을 비교한 결과 추천 가능한 길일이 없습니다. 다른 목적을 선택하시거나 사주 정보를 확인해 주세요.`}
          icon="🗓️"
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  const next = TAEKIL_PURPOSES.find((p) => p.key !== purpose);
                  if (next) setPurpose(next.key);
                }}
                className="rounded-[10px] bg-[var(--app-pink-strong)] px-3 py-2 text-[14.4px] font-bold text-white"
              >
                다른 목적으로 다시 찾기
              </button>
              <Link
                href="/my/profile"
                className="rounded-[10px] border bg-white px-3 py-2 text-[14.4px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                생년월일 확인
              </Link>
              <Link
                href="/saju/new?focus=year"
                className="rounded-[10px] border bg-white px-3 py-2 text-[14.4px] font-bold text-[var(--app-copy)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                추천 날짜 생성
              </Link>
              <Link
                href="/membership"
                className="rounded-[10px] border bg-white px-3 py-2 text-[14.4px] font-bold text-[var(--app-pink-strong)]"
                style={{ borderColor: 'var(--app-pink-line)' }}
              >
                유료 상세 풀이
              </Link>
            </>
          }
        />
      )}

      {/* §안내 */}
      <article
        className="rounded-[16px] border bg-white p-4"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          💡 어떻게 산출되나요?
        </div>
        <ul
          className="mt-2 grid gap-1 text-[13.2px] leading-[1.65] text-[var(--app-copy)]"
          style={{ wordBreak: 'keep-all' }}
        >
          <li>① 사용자 사주 원국 + 다음 60일 각 날짜의 일진 ganzi 산출</li>
          <li>② 8영역 점수 (천간·지지·용신·신살·오행 균형·일주 강약·12운성·특수 조합)</li>
          <li>③ 목적별 가중 — 결혼/이사/개업/계약마다 다른 신살에 가산·감점</li>
          <li>④ 상위 7일 점수 순으로 정렬해 노출</li>
        </ul>
      </article>
    </section>
  );
}
