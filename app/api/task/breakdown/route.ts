import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import Anthropic from '@anthropic-ai/sdk';

const NOTION_DATABASE_ID = '739144099ebc4ba1ba619dd1a5a08d25';

/**
 * Smart Task Breakdown
 *
 * Automatically detects complex tasks and breaks them down into actionable subtasks.
 * Uses Claude AI to generate context-aware, realistic subtasks based on:
 * - Task complexity
 * - Your existing task patterns
 * - Optimal granularity for execution
 */

interface BreakdownRequest {
  taskId: string;  // Notion page ID
  autoApply?: boolean;  // If true, automatically add subtasks to Notion
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, autoApply = false }: BreakdownRequest = body;

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    if (!process.env.NOTION_API_KEY || !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Missing API keys' },
        { status: 500 }
      );
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Fetch the task from Notion
    const page = await notion.pages.retrieve({ page_id: taskId });
    const props = (page as any).properties;

    const taskTitle = props.Task?.title?.[0]?.plain_text || 'Untitled';
    const context = props.Context?.multi_select?.map((c: any) => c.name).join(', ') || 'None';
    const priority = props.Priority?.select?.name || 'Someday';
    const dueDate = props['Due Date']?.date?.start || null;

    // Get task blocks (description, existing subtasks)
    const blocks = await notion.blocks.children.list({
      block_id: taskId,
      page_size: 50,
    });

    const existingContent = blocks.results
      .map((block: any) => {
        if (block.type === 'paragraph') {
          return block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        }
        if (block.type === 'to_do') {
          return `- ${block.to_do?.rich_text?.map((t: any) => t.plain_text).join('')}`;
        }
        return '';
      })
      .filter((text) => text.length > 0)
      .join('\n');

    // Ask Claude to break down the task
    const prompt = `You are a productivity expert analyzing a task for breakdown into subtasks.

Task: "${taskTitle}"
Context: ${context}
Priority: ${priority}
Due Date: ${dueDate || 'None'}
${existingContent ? `\nExisting notes/subtasks:\n${existingContent}` : ''}

Analyze this task and determine:
1. Is this a complex task that should be broken down? (Yes/No)
2. If yes, what are 3-8 concrete, actionable subtasks?

Guidelines:
- Only break down if task is genuinely complex (>30 min, multiple steps)
- Each subtask should be specific and actionable (not vague)
- Subtasks should be in logical order
- Each subtask should take 5-30 minutes
- Don't over-fragment simple tasks

Respond in this exact JSON format:
{
  "shouldBreakdown": true/false,
  "reason": "Brief explanation why",
  "subtasks": ["Subtask 1", "Subtask 2", ...] or []
}`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiContent = aiResponse.content[0];
    if (aiContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse Claude's response
    let jsonText = aiContent.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
    }

    const breakdown = JSON.parse(jsonText);

    // If autoApply is true and breakdown is recommended, add subtasks to Notion
    if (autoApply && breakdown.shouldBreakdown && breakdown.subtasks.length > 0) {
      // Add subtasks as to-do blocks
      const subtaskBlocks = breakdown.subtasks.map((subtask: string) => ({
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [{ type: 'text' as const, text: { content: subtask } }],
          checked: false,
        },
      }));

      // Add heading before subtasks
      const heading = {
        object: 'block' as const,
        type: 'heading_3' as const,
        heading_3: {
          rich_text: [
            {
              type: 'text' as const,
              text: { content: '🤖 AI-Generated Subtasks' },
            },
          ],
        },
      };

      await notion.blocks.children.append({
        block_id: taskId,
        children: [heading, ...subtaskBlocks],
      });

      console.log(`Auto-applied ${breakdown.subtasks.length} subtasks to task: ${taskTitle}`);
    }

    return NextResponse.json({
      success: true,
      taskTitle,
      shouldBreakdown: breakdown.shouldBreakdown,
      reason: breakdown.reason,
      subtasks: breakdown.subtasks,
      applied: autoApply && breakdown.shouldBreakdown,
      subtaskCount: breakdown.subtasks.length,
    });
  } catch (error) {
    console.error('Error breaking down task:', error);
    return NextResponse.json(
      {
        error: 'Failed to break down task',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
