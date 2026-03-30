'use client';

import { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { TipCard } from '@/components/TipCard';
import { useTips } from '@/lib/useTips';

// ─── Constants & math ─────────────────────────────────────────────────────────

type ActivationFn = 'relu' | 'sigmoid' | 'tanh';
type NetworkType  = 'linear' | 'hidden';
type TabId        = 'neuron' | 'activation' | 'layers';

const LAB_SLUG = 'neural-networks';

function reluFn(z: number)    { return Math.max(0, z); }
function sigmoidFn(z: number) { return 1 / (1 + Math.exp(-z)); }
function tanhFn(z: number)    { return Math.tanh(z); }

function activate(z: number, fn: ActivationFn) {
  if (fn === 'relu')    return reluFn(z);
  if (fn === 'sigmoid') return sigmoidFn(z);
  return tanhFn(z);
}

// XOR network: 2 → 4 hidden (ReLU) → 1 output (sigmoid)
// Verified manually for all four XOR quadrants
const XOR_W1 = [[1, 1], [-1, -1], [1, -1], [-1, 1]] as const;
const XOR_B1 = [-0.5, -0.5, -0.5, -0.5]             as const;
const XOR_W2 = [-2, -2, 2, 2]                        as const;
const XOR_B2 = 0.5;

function xorForward(x1: number, x2: number): number {
  const h = XOR_W1.map((w, i) => reluFn(w[0] * x1 + w[1] * x2 + XOR_B1[i]));
  return sigmoidFn(h.reduce((s, hi, i) => s + XOR_W2[i] * hi, XOR_B2));
}

// Linear baseline: single-neuron sigmoid — produces diagonal boundary, fails at XOR
function linearForward(x1: number, x2: number): number {
  return sigmoidFn(x1 + x2);
}

// Seeded PRNG so dataset is identical every render
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const XOR_DATA = (() => {
  const rng = mulberry32(42);
  return Array.from({ length: 120 }, () => {
    const x1 = (rng() - 0.5) * 4;
    const x2 = (rng() - 0.5) * 4;
    return { x1, x2, label: x1 * x2 < 0 ? 1 : 0 };
  });
})();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NeuralNetworkLabState {
  activeTab:   TabId;
  x1: number;  x2: number;
  w1: number;  w2: number;
  bias: number;
  activation:  ActivationFn;
  z: number;
  output: number;
  networkType: NetworkType;
}

interface Props {
  onStateChange?: (s: NeuralNetworkLabState) => void;
}

// ─── Tips ─────────────────────────────────────────────────────────────────────

const TIP_TEXT = [
  {
    text: "Set w1 to 0. Now x1 has zero influence on the output — that connection goes silent. Weights are the network's way of deciding which inputs to pay attention to.",
    accent: 'blue' as const,
  },
  {
    text: "In the Activations tab, slide z from negative to positive. ReLU just clips negatives to 0 — that simple step is why deep networks train better than older sigmoid-only designs.",
    accent: 'amber' as const,
  },
  {
    text: "In the Layers tab, no matter how you describe it, the linear model draws one straight line. It can never separate the XOR pattern. Only adding a hidden layer gives the network the ability to bend.",
    accent: 'blue' as const,
  },
];

// ─── Neuron diagram (pure SVG/JSX) ───────────────────────────────────────────

function NeuronDiagram({ x1, x2, w1, w2, bias, activation, output }: {
  x1: number; x2: number; w1: number; w2: number;
  bias: number; activation: ActivationFn; output: number;
}) {
  const W = 340; const H = 200;
  const ix = 50;  const nx = 185; const ox = 310;
  const y1 = 72;  const y2 = 130; const ny = 101;
  const IR = 18;  const NR = 26;  const OR = 18;

  const wc = (w: number) => w > 0.05 ? '#3b82f6' : w < -0.05 ? '#ef4444' : '#d1d5db';
  const ww = (w: number) => Math.max(0.8, Math.min(5, Math.abs(w) * 1.8));
  const oc = output > 0.65 ? '#16a34a' : output < 0.35 ? '#dc2626' : '#d97706';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      <defs>
        <marker id="nn-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" />
        </marker>
      </defs>

      {/* Weight connections */}
      <line x1={ix + IR} y1={y1} x2={nx - NR} y2={ny}
        stroke={wc(w1)} strokeWidth={ww(w1)} strokeOpacity={0.75} />
      <line x1={ix + IR} y1={y2} x2={nx - NR} y2={ny}
        stroke={wc(w2)} strokeWidth={ww(w2)} strokeOpacity={0.75} />

      {/* Weight labels */}
      <text x={112} y={y1 - 6}  textAnchor="middle" fontSize={10} fill={wc(w1)} fontWeight="600">
        w₁ = {w1 >= 0 ? '+' : ''}{w1.toFixed(1)}
      </text>
      <text x={112} y={y2 + 16} textAnchor="middle" fontSize={10} fill={wc(w2)} fontWeight="600">
        w₂ = {w2 >= 0 ? '+' : ''}{w2.toFixed(1)}
      </text>

      {/* Output arrow */}
      <line x1={nx + NR} y1={ny} x2={ox - OR - 2} y2={ny}
        stroke="#9ca3af" strokeWidth={1.5} markerEnd="url(#nn-arrow)" />

      {/* Input nodes */}
      {[{ v: x1, y: y1, l: 'x₁' }, { v: x2, y: y2, l: 'x₂' }].map(({ v, y, l }) => (
        <g key={l}>
          <circle cx={ix} cy={y} r={IR} fill="#eff6ff" stroke="#93c5fd" strokeWidth={1.5} />
          <text x={ix} y={y + 4}        textAnchor="middle" fontSize={12} fill="#1d4ed8" fontWeight="600">{l}</text>
          <text x={ix} y={y + IR + 13}  textAnchor="middle" fontSize={10} fill="#6b7280">{v.toFixed(1)}</text>
        </g>
      ))}

      {/* Neuron body */}
      <circle cx={nx} cy={ny} r={NR} fill="white" stroke="#d1d5db" strokeWidth={2} />
      <text x={nx} y={ny - 6}      textAnchor="middle" fontSize={10} fill="#374151">Σ → f</text>
      <text x={nx} y={ny + 7}      textAnchor="middle" fontSize={9}  fill="#9ca3af">{activation}</text>
      <text x={nx} y={ny + NR + 14} textAnchor="middle" fontSize={9}  fill="#9ca3af">
        b = {bias >= 0 ? '+' : ''}{bias.toFixed(1)}
      </text>

      {/* Output node */}
      <circle cx={ox} cy={ny} r={OR} fill="white" stroke={oc} strokeWidth={2.5} />
      <text x={ox} y={ny - 3}  textAnchor="middle" fontSize={11} fill={oc} fontWeight="700">
        {output.toFixed(3)}
      </text>
      <text x={ox} y={ny + 10} textAnchor="middle" fontSize={9}  fill="#9ca3af">out</text>
    </svg>
  );
}

// ─── Tab 1: The Neuron ────────────────────────────────────────────────────────

interface NeuronTabProps {
  onInteract: () => void;
  x1: number; setX1: (v: number) => void;
  x2: number; setX2: (v: number) => void;
  w1: number; setW1: (v: number) => void;
  w2: number; setW2: (v: number) => void;
  bias: number; setBias: (v: number) => void;
  act: ActivationFn; setAct: (v: ActivationFn) => void;
  z: number; output: number;
}

function NeuronTab({ onInteract, x1, setX1, x2, setX2, w1, setW1, w2, setW2, bias, setBias, act, setAct, z, output }: NeuronTabProps) {
  const sliders: { label: string; val: number; set: (v: number) => void; min: number; max: number; step: number }[] = [
    { label: 'x₁ — input 1',  val: x1,   set: setX1,   min: -2, max: 2, step: 0.1 },
    { label: 'x₂ — input 2',  val: x2,   set: setX2,   min: -2, max: 2, step: 0.1 },
    { label: 'w₁ — weight 1', val: w1,   set: setW1,   min: -3, max: 3, step: 0.1 },
    { label: 'w₂ — weight 2', val: w2,   set: setW2,   min: -3, max: 3, step: 0.1 },
    { label: 'b — bias',      val: bias, set: setBias, min: -3, max: 3, step: 0.1 },
  ];

  return (
    <div className="space-y-4">
      <NeuronDiagram x1={x1} x2={x2} w1={w1} w2={w2} bias={bias} activation={act} output={output} />

      {/* Computation trace */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs space-y-1.5">
        <div className="text-gray-400">z = w₁·x₁  +  w₂·x₂  +  b</div>
        <div className="text-blue-700">
          z = ({w1.toFixed(1)})·({x1.toFixed(1)}) + ({w2.toFixed(1)})·({x2.toFixed(1)}) + {bias.toFixed(1)}{' '}
          = <span className="font-bold">{z.toFixed(3)}</span>
        </div>
        <div className={`font-bold ${output > 0.65 ? 'text-green-700' : output < 0.35 ? 'text-red-600' : 'text-amber-600'}`}>
          a = {act}({z.toFixed(3)}) = {output.toFixed(3)}
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {sliders.map(({ label, val, set, min, max, step }) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{label}</span>
              <span className="font-mono font-semibold text-gray-700">{val.toFixed(1)}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={val}
              onChange={e => { set(Number(e.target.value)); onInteract(); }}
              className="w-full h-1.5 accent-blue-500" />
          </div>
        ))}

        {/* Activation selector */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Activation</div>
          <div className="flex gap-1">
            {(['relu', 'sigmoid', 'tanh'] as ActivationFn[]).map(fn => (
              <button key={fn} onClick={() => { setAct(fn); onInteract(); }}
                className={`flex-1 py-1 text-xs rounded-lg border transition-colors font-medium ${
                  act === fn
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}>
                {fn}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Activation Functions ─────────────────────────────────────────────

function ActivationTab() {
  const [zInput, setZInput] = useState(1.0);
  const svgRef = useRef<SVGSVGElement>(null);

  const curves = [
    { fn: reluFn,    color: '#3b82f6', label: 'ReLU' },
    { fn: sigmoidFn, color: '#16a34a', label: 'Sigmoid' },
    { fn: tanhFn,    color: '#d97706', label: 'Tanh' },
  ];

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const margin = { top: 16, right: 16, bottom: 32, left: 40 };
    const totalW = el.clientWidth || 460;
    const totalH = 220;
    const w = totalW - margin.left - margin.right;
    const h = totalH - margin.top - margin.bottom;

    d3.select(el).selectAll('*').remove();
    d3.select(el).attr('height', totalH);

    const svg = d3.select(el).append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xSc = d3.scaleLinear().domain([-4, 4]).range([0, w]);
    const ySc = d3.scaleLinear().domain([-1.3, 1.3]).range([h, 0]);

    // zero axis
    svg.append('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', ySc(0)).attr('y2', ySc(0))
      .attr('stroke', '#f3f4f6').attr('stroke-width', 1);

    // axes
    svg.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xSc).ticks(8).tickSize(3))
      .call(g => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));
    svg.append('g')
      .call(d3.axisLeft(ySc).ticks(5).tickSize(3))
      .call(g => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));

    const xs = d3.range(-4, 4.02, 0.04);

    curves.forEach(({ fn, color }) => {
      svg.append('path')
        .datum(xs)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('d', d3.line<number>()
          .x(x => xSc(x))
          .y(x => ySc(Math.min(1.3, Math.max(-1.3, fn(x)))))(xs)
        );
    });

    // cursor line
    svg.append('line')
      .attr('x1', xSc(zInput)).attr('x2', xSc(zInput))
      .attr('y1', 0).attr('y2', h)
      .attr('stroke', '#6b7280').attr('stroke-dasharray', '4,3').attr('stroke-width', 1.5);

    // dots on each curve at cursor
    curves.forEach(({ fn, color }) => {
      const yVal = Math.min(1.3, Math.max(-1.3, fn(zInput)));
      svg.append('circle')
        .attr('cx', xSc(zInput)).attr('cy', ySc(yVal))
        .attr('r', 5).attr('fill', color).attr('stroke', 'white').attr('stroke-width', 2);
    });

    // legend
    const lgX = w - 120;
    curves.forEach(({ fn, color, label }, i) => {
      const g = svg.append('g').attr('transform', `translate(${lgX}, ${i * 20})`);
      g.append('line').attr('x2', 14).attr('y1', 7).attr('y2', 7)
        .attr('stroke', color).attr('stroke-width', 2.5);
      g.append('text').attr('x', 18).attr('y', 11)
        .attr('font-size', 11).attr('fill', '#374151')
        .text(`${label}: ${fn(zInput).toFixed(3)}`);
    });
  }, [zInput]);

  return (
    <div className="space-y-4">
      <svg ref={svgRef} className="w-full" />

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Input z</span>
          <span className="font-mono font-semibold text-gray-700">{zInput.toFixed(2)}</span>
        </div>
        <input type="range" min={-4} max={4} step={0.05} value={zInput}
          onChange={e => setZInput(Number(e.target.value))}
          className="w-full h-1.5 accent-blue-500" />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
        <strong>Key insight:</strong> Without activation functions, stacking layers still gives a linear model — just with more parameters. The non-linearity (any of these three curves) is what makes "deep" actually mean something.
      </div>
    </div>
  );
}

// ─── Tab 3: Why Layers? ───────────────────────────────────────────────────────

function LayersTab() {
  const [netType, setNetType] = useState<NetworkType>('linear');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const margin = { top: 12, right: 12, bottom: 36, left: 36 };
    const totalW = Math.min(el.clientWidth || 360, 380);
    const w = totalW - margin.left - margin.right;
    const h = w; // square

    d3.select(el).selectAll('*').remove();
    d3.select(el).attr('width', totalW).attr('height', totalW);

    const svg = d3.select(el).append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xSc = d3.scaleLinear().domain([-2.1, 2.1]).range([0, w]);
    const ySc = d3.scaleLinear().domain([-2.1, 2.1]).range([h, 0]);

    const fwd = netType === 'hidden' ? xorForward : linearForward;

    // Background heatmap (50×50 cells)
    const RES = 50;
    const cellW = w / RES + 1;
    const cellH = h / RES + 1;
    for (let i = 0; i < RES; i++) {
      for (let j = 0; j < RES; j++) {
        const cx = -2 + (i + 0.5) * (4 / RES);
        const cy = -2 + (j + 0.5) * (4 / RES);
        const p  = fwd(cx, cy);
        const col = d3.color(d3.interpolateRdBu(1 - p))!;
        col.opacity = 0.35;
        svg.append('rect')
          .attr('x',      xSc(-2 + (i / RES) * 4))
          .attr('y',      ySc(-2 + ((j + 1) / RES) * 4))
          .attr('width',  cellW)
          .attr('height', cellH)
          .attr('fill',   col.toString());
      }
    }

    // Axes (drawn on top of heatmap, under points)
    svg.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xSc).ticks(4).tickSize(3))
      .call(g => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));
    svg.append('g')
      .call(d3.axisLeft(ySc).ticks(4).tickSize(3))
      .call(g => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call(g => g.selectAll('text').attr('font-size', 10).attr('fill', '#9ca3af'));

    // Data points
    XOR_DATA.forEach(({ x1, x2, label }) => {
      svg.append('circle')
        .attr('cx', xSc(x1)).attr('cy', ySc(x2))
        .attr('r', 4)
        .attr('fill', label === 1 ? '#dc2626' : '#2563eb')
        .attr('stroke', 'white').attr('stroke-width', 1.2)
        .attr('opacity', 0.9);
    });

    // Axis labels
    svg.append('text').attr('x', w / 2).attr('y', h + 30)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#6b7280').text('x₁');
    svg.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -h / 2).attr('y', -27)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#6b7280').text('x₂');

  }, [netType]);

  return (
    <div className="space-y-4">
      {/* Network toggle */}
      <div className="flex gap-2">
        {(['linear', 'hidden'] as NetworkType[]).map(t => (
          <button key={t} onClick={() => setNetType(t)}
            className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-colors ${
              netType === t
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            {t === 'linear' ? 'No hidden layer (linear)' : '1 hidden layer (4 neurons)'}
          </button>
        ))}
      </div>

      <svg ref={svgRef} className="w-full" />

      {/* Legend */}
      <div className="flex gap-5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
          <span className="text-gray-500">Class 0 — same sign (Q1, Q3)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          <span className="text-gray-500">Class 1 — diff. sign (Q2, Q4)</span>
        </div>
      </div>

      {/* Insight card */}
      {netType === 'linear' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 leading-relaxed">
          The linear model draws a single diagonal line at x₁ + x₂ = 0. Notice Q1 (top-right) is entirely blue background — it misclassifies those points. No single straight line can separate all four XOR quadrants.
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 leading-relaxed">
          The hidden layer creates a curved, cross-shaped boundary. By composing multiple linear cuts with ReLU activations, the network carves out the exact regions needed — something no linear model can do.
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NeuralNetworks({ onStateChange }: Props) {
  const [tab,          setTab]          = useState<TabId>('neuron');
  const [interactions, setInteractions] = useState(0);
  const [x1, setX1]     = useState(1.0);
  const [x2, setX2]     = useState(0.5);
  const [w1, setW1]     = useState(1.5);
  const [w2, setW2]     = useState(-1.0);
  const [bias, setBias] = useState(0.5);
  const [act, setAct]   = useState<ActivationFn>('relu');
  const [netType]       = useState<NetworkType>('linear');

  const z      = w1 * x1 + w2 * x2 + bias;
  const output = activate(z, act);

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  const { unlocked, dismissed, unlockTip, dismissTip, reopenTip } = useTips(LAB_SLUG);

  // Unlock tip 1 after 5 slider interactions
  useEffect(() => {
    if (interactions >= 5) unlockTip(1);
  }, [interactions, unlockTip]);

  // Unlock tip 2 when user reaches Layers tab
  useEffect(() => {
    if (tab === 'layers') unlockTip(2);
  }, [tab, unlockTip]);

  // Report state upward
  useEffect(() => {
    onStateChangeRef.current?.({
      activeTab: tab,
      x1, x2, w1, w2, bias,
      activation: act,
      z, output,
      networkType: netType,
    });
  }, [tab, x1, x2, w1, w2, bias, act, z, output, netType]);

  const handleInteract = () => setInteractions(c => c + 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Neural Networks</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Build intuition for how layers of simple functions create complex behaviour
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { id: 'neuron',     label: 'The Neuron' },
          { id: 'activation', label: 'Activations' },
          { id: 'layers',     label: 'Why Layers?' },
        ] as { id: TabId; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tips */}
      <div className="flex flex-wrap gap-2">
        {TIP_TEXT.map((tip, i) => (
          unlocked.has(i) && (
            <div key={i} className="w-full">
              <TipCard
                index={i}
                text={tip.text}
                accent={tip.accent}
                isDismissed={dismissed.has(i)}
                onDismiss={() => dismissTip(i)}
                onReopen={() => reopenTip(i)}
              />
            </div>
          )
        ))}
      </div>

      {/* Tab content — pass setters for neuron tab so state can be lifted */}
      {tab === 'neuron' && (
        <NeuronTab
          onInteract={handleInteract}
          x1={x1}   setX1={setX1}
          x2={x2}   setX2={setX2}
          w1={w1}   setW1={setW1}
          w2={w2}   setW2={setW2}
          bias={bias} setBias={setBias}
          act={act}   setAct={setAct}
          z={z}       output={output}
        />
      )}
      {tab === 'activation' && <ActivationTab />}
      {tab === 'layers'     && <LayersTab />}
    </div>
  );
}
