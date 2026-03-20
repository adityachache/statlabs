# Statlab

**Learn data science and machine learning by doing, not reading.**

Every concept is a sandbox. Drag sliders, run experiments, break things on purpose — and ask the AI tutor when you get stuck. Theory follows intuition here.

🔗 **Live demo: [statlab-three.vercel.app](https://statlab-three.vercel.app)**

---

## What is Statlab?

Most people struggle with stats and ML not because they're hard, but because the learning material is passive. You read about gradient descent, nod along, close the tab, and retain almost nothing.

Statlab fixes that. Every concept has an interactive lab where you manipulate the idea directly — and an AI tutor that can see exactly what you're doing and explain it in plain English.

---

## Labs available

### Stats Foundations
| Lab | What you'll learn |
|-----|-------------------|
| Normal Distribution | Drag mean and std dev, watch the bell curve reshape in real time |
| Central Limit Theorem | Watch any distribution — uniform, skewed, bimodal — produce a normal curve as sample size grows |
| Mean & Variance | Drag data points on a number line, see how outliers pull the mean but not the median |
| Hypothesis Testing & p-values | Run experiments, discover p-hacking, understand Type I & II errors |
| Confidence Intervals | Watch 100 intervals get built and count how many capture the true mean |

### Core ML *(coming soon)*
- Linear Regression
- Bias-Variance Tradeoff
- Loss Functions
- Overfitting & Regularization
- Decision Trees

### Advanced *(coming soon)*
- Neural Networks
- Backpropagation
- Attention Mechanism
- Embeddings
- K-Means Clustering

---

## Tech stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **D3.js** for all interactive visualizations
- **Claude API** (Sonnet) for the AI tutor
- **Vercel** for deployment

---

## Run it locally

**Prerequisites:** Node.js 18+, an Anthropic API key ([get one here](https://console.anthropic.com))

```bash
# 1. Clone the repo
git clone https://github.com/your-username/statlab.git
cd statlab

# 2. Install dependencies
npm install

# 3. Add your API key
cp .env.example .env.local
# Open .env.local and add: ANTHROPIC_API_KEY=sk-ant-your-key-here

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start learning.

---

## How each lab works

Every lab follows the same structure:

1. **Hook** — one sentence that makes you feel the problem before any explanation
2. **Sandbox** — interactive controls you manipulate directly (sliders, draggable points, buttons)
3. **Progressive tips** — hints that unlock as you explore, not all at once
4. **AI tutor** — context-aware assistant that can see your current sandbox state and answers questions in plain English

The AI tutor knows which lab you're on and what you're currently looking at. Ask it anything.

---

## Project structure

```
statlab/
├── app/
│   ├── page.tsx                  # Concept map homepage
│   ├── lab/[slug]/page.tsx       # Individual lab page
│   └── api/tutor/route.ts        # Claude API streaming endpoint
├── components/
│   ├── ConceptMap.tsx            # Homepage grid
│   ├── LabShell.tsx              # Lab layout with tutor sidebar
│   ├── AiTutor.tsx               # Chat interface
│   ├── TipCard.tsx               # Progressive tip cards
│   └── labs/
│       ├── NormalDistribution.tsx
│       ├── CentralLimitTheorem.tsx
│       ├── MeanVariance.tsx
│       ├── HypothesisTesting.tsx
│       └── ConfidenceIntervals.tsx
├── lib/
│   ├── concepts.ts               # Curriculum data
│   ├── prompts.ts                # AI tutor system prompts
│   ├── tips.ts                   # localStorage helpers
│   └── useTips.ts                # Tips state hook
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — get one at console.anthropic.com |

---

## Deploying to Vercel

```bash
npm install -g vercel
vercel login
vercel
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

---

## Contributing

This project is actively being built. Planned labs are listed above — contributions welcome, especially for Core ML and Advanced topics.

If you find a bug or have a suggestion, open an issue.

---

## License

MIT
