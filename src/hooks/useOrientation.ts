'use client';

import { useCallback } from 'react';
import { ScreenOrientation, OrientationLock } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';

export function useOrientation() {
  const lockLandscape = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (e) {
        console.error('Failed to lock orientation:', e);
      }
    } else if (typeof window !== 'undefined' && screen.orientation && (screen.orientation as any).lock) {
      // Fallback for some web browsers
      try {
        await (screen.orientation as any).lock('landscape');
      } catch (e) {
        // Many browsers don't support locking without full-screen
        console.warn('Web orientation lock failed (usually requires fullscreen):', e);
      }
    }
  }, []);

  const unlock = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.unlock();
        // Optional: specifically lock back to portrait if preferred
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (e) {
        console.error('Failed to unlock orientation:', e);
      }
    } else if (typeof window !== 'undefined' && screen.orientation && (screen.orientation as any).unlock) {
      try {
        await (screen.orientation as any).unlock();
      } catch (e) {
        console.warn('Web orientation unlock failed:', e);
      }
    }
  }, []);

  return { lockLandscape, unlock };
}
