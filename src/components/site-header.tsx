'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { Button, buttonVariants } from '@/components/ui/button';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { MOBILE_QUICK_LINKS, PRIMARY_NAV_ITEMS } from '@/lib/site-navigation';

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase
          .from('user_credits')
          .select('balance, subscription_balance')
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: c }) => {
            if (c) setCredits((c.balance ?? 0) + (c.subscription_balance ?? 0));
          });
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncHash = () => {
      setCurrentHash(window.location.hash);
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);

    return () => {
      window.removeEventListener('hashchange', syncHash);
    };
  }, [pathname]);

  async function signOut() {
    if (!hasSupabaseBrowserEnv) {
      router.push('/');
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const authHref = `/login?next=${encodeURIComponent(pathname)}`;

  function isActiveHref(href: string) {
    if (href.startsWith('/#')) {
      const targetHash = href.slice(1);
      return pathname === '/' && currentHash === targetHash;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--app-line)] bg-white/92 backdrop-blur supports-[backdrop-filter]:bg-white/86">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/"
              className="min-w-0 text-[var(--app-ink)] transition-opacity hover:opacity-90"
            >
              <div className="text-xs font-semibold text-[var(--app-pink-strong)]">
                오늘 바로 보는 운세
              </div>
              <div className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                달빛인생
              </div>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const href = item.href as string;
                const active = isActiveHref(href);
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={cn(
                      'rounded-full px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-white/10 text-[#f7ecd5]'
                        : 'text-white/55 hover:bg-white/6 hover:text-white'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <Link
                href="/my"
                className="hidden rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/8 hover:text-white md:inline-flex"
              >
                MY
              </Link>
            )}
            <Link
              href="/credits"
              className="hidden rounded-full border border-[#d2b072]/25 bg-[#d2b072]/10 px-3 py-1.5 text-sm font-medium text-[#f4dfaa] transition-colors hover:bg-[#d2b072]/15 hover:text-[#fff4d6] sm:inline-flex"
            >
              {user ? `✦ ${credits ?? '…'} 코인` : '코인 센터'}
            </Link>
            <Link
              href="/membership"
              className="hidden rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/8 hover:text-white md:inline-flex"
            >
              멤버십
            </Link>

            {user ? (
              <>
                <Link
                  href="/my"
                  className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/8 hover:text-white md:hidden"
                >
                  MY
                </Link>
                <Link
                  href="/credits"
                  className="rounded-full border border-[#d2b072]/25 bg-[#d2b072]/10 px-3 py-1.5 text-sm font-medium text-[#f4dfaa] transition-colors hover:bg-[#d2b072]/15 hover:text-[#fff4d6] sm:hidden"
                >
                  ✦ {credits ?? '…'}
                </Link>
                <Button
                  onClick={signOut}
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Link
                href={authHref}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'border-white/15 bg-white/10 text-white shadow-sm shadow-black/10 hover:bg-white/15 hover:text-white'
                )}
              >
                로그인
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 lg:hidden">
          {MOBILE_QUICK_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
