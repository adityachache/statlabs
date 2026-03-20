'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TipCard } from '@/components/TipCard';
import { useTips } from '@/lib/useTips';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface GradientDescentLabState {
  currentX: number;
  currentLoss: number;
  currentGradient: number;
  learningRate: number;
  stepCount: number;
  status: 'idle' | 'running' | 'converged' | 'diverged';
  startX: number | null;
  interpretation: string;
}

interface Props {
  onStateChange?: (state: GradientDescentLabState) => void;
}

/* ─── Math ───────────────────────────────────────────────────────────────── */

const f  = (x: number): number => x ** 4 - 2 * x ** 2 + 0.5 * x;
const df = (x: number): number => 4 * x ** 3 - 4 * x + 0.5;

const X_MIN = -2.2;
const X_MAX =  2.2;
const N_CURVE = 400;
const STEP_INTERVAL_MS = 80;
const MAX_STEPS = 200;
const CONVERGE_THRESHOLD = 0.001;
const CONVERGE_STREAK = 3;
const LAB_SLUG = 'gradient-descent';

const MARGIN = { top: 24, right: 24, bottom: 40, left: 52 };
const CHART_H = 300;

/* ─── Static curve data ─────────────────────────────────────────────────── */

const CURVE_XS = Array.from({ length: N_CURVE }, (_, i) =>
  X_MIN + (i / (N_CURVE - 1)) * (X_MAX - X_MIN)
);
const CURVE_YS = CURVE_XS.map(f);
const Y_MIN_CURVE = Math.min(...CURVE_YS);
const Y_MAX_CURVE = Math.max(...CURVE_YS);
const Y_PAD = (Y_MAX_CURVE - Y_MIN_CURVE) * 0.15;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(n: number, dp: number): string {
  return n.toFixed(dp);
}

function dotColor(status: GradientDescentLabState['status']): string {
  if (status === 'converged') return '#16a34a';
  if (status === 'diverged')  return '#dc2626';
  return '#2563eb';
}

function buildInterpretation(
  status: GradientDescentLabState['status'],
  startX: number | null,
  currentX: number,
  stepCount: number,
  learningRate: number,
): string {
  if (startX === null) return 'click the curve to place a starting point';
  if (status === 'idle' && stepCount === 0)
    return `placed start point at x=${fmt(startX, 2)}, hasn't run yet`;
  if (status === 'converged')
    return `converged to local minimum at x=${fmt(currentX, 4)} after ${stepCount} steps`;
  if (status === 'diverged')
    return `diverging — learning rate ${fmt(learningRate, 3)} is too high`;
  if (status === 'running')
    return `running — moving toward local minimum (step ${stepCount})`;
  return `paused at x=${fmt(currentX, 4)} after ${stepCount} steps`;
}

/* ─── D3 refs ────────────────────────────────────────────────────────────── */

interface D3Refs {
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  trailGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  dot: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  tangentLine: d3.Selection<SVGLineElement, unknown, null, undefined>;
}

/* ─── Stat card ──────────────────────────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100">
      <div className="text-xs text-gray-500 truncate">{label}</div>
      <div className="font-mono text-sm font-bold text-gray-800 mt-0.5 truncate">{value}</div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function GradientDescent({ onStateChange }: Props) {
  const [learningRate, setLearningRate] = useState(0.05);
  const [stepCount, setStepCount]       = useState(0);
  const [isRunning, setIsRunning]       = useState(false);
  const [startX, setStartX]             = useState<number | null>(null);
  const [currentX, setCurrentX]         = useState(0);
  const [status, setStatus]             = useState<GradientDescentLabState['status']>('idle');
  const [chartWidth, setChartWidth]     = useState(560);

  const containerRef   = useRef<HTMLDivElement>(null);
  const svgRef         = useRef<SVGSVGElement>(null);
  const d3Refs         = useRef<D3Refs | null>(null);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mutable live values used inside the interval closure
  const xRef           = useRef(0);
  const stepRef        = useRef(0);
  const startXRef      = useRef<number | null>(null);
  const statusRef      = useRef<GradientDescentLabState['status']>('idle');
  const lrRef          = useRef(0.05);
  const streakRef      = useRef(0);
  const isRunningRef   = useRef(false);

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  useEffect(() => { lrRef.current = learningRate; }, [learningRate]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // ── Tips ──────────────────────────────────────────────────────────────────
  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip, resetTips } = useTips(LAB_SLUG);
  const runCountRef = useRef(0);
  const unlockTipRef = useRef(unlockTip);
  useEffect(() => { unlockTipRef.current = unlockTip; }, [unlockTip]);

  // ── Effect 1: build SVG structure ────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;

    const W = chartWidth;
    const totalH = CHART_H + MARGIN.top + MARGIN.bottom;

    const xScale = d3.scaleLinear().domain([X_MIN, X_MAX]).range([0, W]);
    const yScale = d3.scaleLinear()
      .domain([Y_MIN_CURVE - Y_PAD, Y_MAX_CURVE + Y_PAD])
      .range([CHART_H, 0]);

    const svg = d3.select(svgRef.current)
      .attr('width', W + MARGIN.left + MARGIN.right)
      .attr('height', totalH);

    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-W).tickFormat(() => ''))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('line').attr('stroke', '#f0f0f0').attr('stroke-dasharray', '3,3'));

    // x=0 reference dashed line
    g.append('line')
      .attr('x1', xScale(0)).attr('x2', xScale(0))
      .attr('y1', 0).attr('y2', CHART_H)
      .attr('stroke', '#d1d5db')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1);

    // Loss curve
    const lineGen = d3.line<number>()
      .x((_, i) => xScale(CURVE_XS[i]))
      .y(d => yScale(d))
      .curve(d3.curveCatmullRom);

    g.append('path')
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen(CURVE_YS) ?? '');

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${CHART_H})`)
      .call(d3.axisBottom(xScale).ticks(8))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11));

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${(d as number).toFixed(1)}`))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11));

    // Axis labels
    g.append('text')
      .attr('x', W / 2).attr('y', CHART_H + MARGIN.bottom - 4)
      .attr('text-anchor', 'middle').attr('fill', '#9ca3af').attr('font-size', 11)
      .text('x');
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -CHART_H / 2).attr('y', -42)
      .attr('text-anchor', 'middle').attr('fill', '#9ca3af').attr('font-size', 11)
      .text('f(x)');

    // Trail group — drawn beneath dot
    const trailGroup = g.append('g');

    // Tangent line (amber, dashed)
    const tangentLine = g.append('line')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3')
      .attr('opacity', 0);

    // Current position dot
    const dot = g.append('circle')
      .attr('r', 8)
      .attr('fill', '#2563eb')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0);

    // Transparent click target over the whole chart area
    g.append('rect')
      .attr('width', W).attr('height', CHART_H)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('click', (event: MouseEvent) => {
        if (isRunningRef.current) return;
        const [mx] = d3.pointer(event);
        const x = Math.max(X_MIN, Math.min(X_MAX, xScale.invert(mx)));

        xRef.current = x;
        startXRef.current = x;
        stepRef.current = 0;
        streakRef.current = 0;
        statusRef.current = 'idle';

        setStartX(x);
        setCurrentX(x);
        setStepCount(0);
        setStatus('idle');

        trailGroup.selectAll('*').remove();
        tangentLine.attr('opacity', 0);
        dot
          .attr('cx', xScale(x))
          .attr('cy', yScale(f(x)))
          .attr('fill', '#2563eb')
          .attr('opacity', 1);
      });

    d3Refs.current = { xScale, yScale, trailGroup, dot, tangentLine };
  // chartWidth is the only structural dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartWidth]);

  // ── Core step ─────────────────────────────────────────────────────────────
  const doStep = useCallback(() => {
    const refs = d3Refs.current;
    if (!refs || startXRef.current === null) return;
    if (statusRef.current === 'converged' || statusRef.current === 'diverged') return;

    const { xScale, yScale, trailGroup, dot, tangentLine } = refs;
    const x    = xRef.current;
    const loss = f(x);
    const grad = df(x);

    // Divergence
    if (Math.abs(x) > X_MAX || Math.abs(loss) > 20) {
      statusRef.current = 'diverged';
      dot.attr('fill', dotColor('diverged'));
      clearInterval(intervalRef.current ?? undefined);
      intervalRef.current = null;
      setIsRunning(false);
      setStatus('diverged');
      unlockTipRef.current(2);
      return;
    }

    // Convergence streak
    if (Math.abs(grad) < CONVERGE_THRESHOLD) {
      streakRef.current += 1;
    } else {
      streakRef.current = 0;
    }

    if (streakRef.current >= CONVERGE_STREAK) {
      statusRef.current = 'converged';
      dot.attr('fill', dotColor('converged'));
      clearInterval(intervalRef.current ?? undefined);
      intervalRef.current = null;
      setIsRunning(false);
      setStatus('converged');
      setCurrentX(xRef.current);
      setStepCount(stepRef.current);
      return;
    }

    // Trail dot at current position before moving
    trailGroup.append('circle')
      .attr('cx', xScale(x))
      .attr('cy', yScale(loss))
      .attr('r', 3)
      .attr('fill', '#93c5fd')
      .attr('opacity', 0.7);

    // Update
    const newX = x - lrRef.current * grad;
    xRef.current = newX;
    stepRef.current += 1;

    // Move dot
    dot
      .attr('cx', xScale(newX))
      .attr('cy', yScale(f(newX)))
      .attr('fill', dotColor('running'));

    // Tangent line at old position
    const span = 0.35;
    const tx1 = Math.max(X_MIN, x - span);
    const tx2 = Math.min(X_MAX, x + span);
    tangentLine
      .attr('x1', xScale(tx1)).attr('y1', yScale(loss + grad * (tx1 - x)))
      .attr('x2', xScale(tx2)).attr('y2', yScale(loss + grad * (tx2 - x)))
      .attr('opacity', 0.9);

    // Max steps
    if (stepRef.current >= MAX_STEPS) {
      clearInterval(intervalRef.current ?? undefined);
      intervalRef.current = null;
      statusRef.current = 'idle';
      setIsRunning(false);
      setStatus('idle');
    }

    setCurrentX(newX);
    setStepCount(stepRef.current);
  }, []);

  // ── Run / pause ───────────────────────────────────────────────────────────
  const handleRunPause = useCallback(() => {
    if (startXRef.current === null) return;
    if (statusRef.current === 'converged' || statusRef.current === 'diverged') return;

    if (isRunningRef.current) {
      clearInterval(intervalRef.current ?? undefined);
      intervalRef.current = null;
      isRunningRef.current = false;
      statusRef.current = 'idle';
      setIsRunning(false);
      setStatus('idle');
    } else {
      // Unlock tip 1 on first run press; unlock tip 2 after 3+ runs
      runCountRef.current += 1;
      unlockTipRef.current(1);
      if (runCountRef.current >= 3) unlockTipRef.current(2);

      statusRef.current = 'running';
      isRunningRef.current = true;
      setStatus('running');
      setIsRunning(true);
      intervalRef.current = setInterval(() => {
        if (statusRef.current === 'converged' || statusRef.current === 'diverged') {
          clearInterval(intervalRef.current ?? undefined);
          intervalRef.current = null;
          return;
        }
        doStep();
      }, STEP_INTERVAL_MS);
    }
  }, [doStep]);

  const handleStep = useCallback(() => {
    if (startXRef.current === null) return;
    if (statusRef.current === 'converged' || statusRef.current === 'diverged') return;
    if (isRunningRef.current) return;
    const prevStatus = statusRef.current;
    statusRef.current = 'running';
    doStep();
    // Restore to idle if doStep didn't set a terminal status
    if (statusRef.current === 'running') {
      statusRef.current = prevStatus === 'running' ? 'idle' : prevStatus;
      setStatus('idle');
    }
  }, [doStep]);

  const handleReset = useCallback(() => {
    clearInterval(intervalRef.current ?? undefined);
    intervalRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);

    const refs = d3Refs.current;
    if (!refs || startXRef.current === null) return;
    const { xScale, yScale, trailGroup, dot, tangentLine } = refs;

    xRef.current = startXRef.current;
    stepRef.current = 0;
    streakRef.current = 0;
    statusRef.current = 'idle';

    trailGroup.selectAll('*').remove();
    tangentLine.attr('opacity', 0);
    dot
      .attr('cx', xScale(startXRef.current))
      .attr('cy', yScale(f(startXRef.current)))
      .attr('fill', '#2563eb')
      .attr('opacity', 1);

    setCurrentX(startXRef.current);
    setStepCount(0);
    setStatus('idle');
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { clearInterval(intervalRef.current ?? undefined); }, []);

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 560;
      setChartWidth(Math.max(240, w - MARGIN.left - MARGIN.right));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Notify parent ─────────────────────────────────────────────────────────
  useEffect(() => {
    onStateChangeRef.current?.({
      currentX,
      currentLoss: f(currentX),
      currentGradient: df(currentX),
      learningRate,
      stepCount,
      status,
      startX,
      interpretation: buildInterpretation(status, startX, currentX, stepCount, learningRate),
    });
  }, [currentX, learningRate, stepCount, status, startX]);

  // ── Derived display values ────────────────────────────────────────────────
  const loss     = f(currentX);
  const gradient = df(currentX);
  const lrPct    = ((learningRate - 0.001) / (0.4 - 0.001)) * 100;
  const lrTrack  = {
    background: `linear-gradient(to right, #3b82f6 ${lrPct}%, #e5e7eb ${lrPct}%)`,
  };
  const isTerminal = status === 'converged' || status === 'diverged';
  const canAct     = startX !== null && !isTerminal;

  const GD_TIPS = [
    {
      text: "Click anywhere on the curve to place your starting point. Before pressing Run — which way do you think it will roll?",
      accent: 'blue' as const,
      actionButton: undefined,
    },
    {
      text: "Now try learning rate 0.35 and run from the same spot. Something breaks. Can you describe what's happening?",
      accent: 'amber' as const,
      actionButton: {
        label: 'Try high LR →',
        onClick: () => setLearningRate(0.35),
      },
    },
    {
      text: "You've landed in a local minimum — but is it the lowest point on the curve? Try starting from a different position and see if you end up somewhere different.",
      accent: 'blue' as const,
      actionButton: undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 h-full">

      {/* Tips */}
      {GD_TIPS.some((_, i) => unlocked.has(i)) && (
        <div className="flex flex-col gap-2">
          {GD_TIPS.map((tip, i) => {
            if (!unlocked.has(i)) return null;
            return (
              <TipCard
                key={i}
                index={i}
                text={tip.text}
                accent={tip.accent}
                isDismissed={dismissed.has(i)}
                actionButton={tip.actionButton}
                onDismiss={() => dismissTip(i)}
                onReopen={() => reopenTip(i)}
              />
            );
          })}
        </div>
      )}

      {/* Chart */}
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="block overflow-visible" />
      </div>

      {/* Context hint */}
      <p className="text-xs text-gray-400 -mt-2">
        {startX === null
          ? 'Click anywhere on the curve to place your starting point.'
          : status === 'running'
          ? `Step ${stepCount} — watch the gradient (tangent line) flatten as it approaches a minimum.`
          : isTerminal
          ? status === 'converged'
            ? `Converged at x = ${fmt(currentX, 4)} after ${stepCount} steps.`
            : 'Diverged — try a smaller learning rate, then reset.'
          : 'Use the controls below to run, step through, or reset.'}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRunPause}
          disabled={!canAct}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          {isRunning ? 'Pause' : 'Run'}
        </button>
        <button
          onClick={handleStep}
          disabled={!canAct || isRunning}
          className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Step
        </button>
        <button
          onClick={handleReset}
          disabled={startX === null}
          className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-500 disabled:opacity-40 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Learning rate slider */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-1.5">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-gray-700">
            Learning rate <span className="font-mono text-xs text-gray-500">(η)</span>
          </span>
          <span className="font-mono text-sm font-semibold text-blue-600">{fmt(learningRate, 3)}</span>
        </div>
        <input
          type="range"
          min={0.001}
          max={0.4}
          step={0.001}
          value={learningRate}
          onChange={e => {
            const v = parseFloat(e.target.value);
            setLearningRate(v);
            lrRef.current = v;
          }}
          style={lrTrack}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>0.001 (tiny steps)</span>
          <span>0.4 (large steps)</span>
        </div>
      </div>

      {/* Stats panel */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <StatCard label="Steps" value={String(stepCount)} />
        <StatCard label="Current x" value={startX !== null ? fmt(currentX, 4) : '—'} />
        <StatCard label="Loss f(x)" value={startX !== null ? fmt(loss, 4) : '—'} />
        <StatCard label="Gradient f′(x)" value={startX !== null ? fmt(gradient, 4) : '—'} />
        <StatCard label="Rate η" value={fmt(learningRate, 3)} />
      </div>

      {/* Reset tips */}
      <div className="flex justify-center pt-1">
        <button
          onClick={resetTips}
          className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
        >
          Reset tips
        </button>
      </div>
    </div>
  );
}
