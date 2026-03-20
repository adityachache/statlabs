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

function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = y * Math.exp(-x * x);
  return x >= 0 ? result : 2 - result;
}

function normalCDF(x: number): number {
  return 0.5 * erfc(-x / Math.SQRT2);
}

function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function normalCDFInverse(p: number): number {
  let lo = -8,
    hi = 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normalCDF(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function tTest(
  a: number[],
  b: number[],
): { t: number; p: number; meanA: number; meanB: number } {
  const n = a.length;
  const meanA = a.reduce((s, x) => s + x, 0) / n;
  const meanB = b.reduce((s, x) => s + x, 0) / n;
  const varA = a.reduce((s, x) => s + (x - meanA) ** 2, 0) / n;
  const varB = b.reduce((s, x) => s + (x - meanB) ** 2, 0) / n;
  const se = Math.sqrt((varA + varB) / n);
  const t = se > 0 ? (meanB - meanA) / se : 0;
  const p = Math.min(1, Math.max(1e-6, 2 * (1 - normalCDF(Math.abs(t)))));
  return { t, p, meanA, meanB };
}

function sampleGroup(effect: number, n: number): number[] {
  return Array.from({ length: n }, () => randn() + effect);
}

// ─── Tip definitions ──────────────────────────────────────────────────────────

const TIPS = [
  {
    id: 0,
    text: 'p-value = probability of seeing data this extreme if the null hypothesis is true. It is NOT the probability that H₀ is true.',
    accent: 'blue' as const,
  },
  {
    id: 1,
    text: 'You found a p < 0.05, but is it real? Try the P-hacking tab to see how often chance alone produces "significant" results.',
    accent: 'amber' as const,
  },
  {
    id: 2,
    text: 'That false positive was real data, real noise. No fraud — just randomness. Publication bias means only the "significant" ones get published.',
    accent: 'blue' as const,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${highlight ?? 'text-gray-800'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Tab 1: Ghost placeholder ─────────────────────────────────────────────────

function GhostHistogramChart({ width }: { width: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 160;
  const M = { top: 10, right: 16, bottom: 28, left: 30 };

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const W = width - M.left - M.right;
    const H2 = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg
      .attr('width', width)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${M.left},${M.top})`);

    // Two ghost bell curves: A centred at -0.6, B at +0.6
    const domain: [number, number] = [-4, 4];
    const pts = d3.range(domain[0], domain[1], 0.05);
    const x = d3.scaleLinear().domain(domain).range([0, W]);
    const peakY = normalPdf(0, 0, 1);
    const y = d3.scaleLinear().domain([0, peakY * 1.15]).range([H2, 0]);

    const makeArea = (mu: number) =>
      d3.area<number>()
        .x((t) => x(t))
        .y0(H2)
        .y1((t) => y(normalPdf(t, mu, 1)))
        .curve(d3.curveBasis)(pts) ?? '';

    const makeLine = (mu: number) =>
      d3.line<number>()
        .x((t) => x(t))
        .y((t) => y(normalPdf(t, mu, 1)))
        .curve(d3.curveBasis)(pts) ?? '';

    // Fill
    g.append('path').attr('d', makeArea(-0.5)).attr('fill', '#f3f4f6').attr('opacity', 0.9);
    g.append('path').attr('d', makeArea(0.5)).attr('fill', '#f3f4f6').attr('opacity', 0.9);

    // Outline
    g.append('path').attr('d', makeLine(-0.5)).attr('fill', 'none').attr('stroke', '#d1d5db').attr('stroke-width', 1.5);
    g.append('path').attr('d', makeLine(0.5)).attr('fill', 'none').attr('stroke', '#d1d5db').attr('stroke-width', 1.5);

    // Dashed mean ticks
    for (const mu of [-0.5, 0.5]) {
      g.append('line')
        .attr('x1', x(mu)).attr('x2', x(mu))
        .attr('y1', 0).attr('y2', H2)
        .attr('stroke', '#e5e7eb').attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    }

    // Centred label
    g.append('text')
      .attr('x', W / 2)
      .attr('y', H2 / 2 - 4)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#9ca3af')
      .text("Press \u2018Draw sample\u2019 to run your first experiment");
  }, [width]);

  return <svg ref={svgRef} />;
}

// ─── Tab 1: Histogram ─────────────────────────────────────────────────────────

function HistogramChart({
  groupA,
  groupB,
  width,
}: {
  groupA: number[];
  groupB: number[];
  width: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 160;
  const M = { top: 10, right: 16, bottom: 28, left: 30 };

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const W = width - M.left - M.right;
    const H2 = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg
      .attr('width', width)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${M.left},${M.top})`);

    const all = [...groupA, ...groupB];
    const ext = d3.extent(all) as [number, number];
    const domain: [number, number] = [ext[0] - 1, ext[1] + 1];

    const x = d3.scaleLinear().domain(domain).range([0, W]);
    const bins = d3.bin().domain(domain).thresholds(20);
    const binsA = bins(groupA);
    const binsB = bins(groupB);

    const maxCount = Math.max(
      d3.max(binsA, (b) => b.length) ?? 0,
      d3.max(binsB, (b) => b.length) ?? 0,
    );
    const y = d3.scaleLinear().domain([0, maxCount]).range([H2, 0]).nice();

    g.selectAll('.barA')
      .data(binsA)
      .join('rect')
      .attr('x', (d) => x(d.x0 ?? 0) + 0.5)
      .attr('width', (d) => Math.max(0, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 1))
      .attr('y', (d) => y(d.length))
      .attr('height', (d) => H2 - y(d.length))
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.5);

    g.selectAll('.barB')
      .data(binsB)
      .join('rect')
      .attr('x', (d) => x(d.x0 ?? 0) + 0.5)
      .attr('width', (d) => Math.max(0, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 1))
      .attr('y', (d) => y(d.length))
      .attr('height', (d) => H2 - y(d.length))
      .attr('fill', '#f97316')
      .attr('opacity', 0.5);

    const meanA = groupA.reduce((s, v) => s + v, 0) / groupA.length;
    const meanB = groupB.reduce((s, v) => s + v, 0) / groupB.length;

    for (const [mean, color] of [
      [meanA, '#2563eb'],
      [meanB, '#ea580c'],
    ] as [number, string][]) {
      g.append('line')
        .attr('x1', x(mean)).attr('x2', x(mean))
        .attr('y1', 0).attr('y2', H2)
        .attr('stroke', color).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');
    }

    g.append('g')
      .attr('transform', `translate(0,${H2})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(3))
      .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(3))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));
  }, [groupA, groupB, width]);

  return <svg ref={svgRef} />;
}

// ─── Tab 2: P-hacking scatter ─────────────────────────────────────────────────

function PHackingChart({ pValues, width }: { pValues: number[]; width: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 160;
  const M = { top: 12, right: 24, bottom: 28, left: 36 };

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const W = width - M.left - M.right;
    const H2 = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg
      .attr('width', width)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${M.left},${M.top})`);

    const x = d3.scaleLinear().domain([0, Math.max(pValues.length, 1)]).range([0, W]);
    const y = d3.scaleLinear().domain([0, 1]).range([H2, 0]);

    g.append('line')
      .attr('x1', 0).attr('x2', W)
      .attr('y1', y(0.05)).attr('y2', y(0.05))
      .attr('stroke', '#ef4444').attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');

    g.append('text')
      .attr('x', W + 2).attr('y', y(0.05) + 4)
      .attr('font-size', 9).attr('fill', '#ef4444')
      .text('α');

    g.selectAll('circle.dot')
      .data(pValues)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', (_, i) => x(i + 1))
      .attr('cy', (d) => y(d))
      .attr('r', (d) => (d < 0.05 ? 6 : 4))
      .attr('fill', (d) => (d < 0.05 ? '#dc2626' : '#9ca3af'))
      .attr('opacity', (d) => (d < 0.05 ? 1.0 : 0.7));

    // Pulse ring on the most recent dot
    if (pValues.length > 0) {
      const lastIdx = pValues.length - 1;
      const lastVal = pValues[lastIdx];
      const isFP = lastVal < 0.05;
      const baseR = isFP ? 6 : 4;
      const ringColor = isFP ? '#dc2626' : '#9ca3af';

      const ring = g.append('circle')
        .attr('cx', x(lastIdx + 1))
        .attr('cy', y(lastVal))
        .attr('r', baseR)
        .attr('fill', 'none')
        .attr('stroke', ringColor)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8);

      ring.append('animate')
        .attr('attributeName', 'r')
        .attr('from', baseR)
        .attr('to', baseR + 10)
        .attr('dur', '0.9s')
        .attr('repeatCount', '3')
        .attr('calcMode', 'ease-out');

      ring.append('animate')
        .attr('attributeName', 'opacity')
        .attr('from', 0.7)
        .attr('to', 0)
        .attr('dur', '0.9s')
        .attr('repeatCount', '3');
    }

    g.append('g')
      .attr('transform', `translate(0,${H2})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(3))
      .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(3))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -H2 / 2).attr('y', -26)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('fill', '#9ca3af')
      .text('p-value');
  }, [pValues, width]);

  return <svg ref={svgRef} />;
}

// ─── Tab 3: Distributions chart ───────────────────────────────────────────────

function ErrorsDistChart({
  alpha,
  effect,
  width,
}: {
  alpha: number;
  effect: number;
  width: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 160;
  const M = { top: 12, right: 12, bottom: 28, left: 12 };

  useEffect(() => {
    if (!svgRef.current || width < 50) return;
    const W = width - M.left - M.right;
    const H2 = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg
      .attr('width', width)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${M.left},${M.top})`);

    const xMin = -4;
    const xMax = Math.max(effect + 4, 5);
    const pts = d3.range(xMin, xMax, 0.05);
    const x = d3.scaleLinear().domain([xMin, xMax]).range([0, W]);
    const maxY = normalPdf(0) * 1.15;
    const y = d3.scaleLinear().domain([0, maxY]).range([H2, 0]);

    const zCrit = normalCDFInverse(1 - alpha / 2);

    // Type I shading — tails of null
    const areaNull = d3
      .area<number>()
      .x((t) => x(t))
      .y0(H2)
      .y1((t) => y(normalPdf(t)));

    g.append('path')
      .datum(pts.filter((t) => t <= -zCrit))
      .attr('d', areaNull)
      .attr('fill', '#fca5a5')
      .attr('opacity', 0.7);

    g.append('path')
      .datum(pts.filter((t) => t >= zCrit))
      .attr('d', areaNull)
      .attr('fill', '#fca5a5')
      .attr('opacity', 0.7);

    // Type II shading — non-rejection region of alternative
    const areaAlt = d3
      .area<number>()
      .x((t) => x(t))
      .y0(H2)
      .y1((t) => y(normalPdf(t, effect)));

    g.append('path')
      .datum(pts.filter((t) => t >= -zCrit && t <= zCrit))
      .attr('d', areaAlt)
      .attr('fill', '#fcd34d')
      .attr('opacity', 0.6);

    // Null curve (blue)
    g.append('path')
      .datum(pts)
      .attr(
        'd',
        d3
          .line<number>()
          .x((t) => x(t))
          .y((t) => y(normalPdf(t)))
          .curve(d3.curveBasis)(pts) ?? '',
      )
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2);

    // Alt curve (orange)
    g.append('path')
      .datum(pts)
      .attr(
        'd',
        d3
          .line<number>()
          .x((t) => x(t))
          .y((t) => y(normalPdf(t, effect)))
          .curve(d3.curveBasis)(pts) ?? '',
      )
      .attr('fill', 'none')
      .attr('stroke', '#f97316')
      .attr('stroke-width', 2);

    // Critical value lines
    for (const cv of [zCrit, -zCrit]) {
      g.append('line')
        .attr('x1', x(cv)).attr('x2', x(cv))
        .attr('y1', 0).attr('y2', H2)
        .attr('stroke', '#ef4444').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');
    }

    g.append('g')
      .attr('transform', `translate(0,${H2})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(3))
      .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));
  }, [alpha, effect, width]);

  return <svg ref={svgRef} />;
}

// ─── Lab state ────────────────────────────────────────────────────────────────

export interface HypothesisTestingLabState {
  tab: string;
  trueEffect: number;
  sampleSize: number;
  lastP: number | null;
  phackingTests: number;
  phackingFalsePositives: number;
  alpha: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

type HTTab = 'pvalue' | 'phacking' | 'errors';

interface HypothesisTestingProps {
  onStateChange?: (s: HypothesisTestingLabState) => void;
}

export default function HypothesisTesting({ onStateChange }: HypothesisTestingProps) {
  const [tab, setTab] = useState<HTTab>('pvalue');

  // Tab 1 state
  const [trueEffect, setTrueEffect] = useState(0);
  const [sampleSize, setSampleSize] = useState(20);
  const [groupA, setGroupA] = useState<number[]>([]);
  const [groupB, setGroupB] = useState<number[]>([]);
  const [lastP, setLastP] = useState<number | null>(null);
  const [lastT, setLastT] = useState<number | null>(null);

  // Tab 2 state
  const [phackingPs, setPhackingPs] = useState<number[]>([]);

  // Tab 3 state
  const [alpha, setAlpha] = useState(0.05);
  const [errEffect, setErrEffect] = useState(2);

  // Layout
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(560);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // onStateChange ref — prevents infinite re-render loop when parent recreates the callback
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  // Tips
  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip } = useTips('hypothesis-testing');
  const unlockTipRef = useRef(unlockTip);
  useEffect(() => {
    unlockTipRef.current = unlockTip;
  }, [unlockTip]);

  // Tip 0: always
  useEffect(() => {
    unlockTipRef.current(0);
  }, []);

  // Lab state reporting
  useEffect(() => {
    onStateChangeRef.current?.({
      tab,
      trueEffect,
      sampleSize,
      lastP,
      phackingTests: phackingPs.length,
      phackingFalsePositives: phackingPs.filter((p) => p < 0.05).length,
      alpha,
    });
  }, [tab, trueEffect, sampleSize, lastP, phackingPs, alpha]);

  // Draw count for tip 1
  const drawCount = useRef(0);

  const handleDraw = useCallback(() => {
    const a = sampleGroup(0, sampleSize);
    const b = sampleGroup(trueEffect, sampleSize);
    const { t, p } = tTest(a, b);
    setGroupA(a);
    setGroupB(b);
    setLastP(p);
    setLastT(t);
    drawCount.current += 1;
    if (drawCount.current === 5) {
      setTimeout(() => unlockTipRef.current(1), 300);
    }
  }, [sampleSize, trueEffect]);

  const runPhackTest = useCallback(
    (n = 1) => {
      const newPs: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = sampleGroup(0, 30);
        const b = sampleGroup(0, 30);
        const { p } = tTest(a, b);
        newPs.push(p);
      }
      setPhackingPs((prev) => {
        const next = [...prev, ...newPs];
        const prevFPs = prev.filter((p) => p < 0.05).length;
        const nextFPs = next.filter((p) => p < 0.05).length;
        if (nextFPs > 0 && prevFPs === 0) {
          setTimeout(() => unlockTipRef.current(2), 300);
        }
        return next;
      });
    },
    [],
  );

  const phackFPs = phackingPs.filter((p) => p < 0.05).length;
  const phackFPRate =
    phackingPs.length > 0 ? ((phackFPs / phackingPs.length) * 100).toFixed(1) : '—';

  const zCrit = normalCDFInverse(1 - alpha / 2);
  const power = 1 - normalCDF(zCrit - errEffect);

  return (
    <div ref={containerRef} className="space-y-5">
      {/* Tips */}
      <div className="space-y-2">
        {TIPS.filter((tip) => unlocked.has(tip.id)).map((tip) => (
          <TipCard
            key={tip.id}
            index={tip.id}
            text={tip.text}
            accent={tip.accent}
            isDismissed={dismissed.has(tip.id)}
            onDismiss={() => dismissTip(tip.id)}
            onReopen={() => reopenTip(tip.id)}
            actionButton={
              tip.id === 1
                ? { label: 'Go to P-hacking →', onClick: () => setTab('phacking') }
                : undefined
            }
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(
          [
            { key: 'pvalue', label: 'What is a p-value?' },
            { key: 'phacking', label: 'P-hacking' },
            { key: 'errors', label: 'Type I & II errors' },
          ] as { key: HTTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-medium transition-all ${
              tab === key
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: What is a p-value ── */}
      {tab === 'pvalue' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Draw two random samples. The p-value answers:{' '}
            <em>if there were no true difference</em>, how often would we see data this extreme by
            chance?
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                True effect:{' '}
                <span className="font-semibold text-gray-700">{trueEffect.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.1"
                value={trueEffect}
                onChange={(e) => {
                  setTrueEffect(+e.target.value);
                  drawCount.current = 0;
                }}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>-3</span>
                <span>0</span>
                <span>+3</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                Sample size:{' '}
                <span className="font-semibold text-gray-700">n = {sampleSize}</span>
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={sampleSize}
                onChange={(e) => {
                  setSampleSize(+e.target.value);
                  drawCount.current = 0;
                }}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>5</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDraw}
            className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Draw sample
          </button>

          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-400 opacity-70 inline-block" />
              Group A (control, μ=0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-400 opacity-70 inline-block" />
              Group B (treatment, μ={trueEffect.toFixed(1)})
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {groupA.length > 0 ? (
              <HistogramChart groupA={groupA} groupB={groupB} width={containerW - 2} />
            ) : (
              <GhostHistogramChart width={containerW - 2} />
            )}
          </div>

          {groupA.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="t-statistic"
                value={lastT !== null ? lastT.toFixed(2) : '—'}
                sub="signal / noise"
              />
              <StatCard
                label="p-value"
                value={lastP !== null ? (lastP < 0.001 ? '< 0.001' : lastP.toFixed(3)) : '—'}
                highlight={lastP !== null && lastP < 0.05 ? 'text-green-600' : 'text-gray-800'}
                sub={lastP !== null && lastP < 0.05 ? 'p < 0.05 ✓' : 'p ≥ 0.05'}
              />
              <StatCard
                label="result"
                value={lastP !== null && lastP < 0.05 ? 'Reject H₀' : 'Fail to reject'}
                highlight={
                  lastP !== null && lastP < 0.05 ? 'text-green-600' : 'text-gray-500'
                }
              />
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">
            With true effect = {trueEffect.toFixed(1)}, draw the sample repeatedly to see how
            p-values vary. At effect = 0, p {"<"} 0.05 happens ~5% of the time by chance.
          </p>
        </div>
      )}

      {/* ── Tab 2: P-hacking ── */}
      {tab === 'phacking' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            True effect = 0. No difference exists. Keep running tests and watch how often p {"<"}{' '}
            0.05 appears anyway — just by sampling noise.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => runPhackTest(1)}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Run one test
            </button>
            <button
              onClick={() => runPhackTest(20)}
              className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              Run 20 tests
            </button>
            <button
              onClick={() => setPhackingPs([])}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>

          {phackFPs > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <strong>
                {phackFPs} false positive{phackFPs > 1 ? 's' : ''}
              </strong>{' '}
              out of {phackingPs.length} tests ({phackFPRate}%). There is no real effect.
            </div>
          )}

          {phackingPs.length >= 20 && phackingPs.length < 100 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
              At α = 0.05, roughly 1 in 20 tests produces a false positive by chance. The more you
              test, the more you find — even when nothing is there.
            </div>
          )}

          {phackingPs.length >= 100 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-xs text-purple-800 leading-relaxed">
              With {phackingPs.length} tests, expect ~{Math.round(phackingPs.length * 0.05)} false
              positives. This is why pre-registration, Bonferroni correction, and replication
              matter.
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {phackingPs.length > 0 ? (
              <PHackingChart pValues={phackingPs} width={containerW - 2} />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-gray-300">
                Run some tests to see the pattern
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Tests run" value={String(phackingPs.length)} />
            <StatCard
              label="False positives"
              value={String(phackFPs)}
              highlight={phackFPs > 0 ? 'text-red-500' : 'text-gray-800'}
              sub="p < 0.05, true effect = 0"
            />
            <StatCard label="False positive rate" value={`${phackFPRate}%`} sub="expected ~5%" />
          </div>

          {phackingPs.length > 0 && phackingPs.length < 50 && (
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Run more tests — the rate converges to ~5% over many trials
            </p>
          )}
        </div>
      )}

      {/* ── Tab 3: Type I & II errors ── */}
      {tab === 'errors' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Every test makes one of four outcomes. The threshold α controls the tradeoff between
            Type I (false alarm) and Type II (missed signal) errors.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="font-semibold text-green-700 mb-1">True Positive</div>
              <div className="text-green-600">H₀ false → Rejected ✓</div>
              <div className="text-green-500 mt-1 text-[10px]">Power = 1 − β</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="font-semibold text-red-700 mb-1">Type I Error</div>
              <div className="text-red-600">H₀ true → Rejected ✗</div>
              <div className="text-red-500 mt-1 text-[10px]">False alarm rate = α</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="font-semibold text-amber-700 mb-1">Type II Error</div>
              <div className="text-amber-600">H₀ false → Not rejected ✗</div>
              <div className="text-amber-500 mt-1 text-[10px]">Missed signal rate = β</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="font-semibold text-green-700 mb-1">True Negative</div>
              <div className="text-green-600">H₀ true → Not rejected ✓</div>
              <div className="text-green-500 mt-1 text-[10px]">Specificity = 1 − α</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                Significance level:{' '}
                <span className="font-semibold text-gray-700">α = {alpha.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.01"
                max="0.20"
                step="0.01"
                value={alpha}
                onChange={(e) => setAlpha(+e.target.value)}
                className="w-full accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>0.01</span>
                <span>0.10</span>
                <span>0.20</span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <label className="block text-xs text-gray-400 mb-1.5">
                True effect:{' '}
                <span className="font-semibold text-gray-700">δ = {errEffect.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={errEffect}
                onChange={(e) => setErrEffect(+e.target.value)}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
                <span>0</span>
                <span>2</span>
                <span>4</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-blue-500 inline-block" />
              Null (H₀ true)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-orange-500 inline-block" />
              Alternative
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />
              Type I (α)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-200 inline-block" />
              Type II (β)
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <ErrorsDistChart alpha={alpha} effect={errEffect} width={containerW - 2} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Critical value"
              value={`±${zCrit.toFixed(2)}`}
              sub={`α = ${alpha.toFixed(2)}`}
            />
            <StatCard
              label="Type I rate"
              value={`${(alpha * 100).toFixed(0)}%`}
              highlight="text-red-500"
              sub="false positives"
            />
            <StatCard
              label="Power (1−β)"
              value={`${(power * 100).toFixed(0)}%`}
              highlight={power > 0.8 ? 'text-green-600' : 'text-amber-600'}
              sub={`δ = ${errEffect.toFixed(1)}`}
            />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Increase α — the red critical lines move inward, catching more true positives (power ↑)
            but also more false alarms. The only way to reduce both simultaneously is larger sample
            size.
          </p>
        </div>
      )}
    </div>
  );
}
