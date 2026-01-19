/**
 * API Endpoint Test Script
 * Tests all migrated Postgres endpoints
 *
 * Usage: USE_POSTGRES=true npx tsx scripts/test-api-endpoints.ts
 */

import { prisma } from '../lib/prisma';

async function testEndpoints() {
  console.log('🧪 Testing Postgres API Endpoints\n');
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Database Connection
    console.log('Test 1: Database connection...');
    const dbTest = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Database connected\n');
    testsPassed++;

    // Test 2: Create Task (simulates POST /api/task logic)
    console.log('Test 2: Create task...');
    const task = await prisma.task.create({
      data: {
        title: 'Test task from API test',
        description: 'Testing Postgres migration',
        status: 'todo',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      },
    });
    console.log(`✅ Created task: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Priority: ${task.priority}\n`);
    testsPassed++;

    // Test 3: Create Tags and Link to Task
    console.log('Test 3: Create and link tags...');
    const tagNames = ['urgent', 'context:Work', 'energy:High', 'source:Test'];
    for (const tagName of tagNames) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      });

      await prisma.taskTag.create({
        data: {
          taskId: task.id,
          tagId: tag.id,
        },
      });
    }
    console.log(`✅ Created and linked ${tagNames.length} tags\n`);
    testsPassed++;

    // Test 4: Query Task with Relations (simulates GET /api/all-tasks)
    console.log('Test 4: Query task with relations...');
    const taskWithRelations = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (taskWithRelations && taskWithRelations.tags.length === 4) {
      console.log(`✅ Retrieved task with ${taskWithRelations.tags.length} tags`);
      console.log(`   Tags: ${taskWithRelations.tags.map(tt => tt.tag.name).join(', ')}\n`);
      testsPassed++;
    } else {
      console.log(`❌ Expected 4 tags, got ${taskWithRelations?.tags.length || 0}\n`);
      testsFailed++;
    }

    // Test 5: Update Task (simulates PATCH /api/task/[id])
    console.log('Test 5: Update task...');
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'in_progress',
        title: 'Updated test task',
      },
    });

    if (updatedTask.status === 'in_progress' && updatedTask.title === 'Updated test task') {
      console.log('✅ Task updated successfully');
      console.log(`   New status: ${updatedTask.status}`);
      console.log(`   New title: ${updatedTask.title}\n`);
      testsPassed++;
    } else {
      console.log('❌ Task update failed\n');
      testsFailed++;
    }

    // Test 6: Complete Task (simulates PATCH /api/task/[id]/complete)
    console.log('Test 6: Mark task as complete...');
    const completedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'done',
        completedAt: new Date(),
      },
    });

    if (completedTask.status === 'done' && completedTask.completedAt) {
      console.log('✅ Task marked as complete');
      console.log(`   Status: ${completedTask.status}`);
      console.log(`   Completed at: ${completedTask.completedAt.toISOString()}\n`);
      testsPassed++;
    } else {
      console.log('❌ Task completion failed\n');
      testsFailed++;
    }

    // Test 7: Query All Tasks (simulates GET /api/all-tasks)
    console.log('Test 7: Query all tasks...');
    const allTasks = await prisma.task.findMany({
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
      take: 10,
    });
    console.log(`✅ Retrieved ${allTasks.length} tasks\n`);
    testsPassed++;

    // Test 8: Create Project and Link to Task
    console.log('Test 8: Create project and link to task...');
    const project = await prisma.project.create({
      data: {
        title: 'Test Project',
        description: 'Testing project relations',
        color: '#3b82f6',
        icon: '🧪',
        status: 'active',
      },
    });

    const taskWithProject = await prisma.task.update({
      where: { id: task.id },
      data: {
        projectId: project.id,
      },
      include: {
        project: true,
      },
    });

    if (taskWithProject.project && taskWithProject.project.title === 'Test Project') {
      console.log('✅ Project created and linked to task');
      console.log(`   Project: ${taskWithProject.project.title}`);
      console.log(`   Icon: ${taskWithProject.project.icon}\n`);
      testsPassed++;
    } else {
      console.log('❌ Project linking failed\n');
      testsFailed++;
    }

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.taskTag.deleteMany({
      where: { taskId: task.id },
    });
    await prisma.task.delete({
      where: { id: task.id },
    });
    await prisma.project.delete({
      where: { id: project.id },
    });
    // Clean up test tags
    await prisma.tag.deleteMany({
      where: {
        name: {
          in: tagNames,
        },
      },
    });
    console.log('✅ Test data cleaned up\n');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log('═══════════════════════════════════════\n');

    if (testsFailed === 0) {
      console.log('🎉 All tests passed! Postgres migration is working correctly.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testEndpoints();
