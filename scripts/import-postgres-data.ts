/**
 * Import TomOS data from Notion export to Postgres
 * Transforms Notion format to Prisma format
 */

import { prisma } from '../lib/prisma';
import * as fs from 'fs';

interface NotionExport {
  tasks: any[];
  uniqueTags: string[];
  uniqueContexts: string[];
  metadata: {
    totalTasks: number;
    totalTags: number;
    totalContexts: number;
  };
}

interface IDMapping {
  tasks: Record<string, string>; // notionId → postgresId
  tags: Record<string, string>; // tagName → postgresId
}

// Helper: Extract text from Notion rich text
function extractText(richText: any[]): string {
  if (!richText || richText.length === 0) return '';
  return richText.map((rt: any) => rt.plain_text || rt.text?.content || '').join('');
}

// Helper: Extract select value
function extractSelect(select: any): string | null {
  return select?.name || null;
}

// Helper: Extract multi-select values
function extractMultiSelect(multiSelect: any[]): string[] {
  if (!multiSelect) return [];
  return multiSelect.map((ms: any) => ms.name).filter(Boolean);
}

// Helper: Extract date
function extractDate(date: any): Date | null {
  if (!date || !date.start) return null;
  return new Date(date.start);
}

// Helper: Map Notion priority to Prisma priority
function mapPriority(notionPriority: string | null): string {
  const priorityMap: Record<string, string> = {
    'Urgent': 'urgent',
    'Important': 'high',
    'Someday': 'low',
  };
  return priorityMap[notionPriority || ''] || 'medium';
}

// Helper: Map Notion status to Prisma status
function mapStatus(notionStatus: string | null): string {
  const statusMap: Record<string, string> = {
    'Inbox': 'todo',
    'To Do': 'todo',
    'In Progress': 'in_progress',
    'Done': 'done',
  };
  return statusMap[notionStatus || ''] || 'todo';
}

async function importToPostgres() {
  console.log('📥 Importing TomOS data to Postgres...\n');

  try {
    // Load export
    if (!fs.existsSync('notion-export.json')) {
      throw new Error('notion-export.json not found! Run export script first.');
    }

    const exportData: NotionExport = JSON.parse(
      fs.readFileSync('notion-export.json', 'utf-8')
    );

    const idMapping: IDMapping = {
      tasks: {},
      tags: {},
    };

    console.log(`Found ${exportData.metadata.totalTasks} tasks to import\n`);

    // Step 1: Create all unique tags (from contexts and tags)
    console.log('Creating tags...');
    const allTagNames = new Set<string>();

    // Add context tags
    for (const context of exportData.uniqueContexts) {
      allTagNames.add(`context:${context}`);
    }

    // Extract tags from all tasks
    for (const notionTask of exportData.tasks) {
      const props = notionTask.properties;

      // Regular tags
      const tags = extractMultiSelect(props.Tags?.multi_select);
      tags.forEach(tag => allTagNames.add(tag));

      // Energy, Time, Source as tags
      const energy = extractSelect(props.Energy?.select);
      if (energy) allTagNames.add(`energy:${energy}`);

      const time = extractSelect(props.Time?.select);
      if (time) allTagNames.add(`time:${time}`);

      const source = extractSelect(props.Source?.select);
      if (source) allTagNames.add(`source:${source}`);
    }

    // Create tags in Postgres
    for (const tagName of Array.from(allTagNames).sort()) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      });
      idMapping.tags[tagName] = tag.id;
      console.log(`  ✓ ${tagName}`);
    }

    console.log(`\nCreated ${allTagNames.size} tags\n`);

    // Step 2: Import Tasks
    console.log('Importing tasks...');
    let imported = 0;
    let skipped = 0;

    for (const notionTask of exportData.tasks) {
      try {
        const props = notionTask.properties;

        // Extract task data
        const title = extractText(props.Task?.title || props.Name?.title);
        if (!title) {
          console.log(`  ⚠ Skipping task with no title: ${notionTask.id}`);
          skipped++;
          continue;
        }

        const status = mapStatus(extractSelect(props.Status?.select));
        const priority = mapPriority(extractSelect(props.Priority?.select));
        const dueDate = extractDate(props['Due Date']?.date);
        const completedAt = status === 'done' ? new Date(notionTask.last_edited_time) : null;

        // Build description from subtasks and notes if available
        const descriptionParts: string[] = [];
        const description = extractText(props.Description?.rich_text);
        if (description) {
          descriptionParts.push(description);
        }

        // Create task
        const task = await prisma.task.create({
          data: {
            title,
            description: descriptionParts.join('\n') || null,
            status,
            priority,
            dueDate,
            completedAt,
            createdAt: new Date(notionTask.created_time),
            updatedAt: new Date(notionTask.last_edited_time),
          },
        });

        idMapping.tasks[notionTask.id] = task.id;

        // Link tags
        const taskTags: string[] = [];

        // Context tags
        const contexts = extractMultiSelect(props.Context?.multi_select);
        contexts.forEach(ctx => taskTags.push(`context:${ctx}`));

        // Regular tags
        const tags = extractMultiSelect(props.Tags?.multi_select);
        tags.forEach(tag => taskTags.push(tag));

        // Metadata tags
        const energy = extractSelect(props.Energy?.select);
        if (energy) taskTags.push(`energy:${energy}`);

        const time = extractSelect(props.Time?.select);
        if (time) taskTags.push(`time:${time}`);

        const source = extractSelect(props.Source?.select);
        if (source) taskTags.push(`source:${source}`);

        // Create task-tag links
        for (const tagName of taskTags) {
          const tagId = idMapping.tags[tagName];
          if (tagId) {
            await prisma.taskTag.create({
              data: {
                taskId: task.id,
                tagId: tagId,
              },
            });
          }
        }

        imported++;
        if (imported % 10 === 0) {
          console.log(`  Imported ${imported}/${exportData.metadata.totalTasks} tasks...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to import task ${notionTask.id}:`, error);
        skipped++;
      }
    }

    console.log(`\n✓ Imported ${imported} tasks`);
    if (skipped > 0) {
      console.log(`⚠ Skipped ${skipped} tasks`);
    }

    // Save ID mappings
    fs.writeFileSync(
      'id-mappings.json',
      JSON.stringify(idMapping, null, 2)
    );

    console.log('\n✅ Import complete!');
    console.log(`  Tasks imported: ${imported}`);
    console.log(`  Tags created: ${allTagNames.size}`);
    console.log(`  ID mappings saved to: id-mappings.json`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importToPostgres();
