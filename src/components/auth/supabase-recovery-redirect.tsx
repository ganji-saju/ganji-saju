'use client';

import { useEffect } from 'react';

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function getSearchParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function buildResetPasswordUrl({
  search,
  hash,
}: {
  search: URLSearchParams;
  hash: string;
}) {
  const next = search.get('next');
  const code = search.get('code');
  const params = new URLSearchParams();

  if (code) params.set('code', code);
  if (next && next.startsWith('/') && !next.startsWith('//')) params.set('next', next);

  const query = params.toString();
  return `/reset-password${query ? `?${query}` : ''}${hash}`;
}

export default function SupabaseRecoveryRedirect() {
  useEffect(() => {
    const { pathname, hash } = window.location;
    if (pathname === '/reset-password') return;

    const search = getSearchParams();
    const hashParams = getHashParams();
    const hasRecoveryHash =
      hashParams.get('type') === 'recovery' &&
      Boolean(hashParams.get('access_token')) &&
      Boolean(hashParams.get('refresh_token'));
    const hasRecoveryCode =
      search.get('type') === 'recovery' && Boolean(search.get('code'));
    const hasRootCode = pathname === '/' && Boolean(search.get('code'));
    const isLoginResetMode =
      pathname === '/login' && search.get('mode') === 'reset-password';

    if (!hasRecoveryHash && !hasRecoveryCode && !hasRootCode && !isLoginResetMode) {
      return;
    }

    window.location.replace(
      buildResetPasswordUrl({
        search,
        hash: hasRecoveryHash ? hash : '',
      })
    );
  }, []);

  return null;
}
