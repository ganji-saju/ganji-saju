'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_MOONLIGHT_COUNSELOR,
  getMoonlightCounselorMeta,
  MOONLIGHT_COUNSELOR_CHANGE_EVENT,
  MOONLIGHT_COUNSELOR_STORAGE_KEY,
  normalizeMoonlightCounselor,
  type MoonlightCounselorId,
} from '@/lib/counselors';

type PersistState = 'idle' | 'saved' | 'local_only';

interface ProfileCounselorPayload {
  authenticated?: boolean;
  profile?: {
    preferredCounselor?: MoonlightCounselorId | null;
  } | null;
}

function readStoredCounselorPreference() {
  if (typeof window === 'undefined') return null;
  return normalizeMoonlightCounselor(
    window.localStorage.getItem(MOONLIGHT_COUNSELOR_STORAGE_KEY)
  );
}

function writeStoredCounselorPreference(counselorId: MoonlightCounselorId) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(MOONLIGHT_COUNSELOR_STORAGE_KEY, counselorId);
  window.dispatchEvent(
    new CustomEvent(MOONLIGHT_COUNSELOR_CHANGE_EVENT, {
      detail: { counselorId },
    })
  );
}

export async function fetchProfileCounselorPreference() {
  try {
    const response = await fetch('/api/profile', { cache: 'no-store' });
    const payload = (await response.json().catch(() => null)) as ProfileCounselorPayload | null;

    if (!response.ok || !payload?.authenticated) return null;

    return normalizeMoonlightCounselor(payload.profile?.preferredCounselor);
  } catch {
    return null;
  }
}

async function persistCounselorPreference(counselorId: MoonlightCounselorId) {
  try {
    const response = await fetch('/api/profile/counselor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredCounselor: counselorId }),
    });

    if (response.status === 401) return false;

    const payload = (await response.json().catch(() => null)) as
      | { persisted?: boolean }
      | null;

    return response.ok && payload?.persisted === true;
  } catch {
    return false;
  }
}

export function usePreferredCounselor(
  initialCounselor?: MoonlightCounselorId | null
) {
  const [counselorId, setCounselorId] = useState<MoonlightCounselorId>(
    normalizeMoonlightCounselor(initialCounselor) ?? DEFAULT_MOONLIGHT_COUNSELOR
  );
  const [hydrated, setHydrated] = useState(false);
  const [persistState, setPersistState] = useState<PersistState>('idle');

  useEffect(() => {
    let active = true;
    const stored = readStoredCounselorPreference();

    if (stored) {
      setCounselorId(stored);
      setHydrated(true);
      return () => {
        active = false;
      };
    }

    const normalizedInitial = normalizeMoonlightCounselor(initialCounselor);
    if (normalizedInitial) {
      setCounselorId(normalizedInitial);
      writeStoredCounselorPreference(normalizedInitial);
      setHydrated(true);
      return () => {
        active = false;
      };
    }

    void fetchProfileCounselorPreference().then((profileCounselor) => {
      if (!active) return;

      if (profileCounselor) {
        setCounselorId(profileCounselor);
        writeStoredCounselorPreference(profileCounselor);
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, [initialCounselor]);

  useEffect(() => {
    function handleCustomEvent(event: Event) {
      const nextCounselor = normalizeMoonlightCounselor(
        (event as CustomEvent<{ counselorId?: string }>).detail?.counselorId
      );

      if (nextCounselor) {
        setCounselorId(nextCounselor);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== MOONLIGHT_COUNSELOR_STORAGE_KEY) return;

      const nextCounselor = normalizeMoonlightCounselor(event.newValue);
      if (nextCounselor) {
        setCounselorId(nextCounselor);
      }
    }

    window.addEventListener(
      MOONLIGHT_COUNSELOR_CHANGE_EVENT,
      handleCustomEvent as EventListener
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(
        MOONLIGHT_COUNSELOR_CHANGE_EVENT,
        handleCustomEvent as EventListener
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const selectCounselor = useCallback(
    async (nextCounselor: MoonlightCounselorId) => {
      setCounselorId(nextCounselor);
      writeStoredCounselorPreference(nextCounselor);

      const persisted = await persistCounselorPreference(nextCounselor);
      setPersistState(persisted ? 'saved' : 'local_only');
    },
    []
  );

  const counselor = useMemo(
    () => getMoonlightCounselorMeta(counselorId),
    [counselorId]
  );

  return {
    counselorId,
    counselor,
    hydrated,
    persistState,
    selectCounselor,
  };
}
