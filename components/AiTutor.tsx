'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiTutorProps {
  labSlug: string;
  labState?: Record<string, unknown>;
}

const WELCOME_MESSAGES: Record<string, string> = {
  'normal-distribution': 'I can see your distribution. Ask me why the curve changes shape, what the shaded regions mean, or what this has to do with real data.',
  'gradient-descent': 'I can see your loss surface and current position. Ask me why we subtract the gradient, what happens with high learning rates, or what local minima mean.',
  'central-limit-theorem': 'I can see your sampling simulation. Ask me why the histogram normalizes, what sample size does, or why this theorem matters so much.',
  'mean-variance': 'I can see your dataset. Ask me why the mean chases outliers, when to use median instead, or what variance is actually measuring.',
  'hypothesis-testing': 'I can see your experiment. Ask me what a p-value really means, why p-hacking is a problem, or how to think about Type I vs Type II errors.',
  'confidence-intervals': 'I can see your confidence interval lab. Ask me what 95% confidence actually means, why the interval is random (not the true mean), or how CI width changes with sample size.',
  'neural-networks': 'I can see your neural network sandbox. Ask me what weights actually do, why activation functions matter, or why a single layer can\'t solve XOR.',
};
const DEFAULT_WELCOME = 'I can see your current sandbox. Ask me anything about what you are exploring.';

const SUGGESTIONS: Record<string, string[]> = {
  'normal-distribution': [
    'Why does σ² appear in the formula?',
    'What is the 68-95-99.7 rule?',
    'Why is this distribution everywhere?',
  ],
  'gradient-descent': [
    'Why subtract the gradient?',
    "What if the learning rate is too high?",
    'What is a local minimum?',
  ],
  'hypothesis-testing': [
    'What does p < 0.05 actually mean?',
    'Why is p-hacking a problem?',
    'How do I increase statistical power?',
  ],
  'confidence-intervals': [
    'What does 95% confidence actually mean?',
    'Why is the interval random, not the true mean?',
    'How does sample size affect CI width?',
  ],
  'neural-networks': [
    'What do weights actually do?',
    'Why do we need activation functions?',
    'Why can\'t a linear model solve XOR?',
  ],
};

export default function AiTutor({ labSlug, labState }: AiTutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    const userMsg: Message = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setIsStreaming(true);

    // Append placeholder for streaming response
    setMessages([...history, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          labSlug,
          labState,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string };
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages([...history, { role: 'assistant', content: accumulated }]);
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch {
      setMessages([
        ...history,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const suggestions = SUGGESTIONS[labSlug] ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="pt-4 pb-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <span className="text-blue-600 text-sm">✦</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {WELCOME_MESSAGES[labSlug] ?? DEFAULT_WELCOME}
              </p>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Try asking
                </p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.content ||
                  (isStreaming && i === messages.length - 1 ? (
                    <span className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : (
                    ''
                  ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask a question…"
            disabled={isStreaming}
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all resize-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            {isStreaming ? (
              <span className="w-4 h-4 block border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '↑'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
