import { NextResponse } from 'next/server';

export async function GET() {
  const notionKey = process.env.NOTION_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    notionKeyExists: !!notionKey,
    notionKeyLength: notionKey?.length || 0,
    notionKeyFirstCharCode: notionKey?.charCodeAt(0) || 0,
    anthropicKeyExists: !!anthropicKey,
    anthropicKeyLength: anthropicKey?.length || 0,
    environment: process.env.VERCEL_ENV || 'local',
  });
}
