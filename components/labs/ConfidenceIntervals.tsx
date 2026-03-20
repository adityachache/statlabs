'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { TipCard } from '@/components/TipCard';
import { useTips } from '@/lib/useTips';

// ─── Math helpers ─────────────────────────────────────────────────────────────

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const SIGMA = 15;
const Z_STAR: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };
type ConfLevel = 90 | 95 | 99;

interface CIResult {
  xbar: number;
  lower: number;
  upper: number;
  me: number;
  captured: boolean;
  id: number;
}

let _idGen = 0;

function computeCI(trueMean: number, n: number, cl: ConfLevel): CIResult {
  const sample = Array.from({ length: n }, () => randn() * SIGMA + trueMean);
  const xbar = sample.reduce((s, v) => s + v, 0) / n;
  const me = Z_STAR[cl] * SIGMA / Math.sqrt(n);
  return {
    xbar,
    lower: xbar - me,
    upper: xbar + me,
    me,
    captured: xbar - me <= trueMean && trueMean <= xbar + me,
    id: ++_idGen,
  };
}

// ─── Tips ─────────────────────────────────────────────────────────────────────

const TIPS = [
  {
    id: 0,
    text: "Press 'Draw new sample' several times. Watch the interval move — but the dashed line (true mean) stays fixed. Which one is random?",
    accent: 'blue' as const,
  },
  {
    id: 1,
    text: "Switch to 'The 95% guarantee' tab and draw 100 samples. Count the red bars. You should see roughly 5.",
    accent: 'amber' as const,
  },
  {
    id: 2,
    text: "The red bars aren't mistakes — they're expected. A method that's right 95% of the time will be wrong 5% of the time. That's the guarantee, not a flaw.",
    accent: 'blue' as const,
  },
];

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-base font-bold text-gray-800 leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Tab 1: Single CI chart ───────────────────────────────────────────────────

function BuildCIChart({ trueMean, ci, width }: { trueMean: number; ci: CIResult | null; width: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 100;
  const M = { top: 20, right: 16, bottom: 24, left: 16 };

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const W = width - M.left - M.right;
    const H2 = H - M.top - M.bottom;
    const lo = trueMean - 50;
    const hi = trueMean + 50;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
    const x = d3.scaleLinear().domain([lo, hi]).range([0, W]);
    const yMid = H2 / 2;

    // x axis
    g.append('g')
      .attr('transform', `translate(0,${H2})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(3))
      .call(ax => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call(ax => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));

    // True mean dashed line
    g.append('line')
      .attr('x1', x(trueMean)).attr('x2', x(trueMean))
      .attr('y1', -M.top + 2).attr('y2', H2)
      .attr('stroke', '#6b7280').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', x(trueMean)).attr('y', -M.top + 1)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'hanging')
      .attr('font-size', 9).attr('fill', '#6b7280')
      .text(`μ = ${trueMean}`);

    if (ci) {
      const color = ci.captured ? '#16a34a' : '#dc2626';
      const fill  = ci.captured ? '#bbf7d0' : '#fecaca';
      const lx = x(Math.max(ci.lower, lo));
      const rx = x(Math.min(ci.upper, hi));
      const bw = Math.max(0, rx - lx);

      g.append('rect').attr('x', lx).attr('y', yMid - 9).attr('width', bw).attr('height', 18).attr('fill', fill).attr('rx', 3);
      g.append('rect').attr('x', lx).attr('y', yMid - 9).attr('width', bw).attr('height', 18).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('rx', 3);

      // End caps
      for (const capX of [lx, lx + bw]) {
        if (capX < 0 || capX > W) continue;
        g.append('line').attr('x1', capX).attr('x2', capX).attr('y1', yMid - 13).attr('y2', yMid + 13).attr('stroke', color).attr('stroke-width', 1.5);
      }

      // Sample mean dot
      const dotX = x(ci.xbar);
      if (dotX >= 0 && dotX <= W) {
        g.append('circle').attr('cx', dotX).attr('cy', yMid).attr('r', 5).attr('fill', color);
      }
    } else {
      g.append('text')
        .attr('x', W / 2).attr('y', yMid)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', 12).attr('fill', '#d1d5db')
        .text("Press 'Draw new sample' to build your first CI");
    }
  }, [trueMean, ci, width]);

  return <svg ref={svgRef} />;
}

// ─── Tab 2: Stacked CI chart ──────────────────────────────────────────────────

function GuaranteeCIChart({ cis, trueMean, width }: { cis: CIResult[]; trueMean: number; width: number }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ROW_H = 12;
  const BAR_H = 6;
  const M = { top: 4, right: 12, bottom: 4, left: 12 };

  const EMPTY_H = 96;

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const W = width - M.left - M.right;
    const xDomain: [number, number] = [trueMean - 50, trueMean + 50];
    const x = d3.scaleLinear().domain(xDomain).range([0, W]);
    const muX = x(trueMean);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (cis.length === 0) {
      // Empty state: anchor line + label + instruction
      svg.attr('width', width).attr('height', EMPTY_H);
      const g = svg.append('g').attr('transform', `translate(${M.left},0)`);

      // Dashed anchor line spanning full height
      g.append('line')
        .attr('x1', muX).attr('x2', muX)
        .attr('y1', 20).attr('y2', EMPTY_H - 4)
        .attr('stroke', '#9ca3af').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

      // Label above the line
      g.append('text')
        .attr('x', muX).attr('y', 12)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', 9).attr('fill', '#6b7280')
        .text(`True mean μ = ${trueMean}`);

      // Instruction text centered
      g.append('text')
        .attr('x', W / 2).attr('y', EMPTY_H / 2 + 8)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', 12).attr('fill', '#d1d5db')
        .text('Draw samples to see the coverage pattern');
      return;
    }

    // Non-empty: full stacked chart
    const totalH = cis.length * ROW_H + M.top + M.bottom;
    svg.attr('width', width).attr('height', totalH);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    cis.forEach((ci, i) => {
      const ry    = i * ROW_H + (ROW_H - BAR_H) / 2;
      const color = ci.captured ? '#16a34a' : '#dc2626';
      const fill  = ci.captured ? '#bbf7d0' : '#fecaca';
      const lx    = x(Math.max(ci.lower, xDomain[0]));
      const rx    = x(Math.min(ci.upper, xDomain[1]));
      const bw    = Math.max(0, rx - lx);

      g.append('rect').attr('x', lx).attr('y', ry).attr('width', bw).attr('height', BAR_H).attr('fill', fill).attr('rx', 1.5);
      g.append('rect').attr('x', lx).attr('y', ry).attr('width', bw).attr('height', BAR_H).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 0.8).attr('rx', 1.5);

      const cx = x(ci.xbar);
      if (cx >= 0 && cx <= W) {
        g.append('circle').attr('cx', cx).attr('cy', i * ROW_H + ROW_H / 2).attr('r', 1.5).attr('fill', color);
      }
    });

    // True mean line + label, drawn last so it's on top of all bars
    g.append('line')
      .attr('x1', muX).attr('x2', muX)
      .attr('y1', -M.top).attr('y2', cis.length * ROW_H)
      .attr('stroke', '#374151').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', muX).attr('y', -M.top - 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'auto')
      .attr('font-size', 9).attr('fill', '#6b7280')
      .text(`True mean μ = ${trueMean}`);
  }, [cis, trueMean, width]);

  // Auto-scroll to bottom on new additions
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cis.length]);

  const totalH = cis.length > 0 ? cis.length * ROW_H + 8 : EMPTY_H;
  return (
    <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>
      <svg ref={svgRef} style={{ display: 'block' }} height={totalH} />
    </div>
  );
}

// ─── Tab 3: Misconception 1 — fixed CI, sliding true mean ────────────────────

function M1Chart({ width }: { width: number }) {
  const [muPos, setMuPos] = useState(65);
  const CI_LO = 44.1, CI_HI = 55.9, XBAR = 50;
  const DOM: [number, number] = [28, 72];
  const W = width, H = 68;
  const ML = 14, MR = 14, MT = 20, MB = 18;
  const chartW = W - ML - MR;
  const xs = (v: number) => ML + ((Math.max(DOM[0], Math.min(DOM[1], v)) - DOM[0]) / (DOM[1] - DOM[0])) * chartW;
  const yMid = MT + (H - MT - MB) / 2;
  const yAxis = H - MB;

  const inCI    = muPos >= CI_LO && muPos <= CI_HI;
  const barColor = inCI ? '#16a34a' : '#dc2626';
  const barFill  = inCI ? '#bbf7d0' : '#fecaca';
  const barX = xs(CI_LO), barW = xs(CI_HI) - xs(CI_LO);
  const muX  = xs(muPos);

  return (
    <div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <rect x={barX} y={yMid - 7} width={barW} height={14} fill={barFill} rx={2} />
        <rect x={barX} y={yMid - 7} width={barW} height={14} fill="none" stroke={barColor} strokeWidth={1.5} rx={2} />
        <line x1={barX}        y1={yMid - 11} x2={barX}        y2={yMid + 11} stroke={barColor} strokeWidth={1.5} />
        <line x1={barX + barW} y1={yMid - 11} x2={barX + barW} y2={yMid + 11} stroke={barColor} strokeWidth={1.5} />
        <circle cx={xs(XBAR)} cy={yMid} r={4} fill={barColor} />
        {/* Sliding true mean */}
        <line x1={muX} y1={MT - 14} x2={muX} y2={yAxis} stroke="#374151" strokeWidth={2} strokeDasharray="4,3" />
        <text x={muX} y={MT - 15} textAnchor="middle" dominantBaseline="auto" fontSize={9} fill="#6b7280">μ = {muPos}</text>
        {/* Axis */}
        <line x1={ML} y1={yAxis} x2={W - MR} y2={yAxis} stroke="#e5e7eb" />
        {[30, 40, 50, 60, 70].map(v => (
          <text key={v} x={xs(v)} y={yAxis + 11} textAnchor="middle" fontSize={9} fill="#9ca3af">{v}</text>
        ))}
      </svg>
      <input type="range" min={28} max={72} value={muPos} onChange={e => setMuPos(+e.target.value)} className="w-full accent-gray-400 mt-1" />
      <p className={`text-xs font-semibold mt-1 ${inCI ? 'text-green-600' : 'text-red-500'}`}>
        {inCI ? `✓ True mean is inside [${CI_LO}, ${CI_HI}]` : `✗ True mean is outside [${CI_LO}, ${CI_HI}]`}
      </p>
    </div>
  );
}

// ─── Tab 3: Misconception 2 — n=5 vs n=100 CIs ───────────────────────────────

function M2Chart({ width }: { width: number }) {
  const XBAR = 50;
  const me5   = 1.96 * SIGMA / Math.sqrt(5);
  const me100 = 1.96 * SIGMA / Math.sqrt(100);
  const DOM: [number, number] = [15, 85];
  const W = width, H = 84;
  const ML = 14, MR = 14, MT = 8, MB = 20;
  const chartW = W - ML - MR;
  const xs = (v: number) => ML + ((Math.max(DOM[0], Math.min(DOM[1], v)) - DOM[0]) / (DOM[1] - DOM[0])) * chartW;
  const yAxis = H - MB;

  const b5x = xs(XBAR - me5), b5w = xs(XBAR + me5) - xs(XBAR - me5);
  const b1x = xs(XBAR - me100), b1w = xs(XBAR + me100) - xs(XBAR - me100);

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {/* n=5 bar */}
      <rect x={b5x} y={MT + 4}  width={b5w} height={14} fill="#dbeafe" rx={2} />
      <rect x={b5x} y={MT + 4}  width={b5w} height={14} fill="none" stroke="#3b82f6" strokeWidth={1.5} rx={2} />
      <text x={b5x - 4} y={MT + 14} textAnchor="end" fontSize={10} fill="#3b82f6" fontWeight="500">n=5</text>
      <text x={b5x + b5w + 4} y={MT + 14} textAnchor="start" fontSize={9} fill="#9ca3af">±{me5.toFixed(1)}</text>
      {/* n=100 bar */}
      <rect x={b1x} y={MT + 32} width={b1w} height={14} fill="#fef9c3" rx={2} />
      <rect x={b1x} y={MT + 32} width={b1w} height={14} fill="none" stroke="#f59e0b" strokeWidth={1.5} rx={2} />
      <text x={b1x - 4} y={MT + 42} textAnchor="end" fontSize={10} fill="#d97706" fontWeight="500">n=100</text>
      <text x={b1x + b1w + 4} y={MT + 42} textAnchor="start" fontSize={9} fill="#9ca3af">±{me100.toFixed(1)}</text>
      {/* True mean */}
      <line x1={xs(50)} y1={MT} x2={xs(50)} y2={yAxis} stroke="#374151" strokeWidth={1.5} strokeDasharray="4,3" />
      {/* Axis */}
      <line x1={ML} y1={yAxis} x2={W - MR} y2={yAxis} stroke="#e5e7eb" />
      {[20, 30, 40, 50, 60, 70, 80].map(v => (
        <text key={v} x={xs(v)} y={yAxis + 11} textAnchor="middle" fontSize={9} fill="#9ca3af">{v}</text>
      ))}
    </svg>
  );
}

// ─── Tab 3: Misconception 3 — histogram + narrow CI ──────────────────────────

function M3Chart({ width }: { width: number }) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const sampleRef = useRef<number[]>([]);
  if (sampleRef.current.length === 0) {
    sampleRef.current = Array.from({ length: 50 }, () => randn() * SIGMA + 50);
  }

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const H = 120, M = { top: 22, right: 14, bottom: 24, left: 28 };
    const W  = width - M.left - M.right;
    const H2 = H - M.top - M.bottom;
    const sample = sampleRef.current;
    const xbar   = sample.reduce((s, v) => s + v, 0) / sample.length;
    const me     = 1.96 * SIGMA / Math.sqrt(sample.length);
    const ciLo   = xbar - me;
    const ciHi   = xbar + me;
    const predLo = xbar - 1.96 * SIGMA;
    const predHi = xbar + 1.96 * SIGMA;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    const xDomain: [number, number] = [0, 100];
    const x    = d3.scaleLinear().domain(xDomain).range([0, W]);
    const bins = d3.bin().domain(xDomain).thresholds(18)(sample);
    const maxC = d3.max(bins, b => b.length) ?? 1;
    const y    = d3.scaleLinear().domain([0, maxC]).range([H2, 0]).nice();

    // Prediction interval shading
    g.append('rect')
      .attr('x', x(Math.max(predLo, 0))).attr('y', 0)
      .attr('width', Math.max(0, x(Math.min(predHi, 100)) - x(Math.max(predLo, 0))))
      .attr('height', H2)
      .attr('fill', '#f3f4f6').attr('opacity', 0.8);

    // Histogram bars
    g.selectAll('.hbar')
      .data(bins)
      .join('rect')
      .attr('x', b => x(b.x0 ?? 0) + 0.5)
      .attr('width', b => Math.max(0, x(b.x1 ?? 0) - x(b.x0 ?? 0) - 1))
      .attr('y', b => y(b.length))
      .attr('height', b => H2 - y(b.length))
      .attr('fill', '#d1d5db');

    // CI for the mean
    const ciBarX = x(ciLo), ciBarW = Math.max(0, x(ciHi) - x(ciLo));
    const ciY    = H2 / 2;
    g.append('rect').attr('x', ciBarX).attr('y', ciY - 6).attr('width', ciBarW).attr('height', 12).attr('fill', '#3b82f6').attr('rx', 2);
    g.append('circle').attr('cx', x(xbar)).attr('cy', ciY).attr('r', 3.5).attr('fill', '#1d4ed8');

    // CI label
    g.append('text')
      .attr('x', x(xbar)).attr('y', ciY - 9)
      .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#1d4ed8')
      .text(`CI for x̄: [${ciLo.toFixed(0)}, ${ciHi.toFixed(0)}]`);

    // Prediction interval label
    g.append('text')
      .attr('x', W / 2).attr('y', -M.top + 2)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'hanging')
      .attr('font-size', 9).attr('fill', '#9ca3af')
      .text(`95% of data ≈ [${predLo.toFixed(0)}, ${predHi.toFixed(0)}]  |  CI for mean = [${ciLo.toFixed(0)}, ${ciHi.toFixed(0)}]`);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${H2})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(3))
      .call(ax => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call(ax => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));
    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(3))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));
  }, [width]);

  return <svg ref={svgRef} />;
}

// ─── Lab state ────────────────────────────────────────────────────────────────

export interface ConfidenceIntervalLabState {
  activeTab: 'build' | 'guarantee' | 'misconceptions';
  confidenceLevel: ConfLevel;
  sampleSize: number;
  samplesDrawn: number;
  captureCount: number;
  captureRate: number;
  lastCI: { lower: number; upper: number; captured: boolean } | null;
  trueMean: number;
  interpretation: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

type CITab = 'build' | 'guarantee' | 'misconceptions';

interface Props {
  onStateChange?: (s: ConfidenceIntervalLabState) => void;
}

export default function ConfidenceIntervals({ onStateChange }: Props) {
  const [tab, setTab] = useState<CITab>('build');

  // Shared controls
  const [trueMean,   setTrueMean]   = useState(50);
  const [sampleSize, setSampleSize] = useState(20);
  const [confLevel,  setConfLevel]  = useState<ConfLevel>(95);

  // Tab 1 state
  const [currentCI, setCurrentCI] = useState<CIResult | null>(null);
  const buildDrawCount = useRef(0);

  // Tab 2 state
  const [guaranteeCIs, setGuaranteeCIs] = useState<CIResult[]>([]);
  const animQueueRef = useRef<CIResult[]>([]);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset guarantee when key settings change
  useEffect(() => {
    setGuaranteeCIs([]);
    animQueueRef.current = [];
    if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
  }, [confLevel, sampleSize, trueMean]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (animTimerRef.current) clearInterval(animTimerRef.current); };
  }, []);

  // Container width
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(560);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setContainerW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // onStateChange ref — prevents infinite re-render loop
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  // Tips
  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip } = useTips('confidence-intervals');
  const unlockTipRef = useRef(unlockTip);
  useEffect(() => { unlockTipRef.current = unlockTip; }, [unlockTip]);
  useEffect(() => { unlockTipRef.current(0); }, []);

  // Tip 2: 60-second timer OR 20+ samples in Tab 2
  useEffect(() => {
    const t = setTimeout(() => unlockTipRef.current(2), 60_000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (guaranteeCIs.length >= 20) unlockTipRef.current(2);
  }, [guaranteeCIs.length]);

  // Derived values
  const captureCount = guaranteeCIs.filter(ci => ci.captured).length;
  const captureRate  = guaranteeCIs.length > 0 ? (captureCount / guaranteeCIs.length) * 100 : 0;
  const rateOk       = guaranteeCIs.length > 0 && Math.abs(captureRate - confLevel) <= 3;
  const rateColor    = guaranteeCIs.length === 0 ? 'text-gray-400' : rateOk ? 'text-green-600' : 'text-amber-500';

  // Lab state reporting
  useEffect(() => {
    const interp = tab === 'build'
      ? `building individual CIs, n=${sampleSize}, ${confLevel}% CI${currentCI ? `, last interval ${currentCI.captured ? 'captured' : 'missed'} the true mean` : ''}`
      : tab === 'guarantee'
      ? guaranteeCIs.length > 0
        ? `watching coverage simulation, ${captureCount}/${guaranteeCIs.length} intervals captured (${captureRate.toFixed(0)}%), confidence level=${confLevel}%`
        : `watching coverage simulation, no samples yet, confidence level=${confLevel}%`
      : 'exploring common misconceptions tab';

    onStateChangeRef.current?.({
      activeTab: tab,
      confidenceLevel: confLevel,
      sampleSize,
      samplesDrawn: tab === 'build' ? buildDrawCount.current : guaranteeCIs.length,
      captureCount,
      captureRate,
      lastCI: currentCI ? { lower: currentCI.lower, upper: currentCI.upper, captured: currentCI.captured } : null,
      trueMean,
      interpretation: interp,
    });
  }, [tab, trueMean, sampleSize, confLevel, currentCI, guaranteeCIs, captureCount, captureRate]);

  // Tab 1: draw one sample
  const handleBuildDraw = useCallback(() => {
    const ci = computeCI(trueMean, sampleSize, confLevel);
    setCurrentCI(ci);
    buildDrawCount.current += 1;
    if (buildDrawCount.current === 3) setTimeout(() => unlockTipRef.current(1), 400);
  }, [trueMean, sampleSize, confLevel]);

  // Tab 2: draw N samples with 80ms animation
  const handleGuaranteeDraw = useCallback((count: number) => {
    const newCIs = Array.from({ length: count }, () => computeCI(trueMean, sampleSize, confLevel));
    animQueueRef.current.push(...newCIs);
    if (animTimerRef.current !== null) return;
    animTimerRef.current = setInterval(() => {
      const next = animQueueRef.current.shift();
      if (!next) { clearInterval(animTimerRef.current!); animTimerRef.current = null; return; }
      setGuaranteeCIs(prev => [...prev, next]);
    }, 80);
  }, [trueMean, sampleSize, confLevel]);

  const confSelector = (onChange: (cl: ConfLevel) => void) => (
    <div className="flex gap-1">
      {([90, 95, 99] as ConfLevel[]).map(cl => (
        <button
          key={cl}
          onClick={() => onChange(cl)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            confLevel === cl ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          {cl}%
        </button>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className="space-y-5">
      {/* Tips */}
      <div className="space-y-2">
        {TIPS.filter(t => unlocked.has(t.id)).map(t => (
          <TipCard
            key={t.id}
            index={t.id}
            text={t.text}
            accent={t.accent}
            isDismissed={dismissed.has(t.id)}
            onDismiss={() => dismissTip(t.id)}
            onReopen={() => reopenTip(t.id)}
            actionButton={t.id === 1 ? { label: 'Go to guarantee →', onClick: () => setTab('guarantee') } : undefined}
          />
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { key: 'build',          label: 'Build a CI' },
          { key: 'guarantee',      label: 'The 95% guarantee' },
          { key: 'misconceptions', label: 'Common misconceptions' },
        ] as { key: CITab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-all ${
              tab === key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Build a CI ── */}
      {tab === 'build' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Draw a sample from a population with <strong>true mean μ</strong> (the dashed line). Your CI tries to capture it — but the interval moves with each sample.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                True mean (μ): <span className="font-semibold text-gray-700">{trueMean}</span>
              </label>
              <input type="range" min={0} max={100} step={1} value={trueMean}
                onChange={e => { setTrueMean(+e.target.value); setCurrentCI(null); buildDrawCount.current = 0; }}
                className="w-full accent-blue-500" />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                Sample size: <span className="font-semibold text-gray-700">n = {sampleSize}</span>
              </label>
              <input type="range" min={5} max={100} step={1} value={sampleSize}
                onChange={e => { setSampleSize(+e.target.value); setCurrentCI(null); buildDrawCount.current = 0; }}
                className="w-full accent-blue-500" />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>5</span><span>50</span><span>100</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-2">Confidence level</div>
            {confSelector(cl => { setConfLevel(cl); setCurrentCI(null); buildDrawCount.current = 0; })}
          </div>

          <button
            onClick={handleBuildDraw}
            className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Draw new sample
          </button>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <BuildCIChart trueMean={trueMean} ci={currentCI} width={containerW - 2} />
          </div>

          {currentCI && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Sample mean x̄" value={currentCI.xbar.toFixed(1)} sub={`true μ = ${trueMean}`} />
                <StatCard label="Margin of error" value={`±${currentCI.me.toFixed(1)}`} sub={`z* = ${Z_STAR[confLevel]}`} />
                <StatCard
                  label="Captured?"
                  value={currentCI.captured ? '✓ Yes' : '✗ No'}
                  sub={`[${currentCI.lower.toFixed(1)}, ${currentCI.upper.toFixed(1)}]`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="CI lower" value={currentCI.lower.toFixed(1)} />
                <StatCard label="CI upper" value={currentCI.upper.toFixed(1)} />
                <StatCard label="CI width" value={(currentCI.upper - currentCI.lower).toFixed(1)} />
              </div>
            </>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              The true mean (dashed line) is fixed. The interval moves with each sample — that&apos;s what&apos;s random.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab 2: The 95% guarantee ── */}
      {tab === 'guarantee' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Each row is one experiment. <span className="text-green-600 font-medium">Green</span> bars captured the true mean, <span className="text-red-500 font-medium">red</span> missed. Watch the percentage converge toward your confidence level.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                Sample size: <span className="font-semibold text-gray-700">n = {sampleSize}</span>
              </label>
              <input type="range" min={5} max={100} step={1} value={sampleSize}
                onChange={e => setSampleSize(+e.target.value)}
                className="w-full accent-blue-500" />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>5</span><span>50</span><span>100</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-2">Confidence level</div>
              {confSelector(setConfLevel)}
            </div>
          </div>

          {/* Live counter */}
          <div className={`text-center font-bold text-xl ${rateColor}`}>
            {guaranteeCIs.length === 0
              ? <span className="text-gray-300 text-sm font-normal">Draw samples to start</span>
              : `${captureCount} / ${guaranteeCIs.length} captured (${captureRate.toFixed(0)}%)`
            }
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={() => handleGuaranteeDraw(1)}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              Draw 1
            </button>
            <button onClick={() => handleGuaranteeDraw(20)}
              className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors">
              Draw 20
            </button>
            <button onClick={() => handleGuaranteeDraw(100)}
              className="flex-1 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition-colors">
              Draw 100
            </button>
            <button
              onClick={() => { setGuaranteeCIs([]); animQueueRef.current = []; if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; } }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
              Reset
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <GuaranteeCIChart cis={guaranteeCIs} trueMean={trueMean} width={containerW - 2} />
          </div>

          {guaranteeCIs.length >= 100 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-800 leading-relaxed">
              Out of {guaranteeCIs.length} intervals, ~{Math.round(guaranteeCIs.length * confLevel / 100)} should contain the true mean. You got {captureCount}. This IS what {confLevel}% confidence means.
            </div>
          )}

          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded-sm bg-green-300 inline-block" />Captured</span>
            <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded-sm bg-red-300 inline-block" />Missed</span>
            <span className="flex items-center gap-1.5"><span className="w-px h-3 border-l-2 border-dashed border-gray-600 inline-block" />True mean (μ = {trueMean})</span>
          </div>
        </div>
      )}

      {/* ── Tab 3: Common misconceptions ── */}
      {tab === 'misconceptions' && (
        <div className="space-y-5">
          {/* Misconception 1 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Myth</span>
              <p className="text-sm text-gray-700">&ldquo;There&apos;s a 95% chance the true mean is in this interval&rdquo;</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Reality</span>
              <p className="text-sm text-gray-600">The true mean is fixed — it&apos;s either in there or not. The 95% refers to the long-run behavior of the <em>method</em>, not this specific interval.</p>
            </div>
            <p className="text-xs text-gray-400">Drag μ — the CI stays fixed. The question is never &ldquo;where is the CI?&rdquo; — it&apos;s fixed. The true mean&apos;s position isn&apos;t probabilistic.</p>
            <div className="bg-gray-50 rounded-xl p-3">
              <M1Chart width={containerW - 56} />
            </div>
          </div>

          {/* Misconception 2 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Myth</span>
              <p className="text-sm text-gray-700">&ldquo;A wider CI is always worse&rdquo;</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Reality</span>
              <p className="text-sm text-gray-600">A wider CI reflects more honest uncertainty. A narrow CI from n=5 is overconfident. A wide CI from n=5 is being honest about what little data you have.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-400">Both are 95% CIs centered at x̄=50 — different n, different widths</p>
              <M2Chart width={containerW - 56} />
            </div>
          </div>

          {/* Misconception 3 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Myth</span>
              <p className="text-sm text-gray-700">&ldquo;95% CI means 95% of the data falls in this range&rdquo;</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Reality</span>
              <p className="text-sm text-gray-600">The CI is about the <em>mean</em>, not individual data points. The range containing 95% of data is a <em>prediction interval</em> — much wider.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-400">Gray bars = all data. Light shading = 95% prediction interval. Blue bar = CI for the mean.</p>
              <M3Chart width={containerW - 56} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
