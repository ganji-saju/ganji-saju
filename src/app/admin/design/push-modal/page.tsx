// 2026-05-14: handoff 보드 `push-modal` (27 · 푸시 알림 권한 모달) showcase.
// 운영 노출 X (robots disallow /admin).
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { PushModalShowcaseClient } from './showcase-client';

export const metadata: Metadata = {
  title: '푸시 알림 권한 모달 · QA',
  description: '간지사주 리디자인 푸시 알림 권한 모달 showcase.',
  robots: { index: false, follow: false },
};

export default function PushModalShowcasePage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-4">
        <GangiPageHeader title="푸시 알림 모달 · QA" backHref="/admin/design/banners" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            design QA · 운영 노출 X
          </div>
          <h1
            className="mt-1.5 text-[20px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            <code className="text-[18px]">PushPermissionModal</code>
          </h1>
          <p className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]">
            가치 제안 → 알림 권한 요청 → subscribe API 호출 흐름을 단일 모달로 캡슐화한
            컴포넌트. 가입 7일차 자동 노출 등 caller 가 트리거 시점을 결정.
          </p>
        </article>

        <PushModalShowcaseClient />

        <article
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
            source of truth
          </div>
          <ul className="mt-2 grid gap-1 text-[11.5px] leading-[1.55] text-[var(--app-copy)]">
            <li>
              · component: <code>src/components/notifications/push-permission-modal.tsx</code>
            </li>
            <li>
              · spec: <code>docs/design/ganji-redesign/source/02_BOARD_MANIFEST.md</code> (board
              `push-modal`)
            </li>
            <li>
              · 푸시 SW: <code>public/push-sw.js</code> · subscribe API:{' '}
              <code>src/app/api/notifications/subscribe/route.ts</code>
            </li>
          </ul>
        </article>

        <article
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
            usage
          </div>
          <pre
            className="mt-2 overflow-x-auto rounded-[10px] p-3 text-[11px] leading-[1.55]"
            style={{ background: '#0f0f12', color: '#e6e6ea' }}
          >
            {`'use client';
import { useState } from 'react';
import { PushPermissionModal } from '@/components/notifications/push-permission-modal';

export function MyPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>알림 켜기</button>
      <PushPermissionModal
        open={open}
        onClose={() => setOpen(false)}
        onSubscribed={() => track('push.subscribed')}
        onDenied={(reason) => track('push.denied', { reason })}
        webPushPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY}
      />
    </>
  );
}`}
          </pre>
        </article>
      </AppPage>
    </AppShell>
  );
}
