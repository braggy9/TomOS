/**
 * Export TomOS data from Notion
 * Exports all tasks from the Notion database with all properties
 */

import { Client } from '@notionhq/client';
import * as fs from 'fs';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const TASKS_DB_ID = '739144099ebc4ba1ba619dd1a5a08d25';

interface NotionExport {
  tasks: any[];
  uniqueTags: string[];
  uniqueContexts: string[];
  exportedAt: string;
  metadata: {
    totalTasks: number;
    totalTags: number;
    totalContexts: number;
  };
}

async function exportNotionData() {
  console.log('📤 Exporting TomOS data from Notion...\n');

  try {
    const exportData: NotionExport = {
      tasks: [],
      uniqueTags: new Set() as any,
      uniqueContexts: new Set() as any,
      exportedAt: new Date().toISOString(),
      metadata: {
        totalTasks: 0,
        totalTags: 0,
        totalContexts: 0,
      },
    };

    // Export Tasks
    console.log('Exporting tasks from database:', TASKS_DB_ID);
    let hasMore = true;
    let startCursor: string | undefined = undefined;
    let pageCount = 0;

    while (hasMore) {
      const response = await (notion.databases as any).query({
        database_id: TASKS_DB_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      exportData.tasks.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
      pageCount++;

      console.log(`  Fetched page ${pageCount}: ${response.results.length} tasks...`);

      // Extract unique tags and contexts
      for (const task of response.results) {
        const props = task.properties;

        // Extract tags
        if (props.Tags?.multi_select) {
          props.Tags.multi_select.forEach((tag: any) => {
            (exportData.uniqueTags as any).add(tag.name);
          });
        }

        // Extract contexts
        if (props.Context?.multi_select) {
          props.Context.multi_select.forEach((context: any) => {
            (exportData.uniqueContexts as any).add(context.name);
          });
        }
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 350)); // ~3 requests/second
    }

    // Convert Sets to Arrays
    exportData.uniqueTags = Array.from(exportData.uniqueTags as any).sort();
    exportData.uniqueContexts = Array.from(exportData.uniqueContexts as any).sort();

    // Update metadata
    exportData.metadata.totalTasks = exportData.tasks.length;
    exportData.metadata.totalTags = exportData.uniqueTags.length;
    exportData.metadata.totalContexts = exportData.uniqueContexts.length;

    // Save to file
    const filename = 'notion-export.json';
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

    console.log('\n✅ Export complete!');
    console.log(`  Tasks: ${exportData.metadata.totalTasks}`);
    console.log(`  Unique Tags: ${exportData.metadata.totalTags}`);
    console.log(`  Unique Contexts: ${exportData.metadata.totalContexts}`);
    console.log(`  Saved to: ${filename}`);
    console.log(`\nTags found: ${exportData.uniqueTags.join(', ')}`);
    console.log(`\nContexts found: ${exportData.uniqueContexts.join(', ')}`);
  } catch (error) {
    console.error('❌ Export failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

exportNotionData();
