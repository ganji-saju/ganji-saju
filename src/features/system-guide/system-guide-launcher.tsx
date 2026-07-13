'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';
import { SYSTEM_GUIDE_OPEN_EVENT } from './system-guide-events';
import { SystemGuideOnboarding } from './system-guide-onboarding';
import {
  readSystemGuideState,
  shouldAutoOpenSystemGuide,
  writeSystemGuideState,
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

  useEffect(() => {
    const handleManualOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ stepIndex?: unknown }>).detail;
      setStepIndex(validManualStep(detail?.stepIndex));
      setLaunchKey((current) => current + 1);
      setOpen(true);
    };
    window.addEventListener(SYSTEM_GUIDE_OPEN_EVENT, handleManualOpen);
    return () => window.removeEventListener(SYSTEM_GUIDE_OPEN_EVENT, handleManualOpen);
  }, []);

  useEffect(() => {
    if (!hasSupabaseBrowserEnv) return;

    let cancelled = false;
    const supabase = createClient();

    function maybeAutoOpen(authenticated: boolean) {
      if (cancelled || autoOpenedRef.current || isAuthPath(pathname)) return;
      const storedState = readSystemGuideState(window.localStorage);
      if (!shouldAutoOpenSystemGuide(authenticated, storedState)) return;
      autoOpenedRef.current = true;
      setStepIndex(storedState.stepIndex);
      setLaunchKey((current) => current + 1);
      setOpen(true);
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      maybeAutoOpen(Boolean(user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      maybeAutoOpen(Boolean(session?.user));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname]);

  function persist(status: 'in_progress' | 'dismissed' | 'completed', nextStepIndex: number) {
    writeSystemGuideState(window.localStorage, {
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
        setOpen(false);
      }}
      onComplete={() => {
        persist('completed', SYSTEM_GUIDE_STEPS.length - 1);
        setOpen(false);
      }}
    />
  );
}
