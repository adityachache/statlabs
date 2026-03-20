'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AiTutor from './AiTutor';
import { markVisited } from '@/lib/progress';
import type { Concept } from '@/lib/concepts';

interface LabShellProps {
  concept: Concept;
  children: React.ReactNode;
  labState?: Record<string, unknown>;
}

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

export default function LabShell({ concept, children, labState }: LabShellProps) {
  const [tutorOpen, setTutorOpen] = useState(true);
  const [tutorWidth, setTutorWidth] = useState(DEFAULT_WIDTH);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Drag state refs — no re-renders during drag
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);
  // Track latest width in a ref so mouseup handler can read it without stale closure
  const tutorWidthRef = useRef(DEFAULT_WIDTH);

  // Load initial open state and width from localStorage on mount
  useEffect(() => {
    const savedOpen = localStorage.getItem('statlab:tutor-open');
    if (savedOpen !== null) setTutorOpen(savedOpen === 'true');

    const savedWidth = localStorage.getItem('statlab:tutor-width');
    if (savedWidth !== null) {
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(savedWidth)));
      setTutorWidth(w);
      tutorWidthRef.current = w;
      startWidth.current = w;
    }
  }, []);

  useEffect(() => {
    markVisited(concept.id);
  }, [concept.id]);

  // Keep ref in sync with state so event handlers always have the latest value
  useEffect(() => {
    tutorWidthRef.current = tutorWidth;
  }, [tutorWidth]);

  // Global mouse event listeners for drag — attached once, cleaned up on unmount
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setTutorWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('statlab:tutor-width', String(tutorWidthRef.current));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = tutorWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Toggle: collapses to 0 and restores to last saved width
  const toggleTutor = () => {
    setTutorOpen((prev) => {
      localStorage.setItem('statlab:tutor-open', String(!prev));
      return !prev;
    });
  };

  // Close mobile overlay when tapping backdrop
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) toggleTutor();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Top bar ── */}
      <header className="shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-5 py-2.5">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            ← Statlab
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-semibold text-gray-800">{concept.title}</span>
          <div className="flex-1" />
          <button
            onClick={toggleTutor}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              tutorOpen
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            AI Tutor
          </button>
        </div>

        {/* Hook sentence */}
        <div className="px-5 pb-2.5 flex items-center gap-2">
          <span className="text-xs text-gray-400">✦</span>
          <p className="text-sm text-gray-500 italic">{concept.hook}</p>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lab content — flex-1 fills available space when sidebar is closed */}
        <main className="flex-1 overflow-y-auto scroll-pt-4" style={{ scrollPaddingTop: '1rem' }}>
          <div className="max-w-2xl mx-auto px-6 pt-8 pb-10">{children}</div>
        </main>

        {/* ── Drag handle + Desktop sidebar (≥1024px) ── */}
        {/* Drag handle — sits between main and aside, only rendered on desktop when open */}
        {tutorOpen && (
          <div
            onMouseDown={handleDragStart}
            className="
              hidden lg:flex
              w-1 flex-shrink-0 items-center justify-center
              cursor-col-resize
              group relative
              bg-transparent hover:bg-blue-400
              transition-colors duration-150
            "
            title="Drag to resize"
          >
            {/* Grip dots — centered vertically */}
            <div className="absolute flex flex-col gap-1 pointer-events-none">
              <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-white transition-colors" />
              <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-white transition-colors" />
              <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-white transition-colors" />
            </div>
          </div>
        )}

        <aside
          className={`
            hidden lg:flex flex-col flex-shrink-0 bg-white border-l border-gray-100
            overflow-hidden relative
            ${tutorOpen ? '' : '!w-0 !border-l-0'}
          `}
          style={tutorOpen ? { width: tutorWidth } : undefined}
        >
          {/* Sidebar header */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-700">Tutor</span>
            </div>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200 truncate max-w-[120px]">
              {concept.title}
            </span>
          </div>

          {/* Tutor content */}
          <div className="flex-1 overflow-hidden">
            <AiTutor labSlug={concept.slug} labState={labState} />
          </div>

          {/* Toggle tab — left edge, vertical midpoint */}
          <button
            onClick={toggleTutor}
            aria-label={tutorOpen ? 'Collapse tutor' : 'Expand tutor'}
            className="
              absolute left-0 top-1/2 -translate-y-1/2 translate-x-[-100%]
              flex items-center justify-center
              w-5 h-10 rounded-l-full
              bg-white border border-r-0 border-gray-200
              text-gray-400 hover:text-gray-600 hover:bg-gray-50
              transition-colors text-xs
              shadow-sm
            "
          >
            {tutorOpen ? '◀' : '▶'}
          </button>
        </aside>

        {/* ── Mobile overlay panel (<1024px) ── */}
        {tutorOpen && (
          <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="lg:hidden fixed inset-0 bg-black/30 z-50 flex justify-end"
          >
            <div
              className="w-80 h-full bg-white flex flex-col shadow-xl animate-slide-in-right"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Panel header */}
              <div className="shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-700">Tutor</span>
                </div>
                <button
                  onClick={toggleTutor}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
                  aria-label="Close tutor"
                >
                  ✕
                </button>
              </div>

              {/* Tutor content */}
              <div className="flex-1 overflow-hidden">
                <AiTutor labSlug={concept.slug} labState={labState} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
