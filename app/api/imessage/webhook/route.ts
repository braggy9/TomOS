import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { verifyBlooioSignature, sendImessage } from '@/lib/blooio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_IDLE_MS = 30 * 60 * 1000; // reset conversation after 30 min idle
const HISTORY_LIMIT = 20; // messages kept as Claude context
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Claude, acting as a personal AI assistant for Tom — a Senior Legal Counsel, single parent of two kids (Ziggy 7, Hetty 4), trail/ultra runner, and ADHD/CPTSD-aware productivity builder.

Key context:
- Active projects: job search via The Bison (consulting), MixTape Running Supply (e-commerce), TomOS (personal OS built on Notion + Vercel + Neon)
- 2026 A-races: Sunshine Coast Marathon (2 Aug), UTK 50km (26-28 Nov), coached by Greta at Rejoov
- Custody: alternating weeks Friday-to-Friday, kids are Ziggy (7, dragons/Pokémon/Minecraft) and Hetty (4, unicorns/crafts)
- Communication: direct, dry humour, no platitudes, no therapy-speak, call out spiralling and redirect to action
- ADHD-friendly: structured, low-friction, clear action items

Respond concisely. This is a mobile messaging interface — keep replies scannable. If a task needs logging, say so and confirm.`;

type MessageEntry = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export async function POST(request: NextRequest) {
  try {
    // Signature is computed over the exact bytes, so read raw text before parsing.
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-blooio-signature') ??
      request.headers.get('X-Blooio-Signature');
    const secret = process.env.BLOOIO_WEBHOOK_SECRET;

    if (!secret) {
      console.error('iMessage webhook: BLOOIO_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (!verifyBlooioSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Blooio's docs disagree on payload shape (flat vs nested under `data`); read both.
    const eventType: string = payload.event ?? payload.type ?? '';
    const data = payload.data ?? payload;
    const sender: string | undefined = data.sender ?? data.external_id ?? data.from;
    const text: string | undefined = data.text;

    // Only respond to genuine inbound messages. Ack everything else so Blooio stops retrying.
    if (eventType !== 'message.received') {
      return NextResponse.json({ ok: true, ignored: eventType || 'unknown' });
    }

    if (!sender || !text || !text.trim()) {
      return NextResponse.json({ ok: true, ignored: 'empty' });
    }

    // Guard against echo loops if our own number ever appears as the sender.
    if (process.env.BLOOIO_PHONE_NUMBER && sender === process.env.BLOOIO_PHONE_NUMBER) {
      return NextResponse.json({ ok: true, ignored: 'self' });
    }

    const now = new Date();

    const existing = await prisma.imessageSession.findUnique({
      where: { phoneNumber: sender },
    });

    const isExpired =
      !existing || now.getTime() - new Date(existing.lastActive).getTime() > SESSION_IDLE_MS;

    const history: MessageEntry[] = isExpired
      ? []
      : ((existing!.messages as unknown as MessageEntry[]) ?? []);

    const claudeMessages = history
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }));
    claudeMessages.push({ role: 'user', content: text });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const reply =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    if (!reply) {
      console.error('iMessage webhook: empty reply from Claude');
      return NextResponse.json({ error: 'No reply generated' }, { status: 502 });
    }

    const updatedMessages: MessageEntry[] = [
      ...history,
      { role: 'user', content: text, timestamp: now.toISOString() },
      { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
    ];

    await prisma.imessageSession.upsert({
      where: { phoneNumber: sender },
      create: {
        phoneNumber: sender,
        messages: updatedMessages as unknown as object,
        lastActive: now,
      },
      update: {
        messages: updatedMessages as unknown as object,
        lastActive: now,
      },
    });

    await sendImessage(sender, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in iMessage webhook:', error);
    return NextResponse.json(
      {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
