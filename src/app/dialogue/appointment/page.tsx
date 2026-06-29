// Redesign 2026-05-13 (Claude Design / screens-f.jsx ScreenAppointment):
// 신규 /dialogue/appointment — 1:1 상담 예약. 선생님 + 주제 + 달력 + 시간 + 메모 + 확정 CTA.
// 2026-05-14: /api/appointments 연동 — 실제로 DB 에 예약을 저장한다.
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
// 2026-05-15 PR-K: 예약 결과 transient feedback 을 sonner 토스트로 마이그레이션.
import { toast } from 'sonner';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { StickyBottomBar } from '@/components/ui/sticky-bottom-bar';
import { cn } from '@/lib/utils';
import { PAYMENT_PACKAGES, type PaymentPackage } from '@/lib/payments/catalog';
import { createClient, getCurrentBrowserUser, hasSupabaseBrowserEnv } from '@/lib/supabase/client';

interface TeacherInfo {
  name: string;
  field: string;
  zodiac: ZodiacKey;
  online: boolean;
}

// 2026-05-16 PR #163 — 구 브랜드 임의 호명 정리.
// 2026-06-28 — 대화 선생 명칭 통일(서비스명+선생)에 맞춰 '명리호선생' → '명리선생'(호랑이, 종합 명리/active TOP).
const DEFAULT_TEACHER: TeacherInfo = {
  name: '명리선생',
  field: '종합 명리',
  zodiac: 'tiger',
  online: true,
};

const APPOINTMENT_COST_COINS = 100;
const APPOINTMENT_MINUTES = 30;
// 2026-06-23 — 코인팩 재편(credit_15: 9,900원=15코인). 코인 실효단가 = 9,900/15 = 660원.
const COIN_PACK_15 = PAYMENT_PACKAGES.find((pkg) => pkg.id === 'credit_15');
const SINGLE_COIN_PRICE_KRW = COIN_PACK_15 ? Math.round(COIN_PACK_15.price / COIN_PACK_15.credits) : 660;
const CREDIT_PACKAGES = PAYMENT_PACKAGES.filter((pkg) =>
  ['credit_15', 'credit_40', 'credit_100'].includes(pkg.id)
);

const TOPICS: Array<{ key: string; label: string }> = [
  { key: 'love', label: '연애·관계' },
  { key: 'career', label: '직장·이직' },
  { key: 'money', label: '재물·사업' },
  { key: 'family', label: '가족' },
  { key: 'life', label: '전체 흐름' },
];

const TIME_SLOTS: Array<{ time: string; available: boolean }> = [
  { time: '10:00', available: true },
  { time: '10:30', available: false },
  { time: '11:00', available: true },
  { time: '13:00', available: true },
  { time: '14:00', available: true },
  { time: '14:30', available: true },
  { time: '15:00', available: false },
  { time: '16:00', available: true },
  { time: '19:00', available: true },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function formatWon(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function getRecommendedTopUp(shortage: number): string {
  if (shortage <= 0) return '추가 충전 없이 예약 가능';
  const singlePackage = CREDIT_PACKAGES.find((pkg) => pkg.credits >= shortage);
  if (singlePackage) {
    return `${singlePackage.name} ${singlePackage.credits}코인 · ${formatWon(singlePackage.price)}`;
  }
  return '코인 센터에서 필요한 만큼 충전';
}

interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isFull: boolean;
}

function buildCalendar(year: number, month: number, todayYmd: string): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();

  const cells: CalendarCell[] = [];

  // 이전 달 채우기
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
      isToday: false,
      isPast: true,
      isFull: false,
    });
  }

  // 이번 달
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      isCurrentMonth: true,
      isToday: ymd === todayYmd,
      isPast: ymd < todayYmd,
      // 임시로 매 7번째 날 마감 처리 (예시)
      isFull: d % 7 === 0,
    });
  }

  // 다음 달 채우기 (총 35칸 또는 42칸으로 정렬)
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      day: i,
      isCurrentMonth: false,
      isToday: false,
      isPast: false,
      isFull: false,
    });
  }

  return cells;
}

export default function AppointmentPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('14:30');
  const [topic, setTopic] = useState('love');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);

  const todayYmd = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const calendarCells = useMemo(
    () => buildCalendar(year, month, todayYmd),
    [year, month, todayYmd]
  );
  const creditShortage =
    availableCredits === null
      ? APPOINTMENT_COST_COINS
      : Math.max(0, APPOINTMENT_COST_COINS - availableCredits);
  const recommendedTopUp = getRecommendedTopUp(creditShortage);
  const appointmentKrwEquivalent = APPOINTMENT_COST_COINS * SINGLE_COIN_PRICE_KRW;

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) {
      setIsLoggedIn(false);
      setAvailableCredits(null);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const user = await getCurrentBrowserUser(supabase);
      if (cancelled) return;
      setIsLoggedIn(Boolean(user));
      if (!user) {
        setAvailableCredits(null);
        return;
      }

      const { data } = await supabase
        .from('user_credits')
        .select('balance, subscription_balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setAvailableCredits((data?.balance ?? 0) + (data?.subscription_balance ?? 0));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function goPrevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  }

  function goNextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  }

  const canSubmit = selectedDay !== null && selectedTime !== '';

  async function handleSubmit() {
    if (!canSubmit || selectedDay === null) return;
    setSubmitting(true);

    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherKey: DEFAULT_TEACHER.zodiac,
          topic,
          date,
          time: selectedTime,
          note,
        }),
      });

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/dialogue/appointment')}`;
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        // 2026-05-15 PR-K: 자체 inline error 마크업 제거 — sonner 토스트로 통일.
        toast.error(data?.error || '예약을 처리하지 못했습니다.');
        return;
      }

      setConfirmed(true);
      toast.success('상담 예약이 접수됐어요.');
    } catch {
      toast.error('네트워크 오류로 예약을 보내지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-32 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="1:1 상담 예약" backHref="/dialogue" />

        {confirmed ? (
          <section className="space-y-5 px-1">
            <article
              className="rounded-[18px] border p-6 text-center"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div
                className="mx-auto grid h-16 w-16 place-items-center rounded-full text-[32.2px] font-extrabold"
                style={{
                  background: '#fff',
                  color: 'var(--app-pink-strong)',
                  border: '1px solid var(--app-pink-line)',
                }}
              >
                ✓
              </div>
              <h1 className="mt-4 text-[23px] font-extrabold leading-snug text-[var(--app-ink)]">
                예약 요청이 접수되었어요
              </h1>
              <p className="mt-2 text-[15px] leading-[1.6] text-[var(--app-copy-muted)]">
                {year}년 {month + 1}월 {selectedDay}일 · {selectedTime}
                <br />
                상담 시작 30분 전 알림으로 안내드립니다.
              </p>
            </article>

            <div className="grid gap-2">
              <Link
                href="/dialogue"
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.1px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                대화방으로 이동 →
              </Link>
              <Link
                href="/my"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[15px] font-bold text-[var(--app-copy-muted)]"
              >
                MY 홈으로
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-5 px-1">
            {/* §1 선생님 카드 */}
            <article
              className="flex items-center gap-3 rounded-[18px] border p-4"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div className="relative">
                <ZodiacChip kind={DEFAULT_TEACHER.zodiac} size="md" />
                {DEFAULT_TEACHER.online ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full"
                    style={{
                      background: 'var(--app-jade)',
                      border: '2px solid #fff',
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16.7px] font-extrabold text-[var(--app-ink)]">
                  {DEFAULT_TEACHER.name} · {DEFAULT_TEACHER.field}
                </div>
              </div>
              <Link
                href="/dialogue"
                className="text-[13.2px] font-extrabold text-[var(--app-pink-strong)]"
              >
                변경
              </Link>
            </article>

            <section className="grid gap-3">
              <article
                className="rounded-[16px] border bg-white p-4"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13.8px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                      상담 요금
                    </div>
                    <h2 className="mt-1 text-[19.5px] font-extrabold text-[var(--app-ink)]">
                      {APPOINTMENT_MINUTES}분 상담 · {APPOINTMENT_COST_COINS}코인
                    </h2>
                    <p className="mt-1 text-[13.8px] leading-[1.6] text-[var(--app-copy-muted)]">
                      1코인 {formatWon(SINGLE_COIN_PRICE_KRW)} 단가 환산 {formatWon(appointmentKrwEquivalent)} 상당입니다. 실제 결제 금액은 선택한 충전팩 단가에 따라 달라질 수 있습니다.
                    </p>
                  </div>
                  <Link
                    href={`/credits?from=appointment&needed=${APPOINTMENT_COST_COINS}`}
                    className="shrink-0 rounded-full bg-[var(--app-pink)] px-3 py-2 text-[13.2px] font-extrabold text-white"
                  >
                    코인 충전
                  </Link>
                </div>
                <div className="mt-3 grid gap-2 rounded-[12px] bg-[var(--app-pink-soft)] p-3 text-[13.8px] leading-[1.55] text-[var(--app-copy)]">
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--app-copy-muted)]">보유 코인</span>
                    <strong className="text-[var(--app-ink)]">
                      {isLoggedIn === false
                        ? '로그인 후 확인'
                        : availableCredits === null
                          ? '확인 중'
                          : `${availableCredits.toLocaleString('ko-KR')}코인`}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--app-copy-muted)]">부족 코인</span>
                    <strong className={creditShortage > 0 ? 'text-[var(--app-coral)]' : 'text-[var(--app-jade)]'}>
                      {creditShortage.toLocaleString('ko-KR')}코인
                    </strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--app-copy-muted)]">추천 충전팩</span>
                    <strong className="max-w-[58%] text-right text-[var(--app-ink)]">
                      {recommendedTopUp}
                    </strong>
                  </div>
                </div>
              </article>

              <article
                className="rounded-[16px] border bg-white p-4 text-[13.8px] leading-[1.65] text-[var(--app-copy-muted)]"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <h2 className="text-[16.1px] font-extrabold text-[var(--app-ink)]">예약 취소·환불 정책</h2>
                <ul className="mt-2 grid gap-1.5">
                  <li>상담 시작 24시간 전까지 취소하면 사용 코인을 전액 복구합니다.</li>
                  <li>상담 시작 24시간 이내 취소 또는 예약 시간 미참석은 배정 준비가 시작되어 코인 복구가 제한됩니다.</li>
                  <li>상담사가 불참하거나 운영 사정으로 진행되지 않으면 사용 코인을 전액 복구하고 고객센터에서 후속 일정을 안내합니다.</li>
                </ul>
              </article>
            </section>

            {/* §2 주제 */}
            <section>
              <label className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]">
                상담 주제
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TOPICS.map((t) => {
                  const active = topic === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTopic(t.key)}
                      className="rounded-full border px-3 py-1.5 text-[13.8px] font-bold transition"
                      style={
                        active
                          ? {
                              background: 'var(--app-pink)',
                              color: '#fff',
                              borderColor: 'var(--app-pink)',
                            }
                          : {
                              background: '#fff',
                              color: 'var(--app-copy-muted)',
                              borderColor: 'var(--app-line)',
                            }
                      }
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* §3 달력 */}
            <section>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="grid h-8 w-8 place-items-center rounded-full text-[20.7px] text-[var(--app-copy-muted)]"
                  aria-label="이전 달"
                >
                  ‹
                </button>
                <div className="text-[18.4px] font-extrabold tracking-tight text-[var(--app-ink)]">
                  {year}년 {month + 1}월
                </div>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="grid h-8 w-8 place-items-center rounded-full text-[20.7px] text-[var(--app-copy-muted)]"
                  aria-label="다음 달"
                >
                  ›
                </button>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className="py-1 text-[12.1px] font-extrabold"
                    style={{
                      color:
                        i === 0
                          ? 'var(--app-coral)'
                          : i === 6
                            ? 'var(--app-sky)'
                            : 'var(--app-copy-soft)',
                    }}
                  >
                    {label}
                  </div>
                ))}
                {calendarCells.map((cell, i) => {
                  const isSelected =
                    cell.isCurrentMonth && cell.day === selectedDay && !cell.isFull && !cell.isPast;
                  const isDisabled = !cell.isCurrentMonth || cell.isFull || cell.isPast;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (cell.isCurrentMonth && !cell.isFull && !cell.isPast) {
                          setSelectedDay(cell.day);
                        }
                      }}
                      className={cn(
                        'relative grid aspect-square place-items-center rounded-[12px] text-[15px] font-bold transition'
                      )}
                      style={
                        isSelected
                          ? { background: 'var(--app-pink)', color: '#fff' }
                          : isDisabled
                            ? {
                                color: 'var(--app-copy-soft)',
                                opacity: 0.35,
                                textDecoration: cell.isFull ? 'line-through' : undefined,
                              }
                            : cell.isToday
                              ? {
                                  color: 'var(--app-pink-strong)',
                                  fontWeight: 800,
                                }
                              : { color: 'var(--app-ink)' }
                      }
                    >
                      {cell.day}
                      {cell.isToday && !isSelected ? (
                        <span
                          className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                          style={{ background: 'var(--app-pink-strong)' }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-3 text-[12.1px] text-[var(--app-copy-soft)]">
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-[3px]"
                    style={{ background: 'var(--app-pink)' }}
                    aria-hidden="true"
                  />
                  선택
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-[3px]"
                    style={{ background: 'var(--app-line)' }}
                    aria-hidden="true"
                  />
                  마감
                </span>
                {selectedDay ? (
                  <span className="ml-auto font-extrabold text-[var(--app-pink-strong)]">
                    {year}.{String(month + 1).padStart(2, '0')}.{String(selectedDay).padStart(2, '0')} 선택됨
                  </span>
                ) : null}
              </div>
            </section>

            {/* §4 시간 슬롯 */}
            <section>
              <div className="flex items-baseline justify-between">
                <div className="text-[15px] font-extrabold text-[var(--app-ink)]">시간 선택</div>
                <span className="text-[12.6px] font-bold text-[var(--app-copy-soft)]">
                  · 30분 단위
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {TIME_SLOTS.map((slot) => {
                  const active = selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      className="rounded-[10px] py-2.5 text-[15px] font-bold transition"
                      style={
                        active
                          ? {
                              background: 'var(--app-pink)',
                              color: '#fff',
                              border: 0,
                            }
                          : {
                              background: '#fff',
                              color: slot.available
                                ? 'var(--app-ink)'
                                : 'var(--app-copy-soft)',
                              border: '1px solid var(--app-line)',
                              textDecoration: slot.available ? 'none' : 'line-through',
                              opacity: slot.available ? 1 : 0.5,
                            }
                      }
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* §5 메모 */}
            <section>
              <label
                htmlFor="appointment-note"
                className="block text-[14.4px] font-medium text-[var(--app-copy-muted)]"
              >
                미리 알려주실 게 있나요? (선택)
              </label>
              <textarea
                id="appointment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="상담 전에 알려주시면 더 정확히 풀어드려요"
                className="mt-1.5 min-h-[80px] w-full resize-none rounded-[12px] border border-[var(--app-line)] bg-white p-3 text-[15px] leading-[1.55] text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
              />
            </section>

            {/* 2026-05-15 PR-K: 자체 inline error 카드 제거 — 전역 sonner 토스트가 상단 표시 */}

            <div aria-hidden="true" className="app-fixed-bottom-cta-clearance" />

            {/* Sticky CTA — body portal 로 dock 위 고정(조상 transform 이 fixed 를 깨므로) */}
            <StickyBottomBar>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12.6px] text-[var(--app-copy-soft)]">
                  {APPOINTMENT_MINUTES}분 상담 · {APPOINTMENT_COST_COINS}코인 · {formatWon(appointmentKrwEquivalent)} 상당
                </span>
                <span className="text-[16.7px] font-extrabold text-[var(--app-pink-strong)]">
                  {selectedDay
                    ? `${month + 1}월 ${selectedDay}일 ${selectedTime}`
                    : '날짜를 선택하세요'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[16.7px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)] disabled:opacity-50"
              >
                {submitting ? '예약 중...' : '예약 확정 →'}
              </button>
            </StickyBottomBar>
          </section>
        )}
      </AppPage>
    </AppShell>
  );
}
