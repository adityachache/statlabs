'use client';

import { useEffect, useState } from 'react';
import ConceptMap from '@/components/ConceptMap';
import { loadProgress, type Progress } from '@/lib/progress';

export default function HomePage() {
  const [progress, setProgress] = useState<Progress>({
    completedIds: [],
    visitedIds: [],
  });

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-lg tracking-tight text-gray-900">
              Statlab
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wide">
              beta
            </span>
          </div>
          <div className="text-xs text-gray-400">
            {progress.completedIds.length > 0
              ? `${progress.completedIds.length} lab${
                  progress.completedIds.length !== 1 ? 's' : ''
                } completed`
              : 'Start any unlocked lab below'}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
            Learn by doing, not reading.
          </h1>
          <p className="text-gray-500 text-base max-w-xl leading-relaxed">
            Every concept is a sandbox. Drag sliders, run experiments, and ask
            the AI tutor when you&apos;re stuck. Theory follows intuition here.
          </p>
        </div>

        <ConceptMap progress={progress} />
      </div>
    </main>
  );
}
