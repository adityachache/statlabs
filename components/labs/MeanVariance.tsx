'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TipCard } from '@/components/TipCard';
import { useTips } from '@/lib/useTips';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type MVTab = 'explore' | 'outlier' | 'spread';

export interface MeanVarianceLabState {
  points: number[];
  mean: number;
  median: number;
  variance: number;
  stdDev: number;
  n: number;
  activeTab: MVTab;
  interpretation: string;
}

interface Props {
  onStateChange?: (s: MeanVarianceLabState) => void;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const LAB_SLUG   = 'mean-variance';
const X_MIN      = 0;
const X_MAX      = 100;
const CHART_H       = 120;   // Explore tab (needs room for distance lines)
const CHART_H_SMALL = 80;    // Outlier + Spread tabs (simple dot plots)
const MARGIN        = { top: 32, right: 20, bottom: 28, left: 20 };
const DOT_R      = 9;
const MAX_POINTS = 12;
const MIN_POINTS = 3;

const DEFAULT_POINTS = [25, 38, 50, 55, 62, 75];

/* ─── Stats helpers ──────────────────────────────────────────────────────── */

function calcMean(pts: number[]): number {
  return pts.reduce((s, x) => s + x, 0) / pts.length;
}
function calcMedian(pts: number[]): number {
  const s = [...pts].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
function calcVariance(pts: number[], m: number): number {
  return pts.reduce((s, x) => s + (x - m) ** 2, 0) / pts.length;
}
function fmt(n: number, dp = 2): string {
  return isNaN(n) ? '—' : n.toFixed(dp);
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatCard({
  label, value, sub,
}: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2 text-center border border-gray-100">
      <div className="text-xs text-gray-500 truncate">{label}</div>
      <div className="font-mono text-sm font-bold text-gray-800 mt-0.5 break-all leading-tight">{value}</div>
      {sub && <div className="text-gray-400 mt-0.5 leading-tight" style={{ fontSize: '10px' }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Explore dot plot (D3, fully interactive) ───────────────────────────── */

interface ExplorePlotProps {
  points: number[];
  onChange: (pts: number[]) => void;
  onFirstDrag: () => void;
}

function ExplorePlot({ points, onChange, onFirstDrag }: ExplorePlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const ptsRef       = useRef<number[]>(points);
  const draggedRef   = useRef(false);
  const onChangeRef  = useRef(onChange);
  const onFirstRef   = useRef(onFirstDrag);
  const hasDraggedRef = useRef(false);
  const [width, setWidth] = useState(560);

  useEffect(() => { ptsRef.current = points; }, [points]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onFirstRef.current = onFirstDrag; }, [onFirstDrag]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(e => setWidth(Math.max(280, e[0]?.contentRect.width ?? 560)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const W = width;
    const totalH = CHART_H + MARGIN.top + MARGIN.bottom;
    const innerW = W - MARGIN.left - MARGIN.right;

    const xSc = d3.scaleLinear().domain([X_MIN, X_MAX]).range([0, innerW]);

    const svg = d3.select(svgRef.current)
      .attr('width', W).attr('height', totalH);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Background track
    g.append('rect')
      .attr('x', 0).attr('y', CHART_H / 2 - 3)
      .attr('width', innerW).attr('height', 6)
      .attr('rx', 3).attr('fill', '#e5e7eb');

    // X axis ticks
    g.append('g').attr('transform', `translate(0,${CHART_H})`)
      .call(d3.axisBottom(xSc).ticks(10).tickSize(4))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#9ca3af').attr('font-size', 10));

    // ±1σ band — a single horizontal rect updated imperatively
    const bandEl = g.append('rect')
      .attr('y', CHART_H / 2 - 10).attr('height', 20)
      .attr('fill', '#bfdbfe').attr('opacity', 0.4);

    // Distance lines (variance visualisation)
    const distG = g.append('g').attr('class', 'dist-lines');

    // Mean line + triangle
    const meanG = g.append('g').attr('class', 'mean-indicator');
    meanG.append('line')
      .attr('class', 'mean-line')
      .attr('y1', 4).attr('y2', CHART_H - 4)
      .attr('stroke', '#2563eb').attr('stroke-width', 2);
    meanG.append('polygon')
      .attr('class', 'mean-tri')
      .attr('fill', '#2563eb');
    meanG.append('text')
      .attr('class', 'mean-label')
      .attr('text-anchor', 'middle')
      .attr('fill', '#2563eb').attr('font-size', 10).attr('font-weight', 600)
      .attr('y', -4);

    // Click-to-add on track (transparent overlay)
    g.append('rect')
      .attr('x', 0).attr('y', CHART_H / 2 - 20)
      .attr('width', innerW).attr('height', 40)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('click', (event: MouseEvent) => {
        if (draggedRef.current) { draggedRef.current = false; return; }
        if (ptsRef.current.length >= MAX_POINTS) return;
        const [mx] = d3.pointer(event);
        const val = Math.round(Math.max(X_MIN, Math.min(X_MAX, xSc.invert(mx))));
        const next = [...ptsRef.current, val];
        ptsRef.current = next;
        onChangeRef.current(next);
      });

    // Dots group (drawn on top)
    const dotsG = g.append('g');

    function redraw() {
      const pts = ptsRef.current;
      const m = calcMean(pts);
      const v = calcVariance(pts, m);
      const sd = Math.sqrt(v);

      // Std dev band
      bandEl
        .attr('x', xSc(Math.max(X_MIN, m - sd)))
        .attr('width', xSc(Math.min(X_MAX, m + sd)) - xSc(Math.max(X_MIN, m - sd)));

      // Mean indicator
      const mx = xSc(m);
      meanG.select<SVGLineElement>('.mean-line')
        .attr('x1', mx).attr('x2', mx);
      meanG.select<SVGPolygonElement>('.mean-tri')
        .attr('points', `${mx - 5},${CHART_H + 4} ${mx + 5},${CHART_H + 4} ${mx},${CHART_H - 3}`);
      meanG.select<SVGTextElement>('.mean-label')
        .attr('x', mx).text(`x̄=${fmt(m, 1)}`);

      // Distance lines
      distG.selectAll('*').remove();
      const maxSqD = Math.max(...pts.map(x => (x - m) ** 2), 1);
      pts.forEach(x => {
        const sqd = (x - m) ** 2;
        const thick = Math.max(1, (sqd / maxSqD) * 5);
        distG.append('line')
          .attr('x1', xSc(x)).attr('x2', mx)
          .attr('y1', CHART_H / 2).attr('y2', CHART_H / 2)
          .attr('stroke', '#f97316').attr('stroke-width', thick)
          .attr('opacity', 0.4 + (sqd / maxSqD) * 0.5);
      });

      // Render dots — all on the same horizontal center line
      const dotSel = dotsG.selectAll<SVGCircleElement, { v: number; i: number }>('circle')
        .data(pts.map((v, i) => ({ v, i })), d => String(d.i));

      dotSel.join(
        enter => enter.append('circle')
          .attr('r', DOT_R)
          .attr('fill', '#3b82f6').attr('stroke', '#fff').attr('stroke-width', 2.5)
          .style('cursor', 'ew-resize')
          .call(d3.drag<SVGCircleElement, { v: number; i: number }>()
            .on('start', function () {
              d3.select(this).attr('fill', '#1d4ed8');
            })
            .on('drag', function (event, d) {
              draggedRef.current = true;
              if (!hasDraggedRef.current) {
                hasDraggedRef.current = true;
                onFirstRef.current();
              }
              const val = Math.round(Math.max(X_MIN, Math.min(X_MAX, xSc.invert(event.x))));
              ptsRef.current = ptsRef.current.map((p, j) => j === d.i ? val : p);
              onChangeRef.current([...ptsRef.current]);
              redraw();
            })
            .on('end', function () {
              d3.select(this).attr('fill', '#3b82f6');
            })
          )
          .on('dblclick', (_, d) => {
            if (ptsRef.current.length <= MIN_POINTS) return;
            const next = ptsRef.current.filter((_, j) => j !== d.i);
            ptsRef.current = next;
            onChangeRef.current(next);
            redraw();
          }),
        update => update,
        exit => exit.remove(),
      )
        .attr('cx', d => xSc(d.v))
        .attr('cy', CHART_H / 2);
    }

    ptsRef.current = points;
    redraw();

    // Expose redraw so parent state changes re-render
    (svgRef.current as SVGSVGElement & { _redraw?: () => void })._redraw = redraw;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  // Re-render when points change from outside (e.g. "Add outlier" tip)
  useEffect(() => {
    ptsRef.current = points;
    const el = svgRef.current as (SVGSVGElement & { _redraw?: () => void }) | null;
    el?._redraw?.();
  }, [points]);

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="block overflow-visible" />
      <p className="text-xs text-gray-400 mt-1 text-center">
        Click line to add point · Double-click point to remove
      </p>
    </div>
  );
}

/* ─── Locked comparison plot (static D3) ─────────────────────────────────── */

interface CompPlotProps {
  points: number[];
  label: string;
  showMedian?: boolean;
  meanColor?: string;
  medianColor?: string;
  width: number;
}

function CompPlot({ points, label, showMedian = true, meanColor = '#2563eb', medianColor = '#16a34a', width }: CompPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const innerW = width - MARGIN.left - MARGIN.right;
    const h = CHART_H_SMALL;
    const totalH = h + MARGIN.top + MARGIN.bottom;
    const xSc = d3.scaleLinear().domain([X_MIN, X_MAX]).range([0, innerW]);

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', totalH);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Track
    g.append('rect')
      .attr('x', 0).attr('y', h / 2 - 3).attr('width', innerW).attr('height', 6)
      .attr('rx', 3).attr('fill', '#e5e7eb');

    // Axis
    g.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xSc).ticks(5).tickSize(3))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#9ca3af').attr('font-size', 9));

    const m = calcMean(points);
    const med = calcMedian(points);

    // Dots — all on the horizontal center line
    g.selectAll('circle').data(points.map((v, i) => ({ v, i }))).join('circle')
      .attr('cx', d => xSc(d.v)).attr('cy', h / 2)
      .attr('r', DOT_R - 1).attr('fill', '#93c5fd').attr('stroke', '#fff').attr('stroke-width', 2);

    // Mean line
    const drawVLine = (val: number, color: string, labelTxt: string, labelY: number) => {
      const x = xSc(val);
      g.append('line').attr('x1', x).attr('x2', x).attr('y1', 2).attr('y2', h - 2)
        .attr('stroke', color).attr('stroke-width', 2.5);
      g.append('text').attr('x', x).attr('y', labelY)
        .attr('text-anchor', 'middle').attr('fill', color)
        .attr('font-size', 9).attr('font-weight', 700)
        .text(`${labelTxt}=${fmt(val, 1)}`);
    };

    drawVLine(m, meanColor, 'x̄', -4);
    if (showMedian) drawVLine(med, medianColor, 'med', h + MARGIN.bottom - 4);

    // Label
    g.append('text').attr('x', innerW / 2).attr('y', -16)
      .attr('text-anchor', 'middle').attr('fill', '#374151')
      .attr('font-size', 11).attr('font-weight', 600).text(label);
  }, [points, width, label, showMedian, meanColor, medianColor]);

  return <svg ref={svgRef} className="block overflow-visible shrink-0" />;
}

/* ─── Spread plot (draggable, constrained to mean=50) ───────────────────── */

interface SpreadPlotProps {
  points: number[];
  onChange: (pts: number[]) => void;
  label: string;
  width: number;
}

function SpreadPlot({ points, onChange, label, width }: SpreadPlotProps) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const ptsRef    = useRef<number[]>(points);
  const onChgRef  = useRef(onChange);

  useEffect(() => { ptsRef.current = points; }, [points]);
  useEffect(() => { onChgRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!svgRef.current) return;
    const innerW = width - MARGIN.left - MARGIN.right;
    const h = CHART_H_SMALL;
    const totalH = h + MARGIN.top + MARGIN.bottom;
    const xSc = d3.scaleLinear().domain([X_MIN, X_MAX]).range([0, innerW]);

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', totalH);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Track
    g.append('rect')
      .attr('x', 0).attr('y', h / 2 - 3).attr('width', innerW).attr('height', 6)
      .attr('rx', 3).attr('fill', '#e5e7eb');

    g.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xSc).ticks(5).tickSize(3))
      .call(s => s.select('.domain').remove())
      .call(s => s.selectAll('.tick line').attr('stroke', '#d1d5db'))
      .call(s => s.selectAll('text').attr('fill', '#9ca3af').attr('font-size', 9));

    const meanG  = g.append('g');
    const varText = g.append('text')
      .attr('x', innerW / 2).attr('y', -16)
      .attr('text-anchor', 'middle').attr('fill', '#374151')
      .attr('font-size', 11).attr('font-weight', 600);
    const dotsG  = g.append('g');

    function redraw() {
      const pts = ptsRef.current;
      const m = calcMean(pts);
      const v = calcVariance(pts, m);

      meanG.selectAll('*').remove();
      const mx = xSc(m);
      meanG.append('line').attr('x1', mx).attr('x2', mx).attr('y1', 2).attr('y2', h - 2)
        .attr('stroke', '#2563eb').attr('stroke-width', 2);
      meanG.append('text').attr('x', mx).attr('y', -4)
        .attr('text-anchor', 'middle').attr('fill', '#2563eb')
        .attr('font-size', 9).attr('font-weight', 700).text(`x̄=50`);

      varText.text(`${label}  |  σ²=${fmt(v, 0)}`);

      // Dots — all on the horizontal center line
      dotsG.selectAll<SVGCircleElement, { v: number; i: number }>('circle')
        .data(pts.map((v, i) => ({ v, i })), d => String(d.i))
        .join(
          enter => enter.append('circle')
            .attr('r', DOT_R).attr('fill', '#3b82f6').attr('stroke', '#fff').attr('stroke-width', 2.5)
            .style('cursor', 'ew-resize')
            .call(d3.drag<SVGCircleElement, { v: number; i: number }>()
              .on('drag', function (event, d) {
                const raw = Math.max(1, Math.min(99, Math.round(xSc.invert(event.x))));
                const oldVal = ptsRef.current[d.i];
                const delta = raw - oldVal;
                if (delta === 0) return;
                const n = ptsRef.current.length;
                const adj = -delta / (n - 1);
                const next = ptsRef.current.map((p, j) =>
                  j === d.i ? raw : Math.max(1, Math.min(99, p + adj))
                );
                ptsRef.current = next;
                onChgRef.current([...next]);
                redraw();
              })
            ),
          update => update,
          exit => exit.remove(),
        )
        .attr('cx', d => xSc(d.v))
        .attr('cy', h / 2);
    }

    ptsRef.current = points;
    redraw();
    (svgRef.current as SVGSVGElement & { _redraw?: () => void })._redraw = redraw;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, label]);

  useEffect(() => {
    ptsRef.current = points;
    const el = svgRef.current as (SVGSVGElement & { _redraw?: () => void }) | null;
    el?._redraw?.();
  }, [points]);

  return <svg ref={svgRef} className="block overflow-visible shrink-0" />;
}

/* ─── Outlier data ───────────────────────────────────────────────────────── */
const OUTLIER_BASE = [42, 46, 50, 52, 55, 58, 61];
const OUTLIER_WITH = [42, 46, 50, 52, 55, 58, 95];

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function MeanVariance({ onStateChange }: Props) {
  const [points, setPoints]       = useState<number[]>(DEFAULT_POINTS);
  const [activeTab, setActiveTab] = useState<MVTab>('explore');
  const [containerW, setContainerW] = useState(560);

  // Spread tab state
  const [spreadA, setSpreadA] = useState<number[]>([40, 46, 50, 54, 60]);
  const [spreadB, setSpreadB] = useState<number[]>([10, 30, 50, 70, 90]);

  const containerRef    = useRef<HTMLDivElement>(null);
  const onStateChgRef   = useRef(onStateChange);
  const tabSwitchedRef  = useRef(false);
  const tip2TimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onStateChgRef.current = onStateChange; }, [onStateChange]);

  // Tips
  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip, resetTips } = useTips(LAB_SLUG);

  // Tip 2: 40-second timer fallback
  useEffect(() => {
    if (unlocked.has(2)) return;
    tip2TimerRef.current = setTimeout(() => unlockTip(2), 40_000);
    return () => { if (tip2TimerRef.current) clearTimeout(tip2TimerRef.current); };
  }, [unlocked, unlockTip]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(e => setContainerW(Math.max(280, e[0]?.contentRect.width ?? 560)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Computed stats
  const m   = calcMean(points);
  const med = calcMedian(points);
  const v   = calcVariance(points, m);
  const sd  = Math.sqrt(v);
  const sorted = [...points].sort((a, b) => a - b);
  const range = sorted[sorted.length - 1] - sorted[0];

  // Outlier tab stats
  const mBase = calcMean(OUTLIER_BASE);
  const mWith = calcMean(OUTLIER_WITH);
  const medBase = calcMedian(OUTLIER_BASE);
  const medWith = calcMedian(OUTLIER_WITH);

  // Spread tab stats
  const vA = calcVariance(spreadA, 50);
  const vB = calcVariance(spreadB, 50);
  const varDiff = Math.abs(vA - vB);

  // Interpretation
  const interpretation: string = (() => {
    if (activeTab === 'outlier') {
      return `viewing outlier effect — mean shifted ${fmt(Math.abs(mWith - mBase), 1)} points, median shifted only ${fmt(Math.abs(medWith - medBase), 1)}`;
    }
    if (activeTab === 'spread') {
      return `comparing same-mean datasets, variance difference = ${fmt(varDiff, 0)}`;
    }
    return `exploring freely, ${points.length} points, mean=${fmt(m, 1)}, ${v > 300 ? 'high' : v > 100 ? 'moderate' : 'low'} variance=${fmt(v, 0)}`;
  })();

  // Notify parent
  useEffect(() => {
    onStateChgRef.current?.({
      points, mean: m, median: med, variance: v, stdDev: sd,
      n: points.length, activeTab, interpretation,
    });
  }, [points, m, med, v, sd, activeTab, interpretation]);

  const handleFirstDrag = useCallback(() => {
    unlockTip(1);
  }, [unlockTip]);

  const handleTabChange = useCallback((tab: MVTab) => {
    setActiveTab(tab);
    if (!tabSwitchedRef.current) {
      tabSwitchedRef.current = true;
      unlockTip(2);
    }
  }, [unlockTip]);

  const handleAddOutlier = useCallback(() => {
    setPoints(prev => prev.length < MAX_POINTS ? [...prev, 90] : prev);
  }, []);

  // Tips
  const MV_TIPS = [
    {
      text: 'Drag any point toward the edges. Watch the mean line chase it. The mean is a balance point — every point pulls it.',
      accent: 'blue' as const,
      actionButton: undefined,
    },
    {
      text: 'Now drag one point far to the right — past 80. Watch how much the mean moves vs the median. Which one is more honest about where the data is?',
      accent: 'amber' as const,
      actionButton: { label: 'Add outlier →', onClick: handleAddOutlier },
    },
    {
      text: "Switch to 'Same mean, ≠ spread' tab. Two datasets with identical means can look completely different. This is why reporting just the mean is often misleading.",
      accent: 'blue' as const,
      actionButton: { label: 'Go to tab →', onClick: () => handleTabChange('spread') },
    },
  ];

  const halfW = Math.max(140, Math.floor((containerW - 16) / 2));

  return (
    <div className="flex flex-col gap-5 p-4">

      {/* Tips */}
      {MV_TIPS.some((_, i) => unlocked.has(i)) && (
        <div className="flex flex-col gap-2">
          {MV_TIPS.map((tip, i) => {
            if (!unlocked.has(i)) return null;
            return (
              <TipCard
                key={i} index={i} text={tip.text} accent={tip.accent}
                isDismissed={dismissed.has(i)}
                actionButton={tip.actionButton}
                onDismiss={() => dismissTip(i)}
                onReopen={() => reopenTip(i)}
              />
            );
          })}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-full p-1 self-start">
        <TabBtn label="Explore"            active={activeTab === 'explore'} onClick={() => handleTabChange('explore')} />
        <TabBtn label="Outlier effect"     active={activeTab === 'outlier'} onClick={() => handleTabChange('outlier')} />
        <TabBtn label="Same mean, ≠ spread" active={activeTab === 'spread'}  onClick={() => handleTabChange('spread')} />
      </div>

      {/* ── Tab: Explore ── */}
      {activeTab === 'explore' && (
        <>
          <div ref={containerRef} className="w-full">
            <ExplorePlot
              points={points}
              onChange={setPoints}
              onFirstDrag={handleFirstDrag}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <StatCard label="n"        value={String(points.length)} />
            <StatCard label="Mean (x̄)"  value={fmt(m, 2)} />
            <StatCard label="Median"   value={fmt(med, 2)} />
            <StatCard label="Variance (σ²)" value={fmt(v, 1)} sub="avg squared distance" />
            <StatCard label="Std Dev (σ)"   value={fmt(sd, 2)} />
            <StatCard label="Range"    value={fmt(range, 1)} />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" />
              Mean
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-blue-100 rounded inline-block" />
              ±1σ band
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-orange-400 inline-block" />
              Squared distances
            </span>
          </div>
        </>
      )}

      {/* ── Tab: Outlier effect ── */}
      {activeTab === 'outlier' && (
        <>
          {/* Use containerRef here for the width observer */}
          <div ref={containerRef} className="w-full">
            <div className="flex gap-4 overflow-x-auto">
              <CompPlot points={OUTLIER_BASE} label="Without outlier" width={halfW} />
              <CompPlot points={OUTLIER_WITH} label="With outlier (95)" width={halfW} />
            </div>
          </div>

          {/* Comparison stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Without outlier</p>
              <div className="flex gap-2">
                <StatCard label="Mean" value={fmt(mBase, 1)} />
                <StatCard label="Median" value={fmt(medBase, 1)} />
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">With outlier</p>
              <div className="flex gap-2">
                <StatCard label="Mean" value={fmt(mWith, 1)} />
                <StatCard label="Median" value={fmt(medWith, 1)} />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <span className="text-amber-500 text-base mt-0.5">⚡</span>
            <p className="text-sm text-amber-800 leading-relaxed">
              The outlier moved the <strong>mean</strong> by{' '}
              <strong>{fmt(Math.abs(mWith - mBase), 1)} points</strong> but the{' '}
              <strong>median</strong> by only{' '}
              <strong>{fmt(Math.abs(medWith - medBase), 1)} points</strong>.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" />
              Mean (x̄)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-green-600 inline-block" />
              Median
            </span>
          </div>
        </>
      )}

      {/* ── Tab: Same mean, ≠ spread ── */}
      {activeTab === 'spread' && (
        <>
          <div ref={containerRef} className="w-full">
            <div className="flex gap-4 overflow-x-auto">
              <SpreadPlot points={spreadA} onChange={setSpreadA} label="Dataset A" width={halfW} />
              <SpreadPlot points={spreadB} onChange={setSpreadB} label="Dataset B" width={halfW} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Dataset A  σ²" value={fmt(vA, 0)} />
            <StatCard label="Dataset B  σ²" value={fmt(vB, 0)} />
          </div>

          {varDiff > 200 && (
            <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <span className="text-green-500 text-base mt-0.5">✓</span>
              <p className="text-sm text-green-800 leading-relaxed">
                Same mean, very different spread — variance difference is{' '}
                <strong>{fmt(varDiff, 0)}</strong>. This is why variance matters.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Drag points freely — mean is locked to 50 for both datasets
          </p>
        </>
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
