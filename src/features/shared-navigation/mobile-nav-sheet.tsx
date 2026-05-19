// 2026-05-16 PR #156 (PR #158 update) — 모바일 메뉴 시트.
// 변경: bottom sheet → top sheet + React Portal (body 직접 mount).
// 이유: 사용자 보고에서 시트가 footer 아래에 렌더링되는 현상.
//      부모 컨테이너의 transform/filter/contain 이 position:fixed 를 깨는 케이스.
//      Portal 로 body 에 직접 마운트하면 부모 영향 0.
//      또한 사용자가 "정가운데 또는 상단" 을 선호 → top sheet 채택 (햄버거 우상단에서 자연스럽게 펼침).
//
// 2026-05-20 — MY (로그인/로그아웃/회원가입) 섹션 추가.
//   사용자 보고: 모바일 햄버거 메뉴에 MY 진입점 부재.
//   비로그인: 로그인 + 회원가입 짝꿍 CTA / 로그인: MY 진입 + 로그아웃.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { MEGA_NAV, type MegaNavItem } from './mega-nav-data';
import './mobile-nav-sheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 페이지 진입 시 기본 활성 탭 (default '운세'). */
  initialActiveLabel?: string;
}

export function MobileNavSheet({ open, onClose, initialActiveLabel = '운세' }: Props) {
  const [activeLabel, setActiveLabel] = useState(initialActiveLabel);
  // PR #158 — Portal mount 가드. SSR/CSR hydration mismatch 방지.
  const [mounted, setMounted] = useState(false);
  // 2026-05-20 — MY 섹션 표시 분기 위한 auth 상태.
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (!hasSupabaseBrowserEnv) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose();
    // 부드러운 reset — 홈 이동은 클라이언트 라우터에 위임.
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  // Esc 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 시트 열림 시 body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const activeGroup = MEGA_NAV.find((g) => g.label === activeLabel) ?? MEGA_NAV[0]!;
  const items: MegaNavItem[] = [
    ...(activeGroup.c1?.items ?? []),
    ...(activeGroup.c2?.items ?? []),
  ];

  // PR #158 — createPortal 로 body 에 직접 mount. 부모 컨테이너의 transform/filter
  // 영향을 받지 않아 position:fixed 가 확실히 동작.
  return createPortal(
    <>
      <div
        className="mobile-nav-sheet-overlay"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />
      <div className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label="전체 메뉴">
        {/* PR #158 — top sheet 라 handle bar 제거. 닫기는 우측 × 버튼. */}

        {/* header */}
        <div className="mobile-nav-sheet-header">
          <span className="mobile-nav-sheet-title">메뉴</span>
          <button
            type="button"
            className="mobile-nav-sheet-close"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            ×
          </button>
        </div>

        {/* 검색 빠른 진입 */}
        <Link
          href="/search"
          className="mobile-nav-sheet-search"
          onClick={onClose}
        >
          <span className="mobile-nav-sheet-search-icon" aria-hidden="true">⌕</span>
          <span>검색…</span>
        </Link>

        {/* 4 group tabs */}
        <div className="mobile-nav-sheet-tabs" role="tablist" aria-label="메뉴 그룹">
          {MEGA_NAV.map((group) => {
            const isActive = group.label === activeLabel;
            // simple 그룹 (멤버십) 은 클릭 시 바로 이동.
            if (group.simple && group.href) {
              return (
                <Link
                  key={group.label}
                  href={group.href}
                  onClick={onClose}
                  className="mobile-nav-sheet-tab"
                  data-active="false"
                  role="tab"
                >
                  {group.label}
                </Link>
              );
            }
            return (
              <button
                key={group.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                className="mobile-nav-sheet-tab"
                data-active={isActive ? 'true' : 'false'}
                onClick={() => setActiveLabel(group.label)}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        {/* active group items */}
        <div className="mobile-nav-sheet-body">
          <div className="mobile-nav-sheet-list">
            {items.map((it) => (
              <Link
                key={it.label}
                href={it.href}
                onClick={onClose}
                className="mobile-nav-sheet-item"
              >
                {it.zodiac ? (
                  <ZodiacChip kind={it.zodiac} size="sm" />
                ) : (
                  <span className="mobile-nav-sheet-item-icon" aria-hidden="true">
                    ✦
                  </span>
                )}
                <div className="mobile-nav-sheet-item-body">
                  <div className="mobile-nav-sheet-item-head">
                    <span className="mobile-nav-sheet-item-label">{it.label}</span>
                    {it.tag ? (
                      <span
                        className="mobile-nav-sheet-tag"
                        data-strong={
                          it.tag === 'FREE' || it.tag === 'VIP' || it.tag === 'TOP'
                        }
                      >
                        {it.tag}
                      </span>
                    ) : null}
                  </div>
                  <div className="mobile-nav-sheet-item-desc">{it.desc}</div>
                </div>
                <span className="mobile-nav-sheet-item-chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>

          {/* featured */}
          {activeGroup.c3 ? (
            <Link
              href={activeGroup.c3.href}
              onClick={onClose}
              className="mobile-nav-sheet-featured"
            >
              <span className="mobile-nav-sheet-featured-glyph" aria-hidden="true">運</span>
              <div className="mobile-nav-sheet-featured-body">
                <div className="mobile-nav-sheet-featured-title">{activeGroup.c3.title}</div>
                <div className="mobile-nav-sheet-featured-desc">
                  {activeGroup.c3.description}
                </div>
                <span className="mobile-nav-sheet-featured-cta">
                  {activeGroup.c3.cta} →
                </span>
              </div>
            </Link>
          ) : null}

          {/* 2026-05-20 — MY 섹션 (계정 진입점).
              비로그인: 로그인 + 회원가입 짝꿍 CTA / 로그인: MY 진입 + 로그아웃. */}
          <div className="mobile-nav-sheet-account" aria-label="계정">
            <div className="mobile-nav-sheet-account-eyebrow">MY</div>
            {user ? (
              <div className="mobile-nav-sheet-account-row">
                <Link
                  href="/my"
                  onClick={onClose}
                  className="mobile-nav-sheet-account-primary"
                >
                  내 정보
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mobile-nav-sheet-account-ghost"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="mobile-nav-sheet-account-row">
                <Link
                  href="/login"
                  onClick={onClose}
                  className="mobile-nav-sheet-account-primary"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={onClose}
                  className="mobile-nav-sheet-account-ghost"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
