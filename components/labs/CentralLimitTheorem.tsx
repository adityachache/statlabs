'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TipCard } from '@/components/TipCard';
import { useTips } from '@/lib/useTips';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type SourceDist = 'uniform' | 'skewed' | 'bimodal' | 'normal';

export interface CLTLabState {
  sourceDistribution: SourceDist;
  sampleSize: number;
  samplesDrawn: number;
  meanOfMeans: number;
  stdDevOfMeans: number;
  expectedStdError: number;
  isRunning: boolean;
  looksNormal: boolean;
  interpretation: string;
}

interface Props {
  onStateChange?: (state: CLTLabState) => void;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const MARGIN   = { top: 28, right: 12, bottom: 36, left: 40 };
const CHART_H  = 220;
const N_BINS   = 40;
const MAX_MEANS = 2000;
const N_POP    = 8000;
const LAB_SLUG = 'central-limit-theorem';

/* ─── Source distribution metadata ──────────────────────────────────────── */

interface PopInfo { mean: number; sigma: number; domain: [number, number] }

const POP: Record<SourceDist, PopInfo> = {
  uniform: { mean: 0.5,        sigma: Math.sqrt(1 / 12), domain: [0, 1] },
  skewed:  { mean: 1 / 3,      sigma: 1 / 3,             domain: [0, 2] },
  bimodal: { mean: 0.5,        sigma: 0.32,              domain: [0, 1] },
  normal:  { mean: 0.5,        sigma: 0.15,              domain: [0, 1] },
};

const SOURCES: SourceDist[] = ['uniform', 'skewed', 'bimodal', 'normal'];
const SOURCE_LABELS: Record<SourceDist, string> = {
  uniform: 'Uniform', skewed: 'Skewed', bimodal: 'Bimodal', normal: 'Normal',
};

/* ─── Samplers ───────────────────────────────────────────────────────────── */

function randn(): number {
  return (
    Math.sqrt(-2 * Math.log(Math.max(1e-10, 1 - Math.random()))) *
    Math.cos(2 * Math.PI * Math.random())
  );
}

function sampleFrom(src: SourceDist): number {
  switch (src) {
    case 'uniform':  return Math.random();
    case 'skewed':   return Math.min(-Math.log(Math.max(1e-10, 1 - Math.random())) / 3, 2);
    case 'bimodal':  return (Math.random() < 0.5 ? 0.25 : 0.75) + 0.1 * randn();
    case 'normal':   return 0.5 + 0.15 * randn();
  }
}

/* ─── Statistics helpers ────────────────────────────────────────────────── */

function arrMean(a: number[]): number {
  return a.length === 0 ? 0 : a.reduce((s, x) => s + x, 0) / a.length;
}

function arrStd(a: number[], m: number): number {
  if (a.length < 2) return 0;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

function arrSkew(a: number[], m: number, sd: number): number {
  if (a.length < 10 || sd < 1e-10) return 99;
  const n = a.length;
  return (n / ((n - 1) * (n - 2))) * a.reduce((s, x) => s + ((x - m) / sd) ** 3, 0);
}

function normalPdf(x: number, mu: number, sigma: number): number {
  if (sigma < 1e-10) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

function fmt(n: number, dp = 3): string {
  return isNaN(n) || !isFinite(n) ? '—' : n.toFixed(dp);
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  label, value, sub, highlight,
}: {
  label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100">
      <div className="text-xs text-gray-500 truncate">{label}</div>
      <div className={`font-mono text-sm font-bold mt-0.5 break-all leading-tight ${
        highlight ? 'text-green-600' : 'text-gray-800'
      }`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}
    </div>
  );
}

/* ─── Right chart update closure type ───────────────────────────────────── */

type UpdateFn = () => void;

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function CentralLimitTheorem({ onStateChange }: Props) {
  const [source, setSource]           = useState<SourceDist>('skewed');
  const [sampleSize, setSampleSize]   = useState(5);
  const [speed, setSpeed]             = useState(150);
  const [isRunning, setIsRunning]     = useState(false);
  const [samplesDrawn, setSamplesDrawn] = useState(0);
  const [momDisp, setMomDisp]         = useState(0);
  const [sdomDisp, setSdomDisp]       = useState(0);
  const [looksNormal, setLooksNormal] = useState(false);
  const [chartWidth, setChartWidth]   = useState(560);

  // Mutable refs (read inside interval closure, never stale)
  const meansRef       = useRef<number[]>([]);
  const sampleSizeRef  = useRef(5);
  const sourceRef      = useRef<SourceDist>('skewed');
  const isRunningRef   = useRef(false);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockTipRef   = useRef<(n: number) => void>(() => {});

  // D3 refs
  const containerRef   = useRef<HTMLDivElement>(null);
  const leftSvgRef     = useRef<SVGSVGElement>(null);
  const rightSvgRef    = useRef<SVGSVGElement>(null);
  const updateRightRef = useRef<UpdateFn | null>(null);

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  // Tips
  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip, resetTips } = useTips(LAB_SLUG);
  useEffect(() => { unlockTipRef.current = unlockTip; }, [unlockTip]);

  // Sync mutable refs with React state
  useEffect(() => { sampleSizeRef.current = sampleSize; }, [sampleSize]);
  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // Derived display values
  const expectedStdError = POP[source].sigma / Math.sqrt(sampleSize);
  const interpretation =
    samplesDrawn === 0
      ? `ready to sample from ${source} distribution with n=${sampleSize}`
      : sampleSize === 1
      ? `n=1: sampling distribution mirrors the source (${source})`
      : looksNormal
      ? `CLT confirmed — ${source} source with n=${sampleSize} produced normal sampling distribution after ${samplesDrawn} samples`
      : `watching ${source} distribution with n=${sampleSize}, ${samplesDrawn} samples drawn, not yet normal`;

  // Notify parent
  useEffect(() => {
    onStateChangeRef.current?.({
      sourceDistribution: source,
      sampleSize,
      samplesDrawn,
      meanOfMeans: momDisp,
      stdDevOfMeans: sdomDisp,
      expectedStdError,
      isRunning,
      looksNormal,
      interpretation,
    });
  }, [source, sampleSize, samplesDrawn, momDisp, sdomDisp, expectedStdError, isRunning, looksNormal, interpretation]);

  /* ─── Compute half-width for each chart ────────────────────────────────── */
  const halfW = Math.max(180, Math.floor((chartWidth - 12) / 2));
  const innerW = halfW - MARGIN.left - MARGIN.right;
  const totalH = CHART_H + MARGIN.top + MARGIN.bottom;

  /* ─── Left chart (static population histogram) ──────────────────────────── */
  useEffect(() => {
    if (!leftSvgRef.current) return;
    const { domain } = POP[source];
    const iW = Math.max(60, halfW - MARGIN.left - MARGIN.right);

    const svg = d3.select(leftSvgRef.current)
      .attr('width', halfW)
      .attr('height', totalH);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const xSc = d3.scaleLinear().domain(domain).range([0, iW]);
    const data = Array.from({ length: N_POP }, () => sampleFrom(source));
    const bins = d3.bin().domain(domain as [number, number]).thresholds(xSc.ticks(30))(data);
    const maxC = d3.max(bins, d => d.length) ?? 1;
    const ySc  = d3.scaleLinear().domain([0, maxC]).range([CHART_H, 0]);

    // Grid
    g.append('g')
      .call(d3.axisLeft(ySc).ticks(4).tickSize(-iW).tickFormat(() => ''))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('line').attr('stroke', '#f0f0f0').attr('stroke-dasharray', '3,3'));

    // Bars
    g.selectAll<SVGRectElement, d3.Bin<number, number>>('rect')
      .data(bins)
      .join('rect')
      .attr('x', d => xSc(d.x0 ?? 0) + 0.5)
      .attr('width', d => Math.max(0, xSc(d.x1 ?? 0) - xSc(d.x0 ?? 0) - 1))
      .attr('y', d => ySc(d.length))
      .attr('height', d => CHART_H - ySc(d.length))
      .attr('fill', '#93c5fd')
      .attr('opacity', 0.85);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${CHART_H})`)
      .call(d3.axisBottom(xSc).ticks(4))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 10));

    // Y axis (no ticks, just domain line)
    g.append('g')
      .call(d3.axisLeft(ySc).ticks(0))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'));

    // Chart label
    g.append('text')
      .attr('x', iW / 2).attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280').attr('font-size', 11).attr('font-weight', 600)
      .text('Population');
  }, [source, halfW, totalH]);

  /* ─── Right chart structure + update function ────────────────────────────── */
  useEffect(() => {
    if (!rightSvgRef.current) return;
    const iW = Math.max(60, halfW - MARGIN.left - MARGIN.right);

    const svg = d3.select(rightSvgRef.current)
      .attr('width', halfW)
      .attr('height', totalH);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const barsG     = g.append('g');
    const curvePath = g.append('path')
      .attr('fill', 'none')
      .attr('stroke', '#f97316')
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round');
    const xAxisG    = g.append('g').attr('transform', `translate(0,${CHART_H})`);
    const yAxisG    = g.append('g');
    g.append('text')
      .attr('x', iW / 2).attr('y', -14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6b7280').attr('font-size', 11).attr('font-weight', 600)
      .text('Sampling distribution of means');

    const countText = g.append('text')
      .attr('x', iW / 2).attr('y', -3)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af').attr('font-size', 10);

    // Draw initial empty x axis
    xAxisG
      .call(d3.axisBottom(d3.scaleLinear().domain([0, 1]).range([0, iW])).ticks(4))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 10));

    // The imperative update function — called every tick
    const updateFn: UpdateFn = () => {
      const means = meansRef.current;
      countText.text(means.length > 0 ? `${means.length} samples collected` : '');

      if (means.length < 2) {
        barsG.selectAll('*').remove();
        curvePath.attr('d', '');
        return;
      }

      const m   = arrMean(means);
      const sd  = arrStd(means, m);
      const ext = d3.extent(means) as [number, number];
      const pad = Math.max((ext[1] - ext[0]) * 0.25, 0.02);
      const xDom: [number, number] = [ext[0] - pad, ext[1] + pad];

      const xSc   = d3.scaleLinear().domain(xDom).range([0, iW]);
      const bins  = d3.bin().domain(xDom).thresholds(xSc.ticks(N_BINS))(means);
      const binW  = ((bins[0]?.x1 ?? 0.01) - (bins[0]?.x0 ?? 0));
      const dens  = bins.map(b => binW > 0 ? b.length / (means.length * binW) : 0);
      const peakN = sd > 0 ? normalPdf(m, m, sd) : 0;
      const yMax  = Math.max(d3.max(dens) ?? 0, peakN) * 1.2;
      const ySc   = d3.scaleLinear().domain([0, Math.max(yMax, 0.001)]).range([CHART_H, 0]);

      xAxisG
        .call(d3.axisBottom(xSc).ticks(4))
        .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
        .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
        .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 10));

      yAxisG
        .call(d3.axisLeft(ySc).ticks(0))
        .call(s => s.select('.domain').attr('stroke', '#d1d5db'));

      barsG
        .selectAll<SVGRectElement, d3.Bin<number, number>>('rect')
        .data(bins)
        .join('rect')
        .attr('x', d => xSc(d.x0 ?? 0) + 0.5)
        .attr('width', d => Math.max(0, xSc(d.x1 ?? 0) - xSc(d.x0 ?? 0) - 1))
        .attr('y', (_, i) => ySc(dens[i]))
        .attr('height', (_, i) => CHART_H - ySc(dens[i]))
        .attr('fill', '#3b82f6')
        .attr('opacity', 0.7);

      if (sd > 0 && means.length >= 5) {
        const pts: [number, number][] = Array.from({ length: 200 }, (_, i) => {
          const x = xDom[0] + (i / 199) * (xDom[1] - xDom[0]);
          return [x, normalPdf(x, m, sd)];
        });
        const lineGen = d3.line<[number, number]>()
          .x(d => xSc(d[0]))
          .y(d => ySc(d[1]))
          .curve(d3.curveBasis);
        curvePath.attr('d', lineGen(pts) ?? '');
      } else {
        curvePath.attr('d', '');
      }
    };

    updateRightRef.current = updateFn;
    updateFn(); // render whatever is currently in meansRef
  }, [halfW, totalH]);

  /* ─── Animation interval ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tick = () => {
      const n   = sampleSizeRef.current;
      const src = sourceRef.current;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += sampleFrom(src);
      const sm = sum / n;

      meansRef.current.push(sm);
      if (meansRef.current.length > MAX_MEANS) meansRef.current.shift();

      updateRightRef.current?.();

      const means = meansRef.current;
      const count = means.length;
      const m     = arrMean(means);
      const sd    = arrStd(means, m);
      const skew  = arrSkew(means, m, sd);
      const ln    = count > 200 && Math.abs(skew) < 0.3;

      setSamplesDrawn(count);
      setMomDisp(m);
      setSdomDisp(sd);
      setLooksNormal(ln);

      if (count >= 100)          unlockTipRef.current(1);
      if (ln || count >= 500)    unlockTipRef.current(2);
    };

    intervalRef.current = setInterval(tick, speed);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [isRunning, speed]);

  /* ─── Cleanup on unmount ─────────────────────────────────────────────────── */
  useEffect(() => () => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
  }, []);

  /* ─── ResizeObserver ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 560;
      setChartWidth(Math.max(320, w));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ─── Handlers ───────────────────────────────────────────────────────────── */

  const clearMeans = useCallback(() => {
    meansRef.current = [];
    setSamplesDrawn(0);
    setMomDisp(0);
    setSdomDisp(0);
    setLooksNormal(false);
    updateRightRef.current?.();
  }, []);

  const handleSource = useCallback((s: SourceDist) => {
    sourceRef.current = s; // immediate sync
    setSource(s);
    clearMeans();
  }, [clearMeans]);

  const handleRunPause = useCallback(() => {
    setIsRunning(r => !r);
  }, []);

  const handleReset = useCallback(() => {
    clearMeans();
  }, [clearMeans]);

  /* ─── Tips config ────────────────────────────────────────────────────────── */
  const CLT_TIPS = [
    {
      text: "Pick 'Skewed' as your source, set n=2, and press Run. Watch the right chart — it won't look normal yet.",
      accent: 'blue' as const,
      actionButton: undefined,
    },
    {
      text: "Now drag n up to 30 while it's running. Watch the right chart reshape in real time. This is the CLT happening live.",
      accent: 'amber' as const,
      actionButton: { label: 'Set n=30 →', onClick: () => setSampleSize(30) },
    },
    {
      text: "Try switching to Bimodal source and resetting. Two humps in, one bell curve out. The source shape doesn't matter — only n does.",
      accent: 'blue' as const,
      actionButton: undefined,
    },
  ];

  const nPct = ((sampleSize - 1) / 49) * 100;
  const sPct = ((speed - 50) / 450) * 100;

  return (
    <div className="flex flex-col gap-5 p-4">

      {/* Tips */}
      {CLT_TIPS.some((_, i) => unlocked.has(i)) && (
        <div className="flex flex-col gap-2">
          {CLT_TIPS.map((tip, i) => {
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

      {/* Source distribution pills */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400">Source distribution:</p>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map(s => (
            <Pill
              key={s}
              label={SOURCE_LABELS[s]}
              active={source === s}
              onClick={() => handleSource(s)}
            />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div ref={containerRef} className="w-full">
        <div className="flex gap-3 overflow-x-auto">
          <svg ref={leftSvgRef}  className="block shrink-0 overflow-visible" />
          <svg ref={rightSvgRef} className="block shrink-0 overflow-visible" />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4">

        {/* Sample size slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-gray-700">
              Sample size <span className="font-mono text-xs text-gray-500">(n)</span>
            </span>
            <span className="font-mono text-sm font-semibold text-blue-600">{sampleSize}</span>
          </div>
          <input
            type="range" min={1} max={50} step={1} value={sampleSize}
            onChange={e => {
              const v = parseInt(e.target.value);
              setSampleSize(v);
              sampleSizeRef.current = v;
            }}
            style={{ background: `linear-gradient(to right, #3b82f6 ${nPct}%, #e5e7eb ${nPct}%)` }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1</span><span>50</span>
          </div>
        </div>

        {/* Speed slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-gray-700">Sampling speed</span>
            <span className="font-mono text-sm font-semibold text-blue-600">{speed}ms</span>
          </div>
          <input
            type="range" min={50} max={500} step={10} value={speed}
            onChange={e => setSpeed(parseInt(e.target.value))}
            style={{ background: `linear-gradient(to right, #3b82f6 ${sPct}%, #e5e7eb ${sPct}%)` }}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Fast (50ms)</span><span>Slow (500ms)</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRunPause}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRunning ? 'Pause' : 'Run'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stats panel */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <StatCard label="Samples drawn"    value={samplesDrawn.toString()} />
        <StatCard label="Sample size n"    value={sampleSize.toString()} />
        <StatCard label="Mean of means"    value={fmt(momDisp, 4)}  sub="x̄̄" />
        <StatCard label="Std dev of means" value={fmt(sdomDisp, 4)} />
        <StatCard label="Expected σ/√n"    value={fmt(expectedStdError, 4)} />
      </div>

      {/* "Looks normal" badge */}
      {looksNormal && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <span className="text-green-600 font-semibold">✓</span>
          <span className="text-sm text-green-700 font-medium">Looks normal!</span>
          <span className="text-xs text-green-600">Skewness within 0.3 of zero</span>
        </div>
      )}

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
