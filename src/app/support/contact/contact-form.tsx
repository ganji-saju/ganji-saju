// 2026-05-15 — 1:1 문의 클라이언트 폼.
// 최소 구현: 카테고리 / 제목 / 본문 / 이메일.
// 제출은 일단 mailto: 링크로 (이메일 클라이언트 열기). 후속 PR 에서 supabase support_tickets 테이블 + API.
'use client';

import { useState } from 'react';

type Category = 'payment' | 'subscription' | 'reading' | 'account' | 'other';

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'payment', label: '결제·코인' },
  { value: 'subscription', label: '구독·멤버십' },
  { value: 'reading', label: '풀이·해석' },
  { value: 'account', label: '계정·로그인' },
  { value: 'other', label: '기타' },
];

const SUPPORT_EMAIL = 'support@ganjisaju.kr';

export function ContactForm() {
  const [category, setCategory] = useState<Category>('payment');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success'>('idle');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !email.trim()) return;
    setSubmitState('submitting');

    const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label ?? '기타';
    const subject = encodeURIComponent(`[${categoryLabel}] ${title.trim()}`);
    const mailBody = encodeURIComponent(
      `${body.trim()}\n\n────────\n답신 이메일: ${email.trim()}\n카테고리: ${categoryLabel}\n작성 시각: ${new Date().toISOString()}`
    );

    // mailto: 링크로 메일 클라이언트 열기 — 임시 솔루션. 후속에서 API + DB 로 대체.
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${mailBody}`;
    window.location.href = mailto;
    setSubmitState('success');
  }

  if (submitState === 'success') {
    return (
      <section
        className="rounded-[18px] border bg-white p-5 text-center"
        style={{ borderColor: 'var(--app-line)' }}
      >
        <div className="text-[36px]">✉️</div>
        <h2 className="mt-2 text-[16px] font-extrabold text-[var(--app-ink)]">
          메일 클라이언트가 열렸습니다
        </h2>
        <p className="mt-2 text-[12.5px] leading-[1.65] text-[var(--app-copy-muted)]" style={{ wordBreak: 'keep-all' }}>
          기본 메일 앱에서 발송을 완료해 주세요. 메일 앱이 열리지 않으면 직접 <a href={`mailto:${SUPPORT_EMAIL}`} className="font-extrabold text-[var(--app-pink-strong)] underline">{SUPPORT_EMAIL}</a> 로 보내주세요.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitState('idle');
            setTitle('');
            setBody('');
          }}
          className="mt-4 inline-flex items-center justify-center rounded-full border px-5 py-2 text-[12.5px] font-extrabold text-[var(--app-copy-muted)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          새 문의 작성
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-[18px] border bg-white p-5"
      style={{ borderColor: 'var(--app-line)' }}
    >
      {/* 카테고리 */}
      <label className="grid gap-1.5">
        <span className="text-[12px] font-extrabold text-[var(--app-ink)]">카테고리</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const isActive = c.value === category;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-transform active:scale-95"
                style={{
                  background: isActive ? 'var(--app-pink)' : 'white',
                  color: isActive ? 'white' : 'var(--app-copy-muted)',
                  borderColor: isActive ? 'var(--app-pink)' : 'var(--app-line)',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </label>

      {/* 제목 */}
      <label className="grid gap-1.5">
        <span className="text-[12px] font-extrabold text-[var(--app-ink)]">제목</span>
        <input
          type="text"
          required
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 결제 후 코인이 충전되지 않습니다"
          className="rounded-[10px] border bg-white px-3 py-2.5 text-[13px] text-[var(--app-ink)] outline-none focus:border-[var(--app-pink-strong)]"
          style={{ borderColor: 'var(--app-line)' }}
        />
        <span className="text-[10.5px] text-[var(--app-copy-soft)]">{title.length}/60</span>
      </label>

      {/* 본문 */}
      <label className="grid gap-1.5">
        <span className="text-[12px] font-extrabold text-[var(--app-ink)]">내용</span>
        <textarea
          required
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="언제 / 어떤 상황에서 / 무슨 문제가 발생했는지 자세히 적어주세요. 결제 영수증 번호, 스크린샷 등을 함께 보내주시면 더 빠르게 도와드릴 수 있습니다."
          className="rounded-[10px] border bg-white px-3 py-2.5 text-[13px] leading-[1.65] text-[var(--app-ink)] outline-none focus:border-[var(--app-pink-strong)]"
          style={{ borderColor: 'var(--app-line)', wordBreak: 'keep-all' }}
        />
        <span className="text-[10.5px] text-[var(--app-copy-soft)]">{body.length}/1000</span>
      </label>

      {/* 이메일 */}
      <label className="grid gap-1.5">
        <span className="text-[12px] font-extrabold text-[var(--app-ink)]">답신 이메일</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="answer@example.com"
          className="rounded-[10px] border bg-white px-3 py-2.5 text-[13px] text-[var(--app-ink)] outline-none focus:border-[var(--app-pink-strong)]"
          style={{ borderColor: 'var(--app-line)' }}
        />
        <span className="text-[10.5px] text-[var(--app-copy-soft)]">
          답변 받으실 이메일 주소를 정확히 입력해 주세요.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitState === 'submitting' || !title.trim() || !body.trim() || !email.trim()}
        className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13.5px] font-extrabold text-white disabled:opacity-60"
      >
        {submitState === 'submitting' ? '여는 중…' : '문의 보내기 →'}
      </button>

      <p className="text-[10.5px] leading-[1.55] text-[var(--app-copy-soft)]" style={{ wordBreak: 'keep-all' }}>
        * 보내기 버튼을 누르면 기본 메일 앱이 열립니다. 메일이 열리지 않으면 직접 <strong className="text-[var(--app-copy-muted)]">{SUPPORT_EMAIL}</strong> 로 보내주세요.
      </p>
    </form>
  );
}
