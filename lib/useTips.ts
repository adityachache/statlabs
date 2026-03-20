import { useCallback, useEffect, useRef, useState } from 'react';
import { clearTipState, loadTipState, saveTipState } from './tips';

export interface TipsApi {
  unlocked: Set<number>;
  dismissed: Set<number>;
  unlockTip: (n: number) => void;
  dismissTip: (n: number) => void;
  reopenTip: (n: number) => void;
  resetTips: () => void;
}

export function useTips(slug: string): TipsApi {
  const [unlocked, setUnlocked] = useState<Set<number>>(new Set([0]));
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadTipState(slug);
    setUnlocked(new Set([0, ...saved.unlocked]));
    setDismissed(new Set(saved.dismissed));
    setLoaded(true);
  }, [slug]);

  // Persist whenever state changes (but only after hydration)
  const unlockedRef = useRef(unlocked);
  const dismissedRef = useRef(dismissed);
  unlockedRef.current = unlocked;
  dismissedRef.current = dismissed;

  useEffect(() => {
    if (!loaded) return;
    saveTipState(slug, Array.from(unlocked), Array.from(dismissed));
  }, [slug, unlocked, dismissed, loaded]);

  const unlockTip = useCallback((n: number) => {
    setUnlocked(prev => {
      if (prev.has(n)) return prev;
      return new Set(Array.from(prev).concat([n]));
    });
  }, []);

  const dismissTip = useCallback((n: number) => {
    setDismissed(prev => new Set(Array.from(prev).concat([n])));
  }, []);

  const reopenTip = useCallback((n: number) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.delete(n);
      return next;
    });
  }, []);

  const resetTips = useCallback(() => {
    clearTipState(slug);
    setUnlocked(new Set([0]));
    setDismissed(new Set());
  }, [slug]);

  return { unlocked, dismissed, unlockTip, dismissTip, reopenTip, resetTips };
}
