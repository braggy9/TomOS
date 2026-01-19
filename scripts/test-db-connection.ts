import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function testConnection() {
  try {
    console.log('🔌 Testing Postgres connection...\n')

    // Test 1: Raw query
    console.log('Test 1: Raw query')
    const result = await prisma.$queryRaw`SELECT NOW()`
    console.log('✓ Connected to Postgres')
    console.log('  Server time:', result)

    // Test 2: Create project
    console.log('\nTest 2: Create project')
    const project = await prisma.project.create({
      data: {
        title: 'Test Project',
        description: 'Testing Postgres connection',
        color: '#3b82f6',
        icon: '🧪',
      },
    })
    console.log('✓ Created project:', project.id)

    // Test 3: Create task
    console.log('\nTest 3: Create task')
    const task = await prisma.task.create({
      data: {
        title: 'Test Task',
        description: 'Testing task creation',
        status: 'todo',
        priority: 'high',
        projectId: project.id,
      },
    })
    console.log('✓ Created task:', task.id)

    // Test 4: Query with relation
    console.log('\nTest 4: Query with relation')
    const taskWithProject = await prisma.task.findUnique({
      where: { id: task.id },
      include: { project: true },
    })
    console.log('✓ Loaded task with project:', taskWithProject?.project?.title)

    // Test 5: Create tag and link to task
    console.log('\nTest 5: Create tag and link')
    const tag = await prisma.tag.create({
      data: { name: 'test', color: '#10b981' },
    })
    await prisma.taskTag.create({
      data: {
        taskId: task.id,
        tagId: tag.id,
      },
    })
    console.log('✓ Created tag and linked to task')

    // Test 6: Complex query
    console.log('\nTest 6: Complex query with all relations')
    const tasks = await prisma.task.findMany({
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })
    console.log('✓ Loaded', tasks.length, 'tasks with relations')

    // Cleanup
    console.log('\nCleaning up test data...')
    await prisma.taskTag.deleteMany()
    await prisma.task.deleteMany()
    await prisma.tag.deleteMany()
    await prisma.project.deleteMany()
    console.log('✓ Cleanup complete')

    console.log('\n✅ ALL TESTS PASSED\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
