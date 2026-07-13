'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';
import { SYSTEM_GUIDE_OPEN_EVENT } from './system-guide-events';
import { SystemGuideOnboarding } from './system-guide-onboarding';
import {
  createDefaultSystemGuideState,
  readSystemGuideStateResult,
  shouldAutoOpenSystemGuide,
  tryWriteSystemGuideState,
  type SystemGuideState,
} from './system-guide-state';

const AUTO_EXCLUDED_PATHS = [
  '/login',
  '/signup',
  '/auth',
  '/pay',
  '/membership/checkout',
  '/membership/complete',
  '/membership/success',
  '/credits/success',
  '/credits/fail',
  '/legal',
  '/privacy',
  '/terms',
  '/commerce-disclosure',
  '/coin-policy',
  '/digital-content-policy',
  '/ai-disclaimer',
  '/subscription-policy',
  '/refund-policy',
  '/appointment-policy',
  '/admin',
] as const;

export function isSystemGuideAutoExcludedPath(pathname: string): boolean {
  return AUTO_EXCLUDED_PATHS.some(
    (excludedPath) => pathname === excludedPath || pathname.startsWith(`${excludedPath}/`),
  );
}

function normalizeSystemGuidePathname(pathOrHref: string): string {
  const pathname = new URL(pathOrHref, 'https://ganjisaju.kr').pathname;
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
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
  const inMemoryStateRef = useRef<SystemGuideState>(createDefaultSystemGuideState());
  const memoryStateAuthoritativeRef = useRef(false);
  const openSourceRef = useRef<'auto' | 'manual' | null>(null);
  const navigationRef = useRef<{
    originPathname: string;
    destinationHref: string;
    reachedDestination: boolean;
  } | null>(null);

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
    const currentPathname = normalizeSystemGuidePathname(pathname);
    const navigation = navigationRef.current;
    if (navigation) {
      if (
        currentPathname !== navigation.originPathname &&
        (currentPathname !== navigation.destinationHref ||
          isSystemGuideAutoExcludedPath(currentPathname))
      ) {
        navigationRef.current = null;
      } else if (currentPathname === navigation.destinationHref) {
        navigation.reachedDestination = true;
        setOpen(false);
        return;
      }
      if (navigation.reachedDestination && currentPathname === navigation.originPathname) {
        const readResult = readSystemGuideStateResult(window.localStorage);
        navigationRef.current = null;
        const resumeState = memoryStateAuthoritativeRef.current || !readResult.available
          ? inMemoryStateRef.current
          : readResult.state;
        if (resumeState.status === 'in_progress') {
          autoOpenedRef.current = true;
          openSourceRef.current = 'auto';
          setStepIndex(resumeState.stepIndex);
          setLaunchKey((current) => current + 1);
          setOpen(true);
        }
        return;
      }
    }

    if (isSystemGuideAutoExcludedPath(pathname) && openSourceRef.current === 'auto') {
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
      if (
        cancelled ||
        autoOpenedRef.current ||
        navigationRef.current ||
        isSystemGuideAutoExcludedPath(pathname)
      ) return;
      const readResult = readSystemGuideStateResult(window.localStorage);
      const initialState = readResult.available ? readResult.state : createDefaultSystemGuideState();
      if (!shouldAutoOpenSystemGuide(authenticated, initialState)) return;
      inMemoryStateRef.current = initialState;
      memoryStateAuthoritativeRef.current = !tryWriteSystemGuideState(
        window.localStorage,
        initialState,
      );
      autoOpenedRef.current = true;
      openSourceRef.current = 'auto';
      setStepIndex(initialState.stepIndex);
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
    const nextState: SystemGuideState = {
      version: 1,
      status,
      stepIndex: nextStepIndex,
    };
    inMemoryStateRef.current = nextState;
    memoryStateAuthoritativeRef.current = !tryWriteSystemGuideState(window.localStorage, nextState);
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
      onNavigate={(currentStepIndex, href) => {
        persist('in_progress', currentStepIndex);
        const originPathname = normalizeSystemGuidePathname(pathname);
        const destinationHref = normalizeSystemGuidePathname(href);
        navigationRef.current = originPathname === destinationHref
          ? null
          : { originPathname, destinationHref, reachedDestination: false };
        openSourceRef.current = null;
        setOpen(false);
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
