import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/imessage/health - quick check that the bridge is wired up
export async function GET() {
  let dbOk = false;
  let sessionCount: number | null = null;
  try {
    sessionCount = await prisma.imessageSession.count();
    dbOk = true;
  } catch (error) {
    console.error('iMessage health: DB check failed:', error);
  }

  return NextResponse.json({
    ok: true,
    service: 'imessage-bridge',
    db: { connected: dbOk, sessions: sessionCount },
    env: {
      blooioWebhookSecret: !!process.env.BLOOIO_WEBHOOK_SECRET,
      blooioApiKey: !!process.env.BLOOIO_API_KEY,
      blooioPhoneNumber: !!process.env.BLOOIO_PHONE_NUMBER,
      anthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
    },
    environment: process.env.VERCEL_ENV || 'local',
  });
}
