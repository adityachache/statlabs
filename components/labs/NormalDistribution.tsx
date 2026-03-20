'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TipCard } from '@/components/TipCard';
import { useTips } from '@/lib/useTips';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface NormalLabState {
  mean: number;
  stdDev: number;
  variance: number;
  peakDensity: number;
  activePreset: string | null;
  sixtyEightPctRange: [number, number];
  ninetyFivePctRange: [number, number];
  interpretation: string;
}

interface Props {
  onStateChange?: (state: NormalLabState) => void;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const N_POINTS = 500;
const X_MIN = -6;
const X_MAX = 6;
const MARGIN = { top: 24, right: 24, bottom: 40, left: 44 };
const CHART_H = 280;
const TRANSITION_MS = 220;
const LAB_SLUG = 'normal-distribution';

const PRESETS = [
  { label: 'Human heights', mean: 0, stdDev: 1 },
  { label: 'Exam scores', mean: 1, stdDev: 0.5 },
  { label: 'Very uncertain', mean: 0, stdDev: 2.5 },
] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function normalPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

const XS: number[] = Array.from(
  { length: N_POINTS },
  (_, i) => X_MIN + (i / (N_POINTS - 1)) * (X_MAX - X_MIN)
);

function getActivePreset(mean: number, stdDev: number): string | null {
  for (const p of PRESETS) {
    if (Math.abs(p.mean - mean) < 0.001 && Math.abs(p.stdDev - stdDev) < 0.001) {
      return p.label;
    }
  }
  return null;
}

function fmt(n: number, dp = 3): string {
  return n.toFixed(dp);
}

/* ─── Slider ─────────────────────────────────────────────────────────────── */

interface SliderProps {
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function Slider({ label, symbol, value, min, max, step, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-gray-700">
          {label} <span className="font-mono text-xs text-gray-500">({symbol})</span>
        </span>
        <span className="font-mono text-sm font-semibold text-blue-600">{fmt(value, 2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ background: `linear-gradient(to right, #3b82f6 ${pct}%, #e5e7eb ${pct}%)` }}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────── */

interface StatCardProps {
  label: string; value: string; sub?: string; className?: string;
}

function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div className={`${className ?? 'flex-1 min-w-0'} bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100`}>
      <div className="text-xs text-gray-500 truncate">{label}</div>
      <div className="font-mono text-sm font-bold text-gray-800 mt-0.5 break-all leading-tight">{value}</div>
      {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}
    </div>
  );
}

/* ─── D3 refs ────────────────────────────────────────────────────────────── */

interface D3Refs {
  area1: d3.Selection<SVGPathElement, unknown, null, undefined>;
  area2: d3.Selection<SVGPathElement, unknown, null, undefined>;
  line: d3.Selection<SVGPathElement, unknown, null, undefined>;
  yAxis: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function NormalDistribution({ onStateChange }: Props) {
  const [mean, setMean] = useState(0);
  const [stdDev, setStdDev] = useState(1);
  const [chartWidth, setChartWidth] = useState(600);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const d3Refs = useRef<D3Refs | null>(null);
  const freshRef = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  const sliderMovedRef = useRef(false);

  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  // ── Tips ──────────────────────────────────────────────────────────────────
  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip, resetTips } = useTips(LAB_SLUG);

  // Tip 2: 45-second timer fallback
  useEffect(() => {
    if (unlocked.has(2)) return;
    const t = setTimeout(() => unlockTip(2), 45_000);
    return () => clearTimeout(t);
  }, [unlocked, unlockTip]);

  // ── Derived values ────────────────────────────────────────────────────────
  const variance = parseFloat((stdDev * stdDev).toFixed(6));
  const activePreset = getActivePreset(mean, stdDev);
  const peakDensity = normalPdf(mean, mean, stdDev);
  const range68 = { lo: mean - stdDev, hi: mean + stdDev };
  const range95 = { lo: mean - 2 * stdDev, hi: mean + 2 * stdDev };

  const interpretation =
    stdDev < 0.6 ? 'very narrow, tall curve — high certainty / low spread' :
    stdDev < 1.2 ? 'moderate spread — typical distribution' :
    stdDev < 2.0 ? 'wide, flat curve — high uncertainty / large spread' :
                   'very wide, nearly flat — very high uncertainty';

  // Notify parent
  useEffect(() => {
    onStateChangeRef.current?.({
      mean, stdDev, variance, peakDensity, activePreset,
      sixtyEightPctRange: [range68.lo, range68.hi],
      ninetyFivePctRange: [range95.lo, range95.hi],
      interpretation,
    });
  }, [mean, stdDev, variance, peakDensity, activePreset, range68.lo, range68.hi, range95.lo, range95.hi, interpretation]);

  // ── Effect 1: build SVG structure ────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const W = chartWidth;
    const totalH = CHART_H + MARGIN.top + MARGIN.bottom;

    const xScale = d3.scaleLinear().domain([X_MIN, X_MAX]).range([0, W]);
    const yScale = d3.scaleLinear().domain([0, 0.85]).range([CHART_H, 0]).nice();

    const svg = d3.select(svgRef.current)
      .attr('width', W + MARGIN.left + MARGIN.right)
      .attr('height', totalH);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-W).tickFormat(() => ''))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('line').attr('stroke', '#f0f0f0').attr('stroke-dasharray', '3,3'));

    const area2 = g.append('path').attr('fill', '#bfdbfe').attr('opacity', 0.5);
    const area1 = g.append('path').attr('fill', '#93c5fd').attr('opacity', 0.65);
    const line  = g.append('path').attr('fill', 'none').attr('stroke', '#2563eb')
      .attr('stroke-width', 2.5).attr('stroke-linejoin', 'round');

    g.append('g')
      .attr('transform', `translate(0,${CHART_H})`)
      .call(d3.axisBottom(xScale).ticks(12))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11));

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11));

    g.append('text')
      .attr('x', W / 2).attr('y', CHART_H + MARGIN.bottom - 4)
      .attr('text-anchor', 'middle').attr('fill', '#6b7280').attr('font-size', 12)
      .text('x');

    d3Refs.current = { area1, area2, line, yAxis, xScale, yScale };
    freshRef.current = true;
  }, [chartWidth]);

  // ── Effect 2: update data with transitions ────────────────────────────────
  useEffect(() => {
    const refs = d3Refs.current;
    if (!refs) return;
    const { area1, area2, line, yAxis, xScale, yScale } = refs;

    const ys: number[] = XS.map(x => normalPdf(x, mean, stdDev));
    const peakY = Math.max(...ys);
    yScale.domain([0, peakY * 1.18]);

    const areaGen2 = d3.area<number>()
      .x((_, i) => xScale(XS[i])).y0(CHART_H)
      .y1((d, i) => XS[i] >= range95.lo && XS[i] <= range95.hi ? yScale(d) : CHART_H)
      .curve(d3.curveBasis);

    const areaGen1 = d3.area<number>()
      .x((_, i) => xScale(XS[i])).y0(CHART_H)
      .y1((d, i) => XS[i] >= range68.lo && XS[i] <= range68.hi ? yScale(d) : CHART_H)
      .curve(d3.curveBasis);

    const lineGen = d3.line<number>()
      .x((_, i) => xScale(XS[i])).y(d => yScale(d)).curve(d3.curveBasis);

    const path2 = areaGen2(ys) ?? '';
    const path1 = areaGen1(ys) ?? '';
    const pathLine = lineGen(ys) ?? '';

    if (freshRef.current) {
      area2.attr('d', path2); area1.attr('d', path1); line.attr('d', pathLine);
      freshRef.current = false;
    } else {
      const t = d3.transition().duration(TRANSITION_MS).ease(d3.easeCubicOut);
      area2.transition(t).attr('d', path2);
      area1.transition(t).attr('d', path1);
      line.transition(t).attr('d', pathLine);
    }

    yAxis.call(d3.axisLeft(yScale).ticks(5))
      .call(s => s.select('.domain').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11));
  }, [mean, stdDev, chartWidth, range68.lo, range68.hi, range95.lo, range95.hi]);

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 600;
      setChartWidth(Math.max(240, w - MARGIN.left - MARGIN.right));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSliderChange = useCallback((setter: (v: number) => void) => (v: number) => {
    setter(v);
    if (!sliderMovedRef.current) {
      sliderMovedRef.current = true;
      unlockTip(1);
    }
  }, [unlockTip]);

  const handlePreset = useCallback((preset: typeof PRESETS[number]) => {
    setMean(preset.mean);
    setStdDev(preset.stdDev);
    unlockTip(2);
  }, [unlockTip]);

  // ── Tips config ───────────────────────────────────────────────────────────
  const TIPS = [
    {
      text: "This curve never touches zero — even a value 6σ away has some probability. Drag σ and watch what happens to the tails.",
      accent: 'blue' as const,
    },
    {
      text: "Notice the curve getting taller as it narrows? The total area always equals exactly 1.0 — it's a probability budget being redistributed. Watch the Peak density card as you drag σ.",
      accent: 'amber' as const,
      actionButton: { label: 'See it narrow →', onClick: () => setStdDev(0.4) },
    },
    {
      text: "Why does this shape appear everywhere — heights, errors, test scores? Because when many independent random things add up, their sum always approaches this curve. That's the Central Limit Theorem.",
      accent: 'blue' as const,
    },
  ];

  const visibleTips = TIPS.filter((_, i) => unlocked.has(i));
  const hasDismissedDots = TIPS.some((_, i) => unlocked.has(i) && dismissed.has(i));

  return (
    <div className="flex flex-col gap-5 p-4 h-full">

      {/* Tips section */}
      {visibleTips.length > 0 && (
        <div className="flex flex-col gap-2">
          {TIPS.map((tip, i) => {
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

      {/* Preset pills */}
      <p className="text-xs text-gray-400">Try a real-world example:</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activePreset === p.label
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-5 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Slider
          label="Mean" symbol="μ" value={mean} min={-3} max={3} step={0.1}
          onChange={handleSliderChange(setMean)}
        />
        <Slider
          label="Std Dev" symbol="σ" value={stdDev} min={0.3} max={3} step={0.1}
          onChange={handleSliderChange(setStdDev)}
        />
      </div>

      {/* Stats panel */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <StatCard label="Mean (μ)" value={fmt(mean, 2)} />
        <StatCard label="Std Dev (σ)" value={fmt(stdDev, 2)} />
        <StatCard label="Variance (σ²)" value={fmt(variance, 3)} />
        <StatCard label="Peak density" value={fmt(peakDensity, 4)} />
        <StatCard
          label="68% range"
          value={`${fmt(range68.lo, 2)} – ${fmt(range68.hi, 2)}`}
          sub="±1σ" className="flex-1 min-w-[120px]"
        />
        <StatCard
          label="95% range"
          value={`${fmt(range95.lo, 2)} – ${fmt(range95.hi, 2)}`}
          sub="±2σ" className="flex-1 min-w-[120px]"
        />
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
