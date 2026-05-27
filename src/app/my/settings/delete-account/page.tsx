// Redesign 2026-05-13 (Claude Design / screens-g.jsx ScreenAccountDelete):
// 신규 /my/settings/delete-account — 3-step 회원탈퇴 흐름.
// 2026-05-14: /api/account/delete 연동 — 실제 탈퇴 완료 후 /login 으로 이동한다.
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 'done';

const REASONS: Array<{ key: string; label: string; description: string }> = [
  { key: 'not-use', label: '이제 사용하지 않아요', description: '관심이 사라졌어요' },
  { key: 'price', label: '가격이 부담돼요', description: '유료 결제 / 코인이 비싸요' },
  { key: 'accuracy', label: '풀이가 잘 안 맞아요', description: '결과의 신뢰도가 떨어져요' },
  { key: 'ui', label: '사용하기 어려워요', description: 'UI / UX 가 불편해요' },
  { key: 'duplicate', label: '다른 계정이 있어요', description: '중복 계정을 정리해요' },
  { key: 'privacy', label: '개인정보가 걱정돼요', description: '데이터 처리 방식이 우려돼요' },
  { key: 'other', label: '기타', description: '다른 이유가 있어요' },
];

const LOSS_ITEMS: Array<{ icon: string; label: string; description: string }> = [
  { icon: '✦', label: '보유 코인 전부', description: '환불 불가, 즉시 소멸' },
  { icon: '☰', label: '저장된 풀이', description: '복구 불가능' },
  { icon: '◐', label: '대화 상담 기록', description: '선생님과 나눈 대화 모두 삭제' },
  { icon: '♥', label: '멤버십 / 결제내역', description: '결제 기록은 5년 보관' },
];

export default function AccountDeletePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [reason, setReason] = useState<string>('not-use');
  const [otherReason, setOtherReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canProceedStep2 = Boolean(reason) && (reason !== 'other' || otherReason.trim().length > 0);
  const canSubmit = confirm === '탈퇴합니다';
  const currentStep = step === 'done' ? 3 : step;

  async function handleFinalSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          otherReason: reason === 'other' ? otherReason.trim() : undefined,
          confirm,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(
          data?.error || '요청 처리에 문제가 있었습니다. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      setStep('done');
      // 세션이 만료된 상태이므로 라우터를 새로고침해 보호 페이지 캐시를 비운다.
      router.refresh();
    } catch {
      setErrorMessage('네트워크 오류로 요청을 전송하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-32 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="회원탈퇴" backHref="/my/settings" />

        {step === 'done' ? (
          <section className="space-y-5 px-1">
            <article
              className="rounded-[18px] border p-6 text-center"
              style={{
                background: 'var(--app-pink-soft)',
                borderColor: 'var(--app-pink-line)',
              }}
            >
              <div
                className="mx-auto grid h-16 w-16 place-items-center rounded-full text-[28px] font-extrabold"
                style={{
                  background: '#fff',
                  color: 'var(--app-pink-strong)',
                  border: '1px solid var(--app-pink-line)',
                }}
              >
                ✓
              </div>
              <h1 className="mt-4 text-[20px] font-extrabold leading-snug text-[var(--app-ink)]">
                탈퇴가 완료되었습니다
              </h1>
              <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
                그동안 간지사주를 이용해주셔서 감사합니다.<br />
                결제 내역은 전자상거래법에 따라 5년간 안전하게 보관됩니다.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                로그인 화면으로
              </Link>
            </article>

            <Link
              href="/"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-[var(--app-line)] bg-white text-[13.5px] font-bold text-[var(--app-copy-muted)]"
            >
              ← 메인으로 돌아가기
            </Link>
          </section>
        ) : (
          <section className="space-y-5 px-1">
            {/* 3-bar progress (coral tone for danger) */}
            <div className="flex gap-1.5" role="list" aria-label="진행 단계">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-1 flex-1 rounded-full"
                  style={{
                    background: n <= currentStep ? 'var(--app-coral)' : 'var(--app-line)',
                  }}
                  aria-current={n === currentStep ? 'step' : undefined}
                />
              ))}
            </div>

            {step === 1 ? (
              <>
                <div>
                  <div
                    className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ color: 'var(--app-coral)' }}
                  >
                    STEP 1 / 3
                  </div>
                  <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-[var(--app-ink)]">
                    정말 떠나시나요?
                  </h1>
                  <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
                    탈퇴하시기 전에 잃게 되는 것들을 확인해주세요.
                  </p>
                </div>

                {/* Loss summary — ink-dark */}
                <article
                  className="rounded-[18px] p-5 text-white"
                  style={{
                    background: 'var(--app-ink)',
                    boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
                  }}
                >
                  <div
                    className="text-[11.5px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ color: 'var(--app-pink)' }}
                  >
                    탈퇴 시 사라지는 것들
                  </div>
                  <ul className="mt-3 grid gap-2.5">
                    {LOSS_ITEMS.map((item) => (
                      <li key={item.label} className="flex items-center gap-3">
                        <div
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[14px] font-extrabold"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.7)',
                          }}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-extrabold text-white">
                            {item.label}
                          </div>
                          <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {item.description}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>

                {/* Soft alternative */}
                <article
                  className="rounded-[14px] border p-4"
                  style={{
                    background: 'var(--app-pink-soft)',
                    borderColor: 'var(--app-pink-line)',
                  }}
                >
                  <div className="text-[12px] font-extrabold text-[var(--app-pink-strong)]">
                    잠시 쉬어가는 것은 어때요?
                  </div>
                  <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-copy)]">
                    <strong>알림 끄기</strong> 또는 <strong>일시 정지</strong>로 코인과 풀이를 그대로 유지할 수 있어요.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Link
                      href="/notifications"
                      className="rounded-full border border-[var(--app-pink-line)] bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-[var(--app-pink-strong)]"
                    >
                      알림 끄기
                    </Link>
                    <Link
                      href="/my"
                      className="rounded-full border border-[var(--app-pink-line)] bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-[var(--app-pink-strong)]"
                    >
                      3개월 일시정지
                    </Link>
                  </div>
                </article>
              </>
            ) : step === 2 ? (
              <>
                <div>
                  <div
                    className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ color: 'var(--app-coral)' }}
                  >
                    STEP 2 / 3
                  </div>
                  <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-[var(--app-ink)]">
                    떠나는 이유가 있을까요?
                  </h1>
                  <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
                    조금만 알려주시면 더 나은 서비스를 만들 수 있어요.
                  </p>
                </div>

                <div className="grid gap-2">
                  {REASONS.map((r) => {
                    const active = reason === r.key;
                    return (
                      <label
                        key={r.key}
                        className="block cursor-pointer"
                        htmlFor={`reason-${r.key}`}
                      >
                        <input
                          type="radio"
                          name="reason"
                          value={r.key}
                          id={`reason-${r.key}`}
                          checked={active}
                          onChange={() => setReason(r.key)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'flex items-center gap-3 rounded-[14px] border p-3.5 transition'
                          )}
                          style={
                            active
                              ? {
                                  background: 'var(--app-pink-soft)',
                                  border: '2px solid var(--app-pink)',
                                }
                              : {
                                  background: '#fff',
                                  border: '1px solid var(--app-line)',
                                }
                          }
                        >
                          <span
                            className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                            style={
                              active
                                ? { border: '6px solid var(--app-pink)', background: '#fff' }
                                : { border: '2px solid var(--app-line)', background: '#fff' }
                            }
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-extrabold text-[var(--app-ink)]">
                              {r.label}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                              {r.description}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}

                  {reason === 'other' ? (
                    <textarea
                      placeholder="자세한 의견을 알려주세요"
                      value={otherReason}
                      onChange={(event) => setOtherReason(event.target.value)}
                      className="min-h-[76px] w-full rounded-[12px] border border-[var(--app-line)] bg-white p-3 text-[13px] font-medium text-[var(--app-ink)] outline-none placeholder:text-[var(--app-copy-soft)] focus:border-[var(--app-pink)]"
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div>
                  <div
                    className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ color: 'var(--app-coral)' }}
                  >
                    STEP 3 / 3
                  </div>
                  <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-[var(--app-ink)]">
                    마지막 확인이에요
                  </h1>
                  <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
                    아래 문구를 정확히 입력해주시면 탈퇴 요청이 접수돼요.
                  </p>
                </div>

                <article
                  className="rounded-[14px] border p-4"
                  style={{
                    background: '#fef2f2',
                    borderColor: 'var(--app-coral)',
                  }}
                >
                  <div
                    className="text-[12px] font-extrabold uppercase tracking-[0.04em]"
                    style={{ color: 'var(--app-coral)' }}
                  >
                    ⚠ 주의사항
                  </div>
                  <ul className="mt-2.5 grid gap-1.5 pl-4 text-[12px] leading-[1.65] text-[var(--app-copy)]">
                    <li className="list-disc">탈퇴 후 30일 이내 재가입 시 데이터 복구 불가</li>
                    <li className="list-disc">코인 잔액은 환불되지 않습니다</li>
                    <li className="list-disc">결제 내역은 5년간 보관 (전자상거래법)</li>
                    <li className="list-disc">같은 이메일로 30일 후 재가입 가능</li>
                  </ul>
                </article>

                <div>
                  <label
                    htmlFor="delete-confirm"
                    className="block text-[12.5px] font-medium text-[var(--app-copy-muted)]"
                  >
                    &ldquo;
                    <span className="font-extrabold" style={{ color: 'var(--app-coral)' }}>
                      탈퇴합니다
                    </span>
                    &rdquo;를 입력해주세요
                  </label>
                  <input
                    id="delete-confirm"
                    type="text"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    placeholder="탈퇴합니다"
                    className="mt-1.5 h-12 w-full rounded-[12px] border bg-white px-3.5 text-[14.5px] font-semibold text-[var(--app-ink)] outline-none transition placeholder:text-[var(--app-copy-soft)]"
                    style={{
                      borderColor: canSubmit ? 'var(--app-coral)' : 'var(--app-line)',
                    }}
                  />
                  {canSubmit ? (
                    <p
                      className="mt-1.5 pl-1 text-[11.5px] font-extrabold"
                      style={{ color: 'var(--app-jade)' }}
                    >
                      ✓ 확인되었습니다
                    </p>
                  ) : null}
                </div>

                {errorMessage ? (
                  <p className="rounded-[12px] border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--app-ink)]">
                    {errorMessage}
                  </p>
                ) : null}
              </>
            )}

            {/* Sticky bottom CTA */}
            <div
              className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--app-line)] bg-white/95 px-4 py-3.5 backdrop-blur"
              style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto flex max-w-md gap-2">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(((step as number) - 1) as Step)}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white text-[13.5px] font-bold text-[var(--app-copy-muted)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    이전
                  </button>
                ) : (
                  <Link
                    href="/my/settings"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white text-[13.5px] font-bold text-[var(--app-copy-muted)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    돌아가기
                  </Link>
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 2 && !canProceedStep2) return;
                      setStep(((step as number) + 1) as Step);
                    }}
                    disabled={step === 2 && !canProceedStep2}
                    className="inline-flex h-12 flex-[2] items-center justify-center rounded-full px-5 text-[14px] font-extrabold text-white transition disabled:opacity-50"
                    style={{ background: 'var(--app-ink)' }}
                  >
                    계속 진행하기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={!canSubmit || isSubmitting}
                    className="inline-flex h-12 flex-[2] items-center justify-center rounded-full px-5 text-[14px] font-extrabold text-white shadow-[0_12px_28px_rgba(248,113,113,0.32)] transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: canSubmit ? 'var(--app-coral)' : 'var(--app-line)',
                    }}
                  >
                    {isSubmitting ? '요청 중...' : '영구 탈퇴하기'}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
      </AppPage>
    </AppShell>
  );
}
