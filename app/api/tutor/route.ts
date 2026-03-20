import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt } from '@/lib/prompts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, labSlug, labState } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      labSlug: string;
      labState?: Record<string, unknown>;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: getSystemPrompt(labSlug ?? '', labState),
            messages,
          });

          for await (const event of anthropicStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const payload = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
