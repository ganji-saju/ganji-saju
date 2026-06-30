// 2026-05-16 PR #155 — PC 메가 메뉴 (sticky top horizontal nav).
// 첨부 desktop.jsx 의 mega-menu 디자인을 우리 토큰/라우트로 재구현.
// - 4 group: 운세 / 사주 / 대화 / 멤버십
// - 운세/사주/대화 호버 시 3컬럼 풀폭 패널
// - 멤버십은 simple 링크 (패널 없음)
// - 운세 기본 활성 (pathname 분기, resolveActiveGroup)
// - 오른쪽: 검색 ⌕, 코인 pill (로그인 시), 로그인/로그아웃
//
// lg(1024px) 이상에서만 표시. mobile 은 PR 2 (모바일 시트) 에서.
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { HeaderLogoutButton } from '@/features/account/header-logout-button';
import { MEGA_NAV, resolveActiveGroup, type MegaNavGroup, type MegaNavItem } from './mega-nav-data';
import { MY_MENU_BLUEPRINT } from '@/content/moonlight';
import './mega-nav.css';

interface SessionState {
  authenticated: boolean;
  credits: number | null;
}

function GroupChip({ active, label, hasPanel, isHover, onMouseEnter, href }: {
  active: boolean;
  label: string;
  hasPanel: boolean;
  isHover: boolean;
  onMouseEnter: () => void;
  href?: string;
}) {
  const content = (
    <span
      className="mega-nav-chip"
      data-active={active}
      data-hover={isHover}
      onMouseEnter={onMouseEnter}
    >
      {label}
      {hasPanel ? (
        <span className="mega-nav-caret" aria-hidden="true">
          ▾
        </span>
      ) : null}
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="mega-nav-chip-link">
        {content}
      </Link>
    );
  }
  return <button type="button" className="mega-nav-chip-link">{content}</button>;
}

function MegaPanelColumn1({ block }: { block: NonNullable<MegaNavGroup['c1']> }) {
  return (
    <div>
      <div className="mega-nav-eyebrow">{block.heading}</div>
      <div className="mega-nav-c1-grid">
        {block.items.map((it) => (
          <MegaNavItemLink key={it.label} item={it} />
        ))}
      </div>
    </div>
  );
}

function MegaNavItemLink({ item }: { item: MegaNavItem }) {
  return (
    <Link href={item.href} className="mega-nav-c1-card">
      {item.zodiac ? <ZodiacChip kind={item.zodiac} size="sm" /> : <span className="mega-nav-c1-icon" aria-hidden="true">✦</span>}
      <div className="mega-nav-c1-body">
        <div className="mega-nav-c1-row">
          <span className="mega-nav-c1-label">{item.label}</span>
          {item.tag ? (
            <span
              className="mega-nav-tag"
              data-strong={item.tag === 'FREE' || item.tag === 'VIP' || item.tag === 'TOP'}
            >
              {item.tag}
            </span>
          ) : null}
        </div>
        <div className="mega-nav-c1-desc">{item.desc}</div>
      </div>
    </Link>
  );
}

function MegaPanelColumn2({ block }: { block: NonNullable<MegaNavGroup['c2']> }) {
  return (
    <div>
      <div className="mega-nav-eyebrow">{block.heading}</div>
      <div className="mega-nav-c2-list">
        {block.items.map((it, idx) => (
          <Link
            key={it.label}
            href={it.href}
            className="mega-nav-c2-row"
            data-last={idx === block.items.length - 1}
          >
            <div className="mega-nav-c2-label">{it.label}</div>
            <div className="mega-nav-c2-desc">{it.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MegaPanelColumn3({ block }: { block: NonNullable<MegaNavGroup['c3']> }) {
  return (
    <div>
      <div className="mega-nav-eyebrow">FEATURED</div>
      <Link href={block.href} className="mega-nav-featured">
        <div className="mega-nav-featured-glyph" aria-hidden="true">運</div>
        <div className="mega-nav-featured-body">
          <div className="mega-nav-featured-title">{block.title}</div>
          <div className="mega-nav-featured-desc">{block.description}</div>
          <span className="mega-nav-featured-cta">{block.cta} →</span>
        </div>
      </Link>
    </div>
  );
}

export function MegaNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [session, setSession] = useState<SessionState>({
    authenticated: false,
    credits: null,
  });

  const activeLabel = resolveActiveGroup(pathname);

  // session — 로그인 여부 + 코인.
  // mega-nav 는 app-shell 에 영속 마운트되어 soft navigation/router.refresh() 로는
  // 리마운트되지 않는다. 로그아웃/로그인 후 헤더가 stale 해지지 않도록 SiteHeader 와
  // 동일하게 onAuthStateChange 를 구독해 세션 상태를 반응형으로 갱신한다.
  useEffect(() => {
    if (!hasSupabaseBrowserEnv) return;
    let cancelled = false;
    const supabase = createClient();

    async function syncSession(user: { id: string } | null) {
      if (cancelled) return;
      if (!user) {
        setSession({ authenticated: false, credits: null });
        return;
      }
      setSession({ authenticated: true, credits: null });
      // SiteHeader 와 동일한 user_credits 직접 조회 패턴.
      const { data: creditRow } = await supabase
        .from('user_credits')
        .select('balance, subscription_balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const total = (creditRow?.balance ?? 0) + (creditRow?.subscription_balance ?? 0);
      setSession({ authenticated: true, credits: total });
    }

    // 초기값: JWT 를 서버 검증하는 getUser 로 판정.
    supabase.auth.getUser().then(({ data: { user } }) => {
      void syncSession(user);
    });

    // 이후 로그인/로그아웃 등 세션 변경에 반응(영속 컴포넌트라 리마운트 없음).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return; // 초기값은 위 getUser 로 처리.
      void syncSession(nextSession?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const hoverGroup = hoverIdx !== null ? MEGA_NAV[hoverIdx] : null;
  const showPanel = hoverGroup && !hoverGroup.simple;

  return (
    <div
      className="mega-nav-root"
      onMouseLeave={() => setHoverIdx(null)}
    >
      <header className="mega-nav-header" data-panel-open={showPanel ? 'true' : 'false'}>
        {/* 2026-06-24 — 데스크톱(lg+) 메가내브 로고도 붓글씨 이미지로 통일(헤더 일관). */}
        <Link href="/" className="mega-nav-logo" aria-label="간지사주 홈">
          <picture>
            <source srcSet="/images/gangi/logo.avif" type="image/avif" />
            <source srcSet="/images/gangi/logo.webp" type="image/webp" />
            <img
              src="/images/gangi/logo.png"
              alt="간지사주 9,900원"
              className="w-auto"
              style={{ height: 30 }}
              decoding="async"
            />
          </picture>
        </Link>

        <nav className="mega-nav-list" aria-label="주 메뉴">
          {MEGA_NAV.map((group, idx) => {
            const isActive = group.label === activeLabel;
            const isHover = hoverIdx === idx;
            return (
              <GroupChip
                key={group.label}
                label={group.label}
                active={isActive}
                hasPanel={!group.simple}
                isHover={isHover}
                onMouseEnter={() => setHoverIdx(group.simple ? null : idx)}
                href={group.simple ? group.href : undefined}
              />
            );
          })}
        </nav>

        <div className="mega-nav-actions">
          <button
            type="button"
            className="mega-nav-icon-btn"
            onClick={() => router.push('/search')}
            aria-label="검색"
          >
            ⌕
          </button>
          {session.authenticated ? (
            <>
              <Link href="/credits" className="mega-nav-coin-pill">
                ✦ {session.credits ?? '···'} 코인
              </Link>
              {/* 2026-05-26 — 사용자 보고: PC 메가메뉴에 마이홈 롤오버 부재.
                  아바타 hover 시 MY 하위 메뉴 드롭다운 노출(/my 페이지와 동일한 blueprint 재사용). */}
              <div className="mega-nav-my">
                <Link href="/my" className="mega-nav-avatar-link" aria-label="내 정보">
                  👤
                </Link>
                <div className="mega-nav-my-menu" role="menu" aria-label="마이홈">
                  <div className="mega-nav-my-eyebrow">마이홈</div>
                  {MY_MENU_BLUEPRINT.map((it) => (
                    <Link key={it.title} href={it.href} className="mega-nav-my-item" role="menuitem">
                      <span className="mega-nav-my-item-label">{it.title}</span>
                      <span className="mega-nav-my-item-desc">{it.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
              {/* 2026-05-16 — 사용자 보고: 상단 헤더에 로그아웃 진입점 부재.
                  avatar 옆에 아이콘-only 로그아웃 버튼 추가. /my/settings 의
                  풀폭 카드와 중복되지만 빠른 진입을 위한 의도된 중복. */}
              <HeaderLogoutButton className="mega-nav-icon-btn" />
            </>
          ) : (
            <>
              {/* 2026-05-20 — 사용자 보고: PC 메가메뉴에 회원가입 진입점 부재.
                  로그인 옆에 회원가입 ghost 버튼 추가 (CTA pair 패턴). */}
              <Link href="/signup" className="mega-nav-signup">
                회원가입
              </Link>
              <Link href="/login" className="mega-nav-login">
                로그인
              </Link>
            </>
          )}
        </div>
      </header>

      {showPanel && hoverGroup ? (
        <div className="mega-nav-panel" onMouseEnter={() => setHoverIdx(hoverIdx)}>
          <div className="mega-nav-panel-grid">
            {hoverGroup.c1 ? <MegaPanelColumn1 block={hoverGroup.c1} /> : null}
            {hoverGroup.c2 ? <MegaPanelColumn2 block={hoverGroup.c2} /> : null}
            {hoverGroup.c3 ? <MegaPanelColumn3 block={hoverGroup.c3} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
