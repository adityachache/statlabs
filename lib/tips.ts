/* ─── localStorage helpers for progressive tip system ─────────────────────── */

interface TipState {
  unlocked: number[];
  dismissed: number[];
}

function key(slug: string) {
  return `statlab:tips:${slug}`;
}

export function loadTipState(slug: string): TipState {
  if (typeof window === 'undefined') return { unlocked: [], dismissed: [] };
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return { unlocked: [], dismissed: [] };
    const parsed = JSON.parse(raw) as Partial<TipState>;
    return {
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { unlocked: [], dismissed: [] };
  }
}

export function saveTipState(slug: string, unlocked: number[], dismissed: number[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key(slug), JSON.stringify({ unlocked, dismissed }));
}

export function clearTipState(slug: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key(slug));
}
