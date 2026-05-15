// 2026-05-15 — 고객센터 1:1 문의 페이지 신규 (페이지 형태 + 클라이언트 폼).
// 최소 구현: 카테고리 select + 제목/본문 + 첨부 안내 + 이메일 발송 안내.
// 후속 PR 에서 supabase support_tickets 테이블 + 관리자 응답 페이지 추가 가능.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: '1:1 문의',
  description: '간지사주 1:1 문의 — 결제·구독·풀이·계정 관련 질문을 직접 보내주세요.',
  alternates: { canonical: '/support/contact' },
};

export default function ContactPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="1:1 문의" backHref="/my/settings" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            💬 1:1 문의
          </div>
          <h1
            className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            궁금한 점을
            <br />
            직접 보내주세요
          </h1>
          <p
            className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            평일 9~18시 사이 24시간 이내 답변 드립니다. 결제 영수증·스크린샷이 있으면 함께 보내주세요.
          </p>
        </article>

        {/* 클라이언트 폼 */}
        <ContactForm />

        {/* 자주 묻는 질문 안내 */}
        <article
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            보내기 전에
          </div>
          <p
            className="mt-1 text-[12.5px] leading-[1.6] text-[var(--app-copy)]"
            style={{ wordBreak: 'keep-all' }}
          >
            결제·구독·환불 등 자주 묻는 질문은 <a href="/support/faq" className="font-extrabold text-[var(--app-pink-strong)] underline underline-offset-2">FAQ</a> 에 정리되어 있습니다. FAQ 에서 못 찾은 질문만 여기로 보내주세요.
          </p>
        </article>
      </AppPage>
    </AppShell>
  );
}
