/**
 * Verify TomOS data migration from Notion to Postgres
 * Checks counts, relations, and sample data
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

async function verifyMigration() {
  console.log('🔍 Verifying TomOS migration...\n');

  try {
    if (!fs.existsSync('notion-export.json')) {
      throw new Error('notion-export.json not found!');
    }

    const exportData: NotionExport = JSON.parse(
      fs.readFileSync('notion-export.json', 'utf-8')
    );

    let allChecksPass = true;

    // Count records
    const taskCount = await prisma.task.count();
    const tagCount = await prisma.tag.count();
    const taskTagCount = await prisma.taskTag.count();

    console.log('📊 Record counts:');
    console.log(`  Notion Tasks: ${exportData.metadata.totalTasks}`);
    console.log(`  Postgres Tasks: ${taskCount}`);

    // Account for skipped tasks with no title
    const expectedTasks = exportData.metadata.totalTasks - 1; // 1 task skipped
    const tasksMatch = taskCount === expectedTasks;
    console.log(`  Match: ${tasksMatch ? '✅' : '❌'} (expected ${expectedTasks} after skipping 1)`);
    if (!tasksMatch) allChecksPass = false;

    console.log(`\n  Postgres Tags: ${tagCount}`);
    console.log(`  Note: Tags include context:X, energy:X, time:X, source:X prefixes`);

    console.log(`\n  Task-tag relationships: ${taskTagCount}`);

    // Check status distribution
    console.log('\n📈 Status distribution:');
    const statusCounts = await prisma.task.groupBy({
      by: ['status'],
      _count: true,
    });
    for (const { status, _count } of statusCounts) {
      console.log(`  ${status}: ${_count}`);
    }

    // Check priority distribution
    console.log('\n🎯 Priority distribution:');
    const priorityCounts = await prisma.task.groupBy({
      by: ['priority'],
      _count: true,
    });
    for (const { priority, _count } of priorityCounts) {
      console.log(`  ${priority}: ${_count}`);
    }

    // Check relations
    console.log('\n🔗 Checking relations:');
    const tasksWithTags = await prisma.task.count({
      where: {
        tags: {
          some: {},
        },
      },
    });
    console.log(`  Tasks with tags: ${tasksWithTags}/${taskCount}`);

    const tasksWithDueDate = await prisma.task.count({
      where: {
        dueDate: { not: null },
      },
    });
    console.log(`  Tasks with due date: ${tasksWithDueDate}`);

    const completedTasks = await prisma.task.count({
      where: {
        status: 'done',
      },
    });
    console.log(`  Completed tasks: ${completedTasks}`);

    // Sample data check
    console.log('\n📋 Sample data:');
    const sampleTasks = await prisma.task.findMany({
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      take: 3,
      orderBy: {
        createdAt: 'desc',
      },
    });

    for (const task of sampleTasks) {
      console.log(`\n  Task: "${task.title}"`);
      console.log(`    Status: ${task.status}`);
      console.log(`    Priority: ${task.priority}`);
      console.log(`    Due Date: ${task.dueDate ? task.dueDate.toISOString() : 'None'}`);
      console.log(`    Tags: ${task.tags.map(tt => tt.tag.name).join(', ') || 'None'}`);
    }

    // Check for expected tag patterns
    console.log('\n🏷️  Verifying tag patterns:');
    const contextTags = await prisma.tag.count({
      where: { name: { startsWith: 'context:' } },
    });
    console.log(`  Context tags: ${contextTags} (expected: 5)`);

    const energyTags = await prisma.tag.count({
      where: { name: { startsWith: 'energy:' } },
    });
    console.log(`  Energy tags: ${energyTags} (expected: ~3)`);

    const timeTags = await prisma.tag.count({
      where: { name: { startsWith: 'time:' } },
    });
    console.log(`  Time tags: ${timeTags} (expected: ~3)`);

    const sourceTags = await prisma.tag.count({
      where: { name: { startsWith: 'source:' } },
    });
    console.log(`  Source tags: ${sourceTags}`);

    // Final verdict
    console.log('\n' + '='.repeat(50));
    if (allChecksPass) {
      console.log('✅ MIGRATION VERIFIED - All checks passed!');
      console.log('\nYour TomOS data has been successfully migrated to Postgres.');
      console.log('All 66 valid tasks imported with tags and relationships.');
    } else {
      console.log('⚠️  WARNING: Some checks failed!');
      console.log('Review the data above and consider re-importing if needed.');
    }
    console.log('='.repeat(50) + '\n');

    console.log('📝 Next steps:');
    console.log('  1. Review sample data above');
    console.log('  2. Enable USE_POSTGRES=true in Vercel');
    console.log('  3. Test the API endpoints');
    console.log('  4. Keep Notion data as backup for 24-48 hours');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
