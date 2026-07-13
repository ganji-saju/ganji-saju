'use client';

// 2026-07-13 — 사용방법 안내는 **수동 실행 전용**이다. 첫 방문/로그인 시 자동으로 뜨던 온보딩
//   모달은 불편하다는 피드백으로 제거했다(인증 감지 auto-open 삭제). 이제 안내는 오직
//   `/guide` 메뉴 페이지의 '처음부터 안내 보기'(openSystemGuide 이벤트)로만 열린다.
//   아래 navigationRef 로직은 그 수동 워크스루 도중 스텝 CTA 를 눌러 기능으로 이동했다가
//   브라우저 back 으로 돌아오면 보던 단계를 복원하는 용도(자동 최초 노출과 무관).
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SYSTEM_GUIDE_STEPS } from './system-guide-content';
import { SYSTEM_GUIDE_OPEN_EVENT } from './system-guide-events';
import { SystemGuideOnboarding } from './system-guide-onboarding';
import {
  createDefaultSystemGuideState,
  readSystemGuideStateResult,
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
