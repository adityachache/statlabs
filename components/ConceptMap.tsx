import Link from 'next/link';
import { concepts, TIERS, type Tier, type Concept } from '@/lib/concepts';
import { isUnlocked } from '@/lib/progress';
import type { Progress } from '@/lib/progress';

interface ConceptMapProps {
  progress: Progress;
}

const TIER_STYLES: Record<
  Tier,
  { badge: string; dot: string; section: string }
> = {
  foundations: {
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500',
    section: 'text-blue-600',
  },
  core: {
    badge: 'bg-violet-50 text-violet-700 border border-violet-200',
    dot: 'bg-violet-500',
    section: 'text-violet-600',
  },
  advanced: {
    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
    dot: 'bg-rose-500',
    section: 'text-rose-600',
  },
};

function ConceptCard({
  concept,
  unlocked,
  completed,
  visited,
}: {
  concept: Concept;
  unlocked: boolean;
  completed: boolean;
  visited: boolean;
}) {
  const styles = TIER_STYLES[concept.tier];
  const interactive = concept.hasLab;

  const card = (
    <div
      className={`group relative p-5 rounded-2xl border bg-white transition-all duration-150 ${
        interactive
          ? 'hover:shadow-md hover:border-gray-300 cursor-pointer'
          : 'cursor-default'
      } ${completed ? 'border-green-200' : 'border-gray-200'}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
            {TIERS[concept.tier].label}
          </span>
          {concept.tags.map((t) => (
            <span key={t} className="text-xs text-gray-400">
              #{t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {completed && (
            <span className="text-green-500 text-sm font-semibold" title="Completed">
              ✓
            </span>
          )}
          {!completed && visited && (
            <span className="w-2 h-2 rounded-full bg-blue-400" title="In progress" />
          )}
          {interactive && (
            <span className="text-xs text-gray-300 group-hover:text-blue-500 transition-colors">
              →
            </span>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-1.5">{concept.title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
        {concept.hook}
      </p>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        {interactive ? (
          <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">
            Open lab →
          </span>
        ) : (
          <span className="text-xs text-gray-300">Coming soon</span>
        )}
      </div>
    </div>
  );

  if (interactive) {
    return <Link href={`/lab/${concept.slug}`}>{card}</Link>;
  }
  return card;
}

export default function ConceptMap({ progress }: ConceptMapProps) {
  const tiers: Tier[] = ['foundations', 'core', 'advanced'];
  const total = concepts.length;
  const done = progress.completedIds.length;

  return (
    <div className="space-y-10">
      {/* Progress bar */}
      {done > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {done}/{total} completed
          </span>
        </div>
      )}

      {tiers.map((tier) => {
        const list = concepts.filter((c) => c.tier === tier);
        const styles = TIER_STYLES[tier];
        const doneTier = list.filter((c) => progress.completedIds.includes(c.id)).length;

        return (
          <section key={tier}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
              <h2 className={`text-sm font-semibold ${styles.section}`}>
                {TIERS[tier].label}
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">
                {doneTier}/{list.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((concept) => (
                <ConceptCard
                  key={concept.id}
                  concept={concept}
                  unlocked={isUnlocked(concept.prerequisites, progress)}
                  completed={progress.completedIds.includes(concept.id)}
                  visited={progress.visitedIds.includes(concept.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
