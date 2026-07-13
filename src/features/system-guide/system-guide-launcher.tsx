'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';
import { SYSTEM_GUIDE_OPEN_EVENT } from './system-guide-events';
import { SystemGuideOnboarding } from './system-guide-onboarding';
import {
  readSystemGuideStateResult,
  shouldAutoOpenSystemGuide,
  tryWriteSystemGuideState,
} from './system-guide-state';

function isAuthPath(pathname: string) {
  return pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/');
}

function validManualStep(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < SYSTEM_GUIDE_STEPS.length
    ? value
    : 0;
}

export function SystemGuideLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [launchKey, setLaunchKey] = useState(0);
  const autoOpenedRef = useRef(false);
  const openSourceRef = useRef<'auto' | 'manual' | null>(null);

  useEffect(() => {
    const handleManualOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ stepIndex?: unknown }>).detail;
      setStepIndex(validManualStep(detail?.stepIndex));
      setLaunchKey((current) => current + 1);
      openSourceRef.current = 'manual';
      setOpen(true);
    };
    window.addEventListener(SYSTEM_GUIDE_OPEN_EVENT, handleManualOpen);
    return () => window.removeEventListener(SYSTEM_GUIDE_OPEN_EVENT, handleManualOpen);
  }, []);

  useEffect(() => {
    if (isAuthPath(pathname) && openSourceRef.current === 'auto') {
      openSourceRef.current = null;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) return;

    let cancelled = false;
    let authGeneration = 0;
    const supabase = createClient();

    function maybeAutoOpen(authenticated: boolean) {
      if (cancelled || autoOpenedRef.current || isAuthPath(pathname)) return;
      const readResult = readSystemGuideStateResult(window.localStorage);
      if (!readResult.available || !shouldAutoOpenSystemGuide(authenticated, readResult.state)) return;
      if (!tryWriteSystemGuideState(window.localStorage, readResult.state)) return;
      autoOpenedRef.current = true;
      openSourceRef.current = 'auto';
      setStepIndex(readResult.state.stepIndex);
      setLaunchKey((current) => current + 1);
      setOpen(true);
    }

    const getUserGeneration = authGeneration;
    void supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (getUserGeneration !== authGeneration) return;
        maybeAutoOpen(Boolean(user));
      })
      .catch(() => {
        // Network/auth failures leave the optional guide closed.
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      authGeneration += 1;
      maybeAutoOpen(Boolean(session?.user));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname]);

  function persist(status: 'in_progress' | 'dismissed' | 'completed', nextStepIndex: number) {
    tryWriteSystemGuideState(window.localStorage, {
      version: 1,
      status,
      stepIndex: nextStepIndex,
    });
  }

  return (
    <SystemGuideOnboarding
      key={launchKey}
      open={open}
      initialStepIndex={stepIndex}
      onStepChange={(nextStepIndex) => {
        setStepIndex(nextStepIndex);
        persist('in_progress', nextStepIndex);
      }}
      onDismiss={(currentStepIndex) => {
        persist('dismissed', currentStepIndex);
        openSourceRef.current = null;
        setOpen(false);
      }}
      onComplete={() => {
        persist('completed', SYSTEM_GUIDE_STEPS.length - 1);
        openSourceRef.current = null;
        setOpen(false);
      }}
    />
  );
}
