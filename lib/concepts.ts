export type Tier = 'foundations' | 'core' | 'advanced';

export interface Concept {
  id: string;
  slug: string;
  title: string;
  hook: string;
  description: string;
  tier: Tier;
  prerequisites: string[];
  tags: string[];
  hasLab: boolean;
  estimatedMinutes: number;
}

export const TIERS: Record<Tier, { label: string }> = {
  foundations: { label: 'Foundations' },
  core: { label: 'Core ML' },
  advanced: { label: 'Advanced' },
};

export const concepts: Concept[] = [
  {
    id: 'normal-distribution',
    slug: 'normal-distribution',
    title: 'Normal Distribution',
    hook: 'Why does everything from test scores to galaxy formations follow the same bell curve?',
    description:
      'Explore the most important probability distribution through interactive parameter tuning.',
    tier: 'foundations',
    prerequisites: [],
    tags: ['probability', 'statistics'],
    hasLab: true,
    estimatedMinutes: 12,
  },
  {
    id: 'central-limit-theorem',
    slug: 'central-limit-theorem',
    title: 'Central Limit Theorem',
    hook: 'Take any distribution — uniform, skewed, chaotic. Average enough samples and something magical happens.',
    description:
      'Watch the sampling distribution of means converge to a normal curve regardless of the source distribution shape.',
    tier: 'foundations',
    prerequisites: ['normal-distribution'],
    tags: ['probability', 'statistics', 'sampling'],
    hasLab: true,
    estimatedMinutes: 15,
  },
  {
    id: 'mean-variance',
    slug: 'mean-variance',
    title: 'Mean & Variance',
    hook: 'Two numbers that summarize any dataset — but the same mean can hide completely different stories.',
    description:
      'Understand how central tendency and spread describe any distribution.',
    tier: 'foundations',
    prerequisites: [],
    tags: ['statistics', 'descriptive'],
    hasLab: true,
    estimatedMinutes: 12,
  },
  {
    id: 'probability-basics',
    slug: 'probability-basics',
    title: 'Probability Theory',
    hook: 'Quantifying uncertainty is the foundation of all machine learning.',
    description:
      'From coin flips to Bayes theorem, learn how probability shapes ML.',
    tier: 'foundations',
    prerequisites: [],
    tags: ['probability', 'bayes'],
    hasLab: false,
    estimatedMinutes: 10,
  },
  {
    id: 'linear-regression',
    slug: 'linear-regression',
    title: 'Linear Regression',
    hook: 'The simplest model that can still teach you everything about ML.',
    description: 'Fit lines to data and understand what "learning" really means.',
    tier: 'core',
    prerequisites: ['mean-variance', 'normal-distribution'],
    tags: ['regression', 'supervised'],
    hasLab: false,
    estimatedMinutes: 14,
  },
  {
    id: 'gradient-descent',
    slug: 'gradient-descent',
    title: 'Gradient Descent',
    hook: "Every neural network learns by rolling downhill. Here's the hill.",
    description:
      'Visualize how optimization algorithms find the minimum of any function.',
    tier: 'core',
    prerequisites: ['normal-distribution'],
    tags: ['optimization', 'training'],
    hasLab: true,
    estimatedMinutes: 15,
  },
  {
    id: 'loss-functions',
    slug: 'loss-functions',
    title: 'Loss Functions',
    hook: 'How do you measure wrongness? The answer determines how your model learns.',
    description:
      'Compare MSE, cross-entropy, and other loss functions with interactive examples.',
    tier: 'core',
    prerequisites: ['linear-regression'],
    tags: ['optimization', 'training'],
    hasLab: false,
    estimatedMinutes: 12,
  },
  {
    id: 'bias-variance',
    slug: 'bias-variance',
    title: 'Bias-Variance Tradeoff',
    hook: 'The fundamental tension at the heart of every ML model.',
    description:
      'Understand underfitting, overfitting, and how to find the sweet spot.',
    tier: 'core',
    prerequisites: ['linear-regression', 'gradient-descent'],
    tags: ['theory', 'generalization'],
    hasLab: false,
    estimatedMinutes: 18,
  },
  {
    id: 'neural-networks',
    slug: 'neural-networks',
    title: 'Neural Networks',
    hook: 'Inspired by the brain, but works for entirely different reasons.',
    description:
      'Build intuition for how layers of simple functions create complex behavior.',
    tier: 'advanced',
    prerequisites: ['gradient-descent', 'loss-functions'],
    tags: ['deep-learning', 'architecture'],
    hasLab: false,
    estimatedMinutes: 20,
  },
  {
    id: 'backpropagation',
    slug: 'backpropagation',
    title: 'Backpropagation',
    hook: 'The chain rule, applied cleverly enough to train million-parameter models.',
    description:
      'See exactly how gradients flow backward through a neural network.',
    tier: 'advanced',
    prerequisites: ['neural-networks'],
    tags: ['deep-learning', 'calculus'],
    hasLab: false,
    estimatedMinutes: 20,
  },
  {
    id: 'regularization',
    slug: 'regularization',
    title: 'Regularization',
    hook: 'Sometimes the best way to learn more is to constrain what you can learn.',
    description:
      'L1, L2, dropout, and why limiting models often makes them generalize better.',
    tier: 'advanced',
    prerequisites: ['bias-variance', 'neural-networks'],
    tags: ['generalization', 'deep-learning'],
    hasLab: false,
    estimatedMinutes: 16,
  },
  {
    id: 'hypothesis-testing',
    slug: 'hypothesis-testing',
    title: 'Hypothesis Testing',
    hook: 'p < 0.05 sounds objective. But run enough tests and you can prove almost anything.',
    description:
      'Understand p-values, statistical significance, p-hacking, and Type I/II errors through interactive simulation.',
    tier: 'foundations',
    prerequisites: [],
    tags: ['statistics', 'inference'],
    hasLab: true,
    estimatedMinutes: 18,
  },
  {
    id: 'confidence-intervals',
    slug: 'confidence-intervals',
    title: 'Confidence Intervals',
    hook: 'A range that captures the truth 95% of the time — but not the way most people think.',
    description:
      'Build intervals, watch them capture or miss the true mean, and finally understand what 95% confidence actually guarantees.',
    tier: 'foundations',
    prerequisites: [],
    tags: ['statistics', 'inference', 'estimation'],
    hasLab: true,
    estimatedMinutes: 15,
  },
];
