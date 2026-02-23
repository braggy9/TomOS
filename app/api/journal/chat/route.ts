import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { JOURNAL_BASE_PROMPT, buildDynamicContext } from '@/lib/journalPrompt';

const prisma = new PrismaClient();

// POST /api/journal/chat - Send a message in a journal conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    let conversationId = body.conversationId;
    let entryId = body.entryId || null;

    // Create conversation if none provided
    if (!conversationId) {
      const conversation = await prisma.journalConversation.create({
        data: {
          entryId,
          mode: body.mode || 'chat',
        },
      });
      conversationId = conversation.id;
    }

    // Save user message
    await prisma.journalMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: body.message,
      },
    });

    // Get conversation history
    const messages = await prisma.journalMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Get recent journal entries for context
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentEntries = await prisma.journalEntry.findMany({
      where: { entryDate: { gte: weekAgo } },
      orderBy: { entryDate: 'desc' },
      take: 5,
      select: {
        entryDate: true,
        mood: true,
        content: true,
        reflection: true,
      },
    });

    // If this conversation is linked to an entry, get it
    let entryContext = '';
    if (entryId) {
      const entry = await prisma.journalEntry.findUnique({
        where: { id: entryId },
      });
      if (entry) {
        entryContext = `\n\n## Current Entry Being Discussed\n**${entry.entryDate.toISOString().split('T')[0]}** (${entry.mood || 'no mood'})\n${entry.content}`;
      }
    }

    const dynamicContext = buildDynamicContext(
      recentEntries.map(e => ({
        entryDate: e.entryDate.toISOString().split('T')[0],
        mood: e.mood,
        content: e.content,
        reflection: e.reflection,
      }))
    );

    // Build system prompt with all context layers
    const systemPrompt = `${JOURNAL_BASE_PROMPT}

---

${dynamicContext}${entryContext}

---

## Session Info
Current time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
Conversation messages so far: ${messages.length}`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build message array for Claude
    const claudeMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const assistantContent = response.content[0].type === 'text' ? response.content[0].text : '';

    // Save assistant message
    const assistantMessage = await prisma.journalMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: assistantContent,
      },
    });

    // Update conversation title if first exchange
    if (messages.length <= 2) {
      const title = body.message.substring(0, 60) + (body.message.length > 60 ? '...' : '');
      await prisma.journalConversation.update({
        where: { id: conversationId },
        data: { title },
      }).catch(() => {}); // Non-blocking
    }

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        message: assistantMessage,
      },
    });
  } catch (error) {
    console.error('Error in journal chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/journal/chat?conversationId=xxx - Get conversation messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      // List recent conversations
      const conversations = await prisma.journalConversation.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          entry: {
            select: { id: true, title: true, entryDate: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: conversations,
      });
    }

    // Get specific conversation with all messages
    const conversation = await prisma.journalConversation.findUnique({
      where: { id: conversationId },
      include: {
        entry: {
          select: { id: true, title: true, content: true, mood: true, entryDate: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
