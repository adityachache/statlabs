'use client';

import { notFound } from 'next/navigation';
import { useState } from 'react';
import { concepts } from '@/lib/concepts';
import LabShell from '@/components/LabShell';
import NormalDistribution, { type NormalLabState } from '@/components/labs/NormalDistribution';
import GradientDescent, { type GradientDescentLabState } from '@/components/labs/GradientDescent';
import CentralLimitTheorem, { type CLTLabState } from '@/components/labs/CentralLimitTheorem';
import MeanVariance, { type MeanVarianceLabState } from '@/components/labs/MeanVariance';
import HypothesisTesting, { type HypothesisTestingLabState } from '@/components/labs/HypothesisTesting';
import ConfidenceIntervals, { type ConfidenceIntervalLabState } from '@/components/labs/ConfidenceIntervals';
import NeuralNetworks, { type NeuralNetworkLabState } from '@/components/labs/NeuralNetworks';

export default function LabPage({ params }: { params: { slug: string } }) {
  const concept = concepts.find((c) => c.slug === params.slug);
  if (!concept || !concept.hasLab) notFound();

  const [labState, setLabState] = useState<Record<string, unknown>>({});

  const handleNormalState    = (s: NormalLabState)        => setLabState(s as unknown as Record<string, unknown>);
  const handleGradientState  = (s: GradientDescentLabState) => setLabState(s as unknown as Record<string, unknown>);
  const handleCLTState       = (s: CLTLabState)           => setLabState(s as unknown as Record<string, unknown>);
  const handleMVState        = (s: MeanVarianceLabState)  => setLabState(s as unknown as Record<string, unknown>);
  const handleHTState        = (s: HypothesisTestingLabState)        => setLabState(s as unknown as Record<string, unknown>);
  const handleCIState        = (s: ConfidenceIntervalLabState)        => setLabState(s as unknown as Record<string, unknown>);
  const handleNNState        = (s: NeuralNetworkLabState)             => setLabState(s as unknown as Record<string, unknown>);

  let labContent: React.ReactNode;
  if (params.slug === 'normal-distribution') {
    labContent = <NormalDistribution onStateChange={handleNormalState} />;
  } else if (params.slug === 'gradient-descent') {
    labContent = <GradientDescent onStateChange={handleGradientState} />;
  } else if (params.slug === 'central-limit-theorem') {
    labContent = <CentralLimitTheorem onStateChange={handleCLTState} />;
  } else if (params.slug === 'mean-variance') {
    labContent = <MeanVariance onStateChange={handleMVState} />;
  } else if (params.slug === 'hypothesis-testing') {
    labContent = <HypothesisTesting onStateChange={handleHTState} />;
  } else if (params.slug === 'confidence-intervals') {
    labContent = <ConfidenceIntervals onStateChange={handleCIState} />;
  } else if (params.slug === 'neural-networks') {
    labContent = <NeuralNetworks onStateChange={handleNNState} />;
  } else {
    notFound();
  }

  return (
    <LabShell concept={concept} labState={labState}>
      {labContent}
    </LabShell>
  );
}
