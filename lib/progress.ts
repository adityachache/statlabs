const STORAGE_KEY = 'statlab_progress_v1';

export interface Progress {
  completedIds: string[];
  visitedIds: string[];
  lastVisited?: string;
}

const DEFAULT_PROGRESS: Progress = { completedIds: [], visitedIds: [] };

export function loadProgress(): Progress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Progress) : DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: Progress): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function markVisited(id: string): void {
  const p = loadProgress();
  if (!p.visitedIds.includes(id)) p.visitedIds.push(id);
  p.lastVisited = id;
  saveProgress(p);
}

export function markCompleted(id: string): void {
  const p = loadProgress();
  if (!p.completedIds.includes(id)) p.completedIds.push(id);
  if (!p.visitedIds.includes(id)) p.visitedIds.push(id);
  saveProgress(p);
}

export function getVisited(): Set<string> {
  return new Set(loadProgress().visitedIds);
}

export function isUnlocked(prerequisites: string[], progressOrIds: Progress | string[]): boolean {
  const ids = Array.isArray(progressOrIds)
    ? progressOrIds
    : [...progressOrIds.visitedIds, ...progressOrIds.completedIds];
  return prerequisites.every((id) => ids.includes(id));
}
