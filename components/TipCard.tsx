'use client';

export interface TipCardProps {
  index: number;
  text: string;
  accent: 'blue' | 'amber';
  isDismissed: boolean;
  actionButton?: { label: string; onClick: () => void };
  onDismiss: () => void;
  onReopen: () => void;
}

const ACCENT = {
  blue: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    dot: 'bg-blue-400',
    text: 'text-blue-800',
    action: 'text-blue-600 hover:text-blue-800',
    dismiss: 'text-blue-300 hover:text-blue-500',
    label: 'text-blue-400',
  },
  amber: {
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    dot: 'bg-amber-400',
    text: 'text-amber-800',
    action: 'text-amber-600 hover:text-amber-800',
    dismiss: 'text-amber-300 hover:text-amber-500',
    label: 'text-amber-400',
  },
} as const;

export function TipCard({
  index,
  text,
  accent,
  isDismissed,
  actionButton,
  onDismiss,
  onReopen,
}: TipCardProps) {
  const c = ACCENT[accent];

  if (isDismissed) {
    return (
      <button
        onClick={onReopen}
        title={`Re-read tip ${index + 1}`}
        className="flex items-center gap-1.5 group py-0.5"
      >
        <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
        <span className={`text-xs ${c.label} group-hover:underline`}>
          Tip {index + 1}
        </span>
      </button>
    );
  }

  return (
    <div className={`border-l-4 ${c.border} ${c.bg} rounded-r-lg px-3 py-3`}>
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-sm ${c.text} leading-relaxed`}>{text}</p>
        <button
          onClick={onDismiss}
          title="Dismiss"
          className={`shrink-0 text-xs leading-none mt-0.5 transition-colors ${c.dismiss}`}
        >
          ✕
        </button>
      </div>
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          className={`mt-2 text-xs font-semibold transition-colors ${c.action}`}
        >
          {actionButton.label}
        </button>
      )}
    </div>
  );
}
