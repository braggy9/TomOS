# Session 2: API Migration to Prisma

**Duration:** 2-3 hours  
**Goal:** Migrate all API endpoints from Notion to Prisma  
**Prerequisites:** Session 1 complete, database schema deployed

---

## 📋 Overview

In this session, you'll:
1. Set up Prisma Client singleton
2. Create TypeScript type definitions
3. Migrate Task endpoints (GET, POST, PATCH, DELETE)
4. Migrate Project endpoints
5. Add error handling
6. Test all endpoints
7. Commit changes

**Claude Code Prompt:**
```
I'm starting Session 2 of the TomOS Postgres migration.

Session 1 is complete:
✓ Prisma installed
✓ Schema defined
✓ Database connected

Follow SESSION-2.md exactly. Start with Phase 1.
```

---

## Phase 1: Set Up Prisma Client (15 minutes)

### Step 1.1: Create Prisma Client Singleton

Create `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

// Prevent multiple Prisma Client instances in development
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Why a singleton?**
- Prevents connection pool exhaustion in development
- Next.js hot reloads would create new connections
- Production: One instance per deployment

**Checkpoint:** ✅ `lib/prisma.ts` created

---

## Phase 2: Create Type Definitions (20 minutes)

### Step 2.1: Task Types

Create `types/task.ts`:

```typescript
import { Task, Project, Tag } from '@prisma/client'

// Base Task (from Prisma)
export type TaskBase = Task

// Task with relations
export type TaskWithProject = Task & {
  project: Project | null
}

export type TaskWithTags = Task & {
  tags: Array<{
    tag: Tag
  }>
}

export type TaskWithRelations = Task & {
  project: Project | null
  tags: Array<{
    tag: Tag
  }>
}

// Input types for API
export type CreateTaskInput = {
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'done' | 'blocked'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string | null
  projectId?: string | null
  tagIds?: string[]
}

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  completedAt?: string | null
}

// Response type for API
export type TaskResponse = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  projectId: string | null
  project?: {
    id: string
    title: string
    color: string | null
  } | null
  tags?: Array<{
    id: string
    name: string
    color: string | null
  }>
  createdAt: string
  updatedAt: string
}
```

### Step 2.2: Project Types

Create `types/project.ts`:

```typescript
import { Project, Task } from '@prisma/client'

// Base Project (from Prisma)
export type ProjectBase = Project

// Project with relations
export type ProjectWithTasks = Project & {
  tasks: Task[]
}

// Input types for API
export type CreateProjectInput = {
  title: string
  description?: string
  color?: string
  icon?: string
  status?: 'active' | 'archived' | 'completed'
}

export type UpdateProjectInput = Partial<CreateProjectInput>

// Response type for API
export type ProjectResponse = {
  id: string
  title: string
  description: string | null
  color: string | null
  icon: string | null
  status: string
  taskCount?: number
  createdAt: string
  updatedAt: string
}
```

**Checkpoint:** ✅ Type definitions created

---

## Phase 3: Migrate Task Endpoints (60 minutes)

### Step 3.1: GET /api/tasks (List All Tasks)

**Old (Notion):**
```typescript
// pages/api/tasks.ts
const response = await notion.databases.query({
  database_id: TASKS_DB_ID,
})
```

**New (Prisma):**
```typescript
// pages/api/tasks.ts
import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { 
        status, 
        priority, 
        projectId,
        includeProject,
        includeTags
      } = req.query

      // Build where clause
      const where: any = {}
      if (status) where.status = status
      if (priority) where.priority = priority
      if (projectId) where.projectId = projectId

      // Build include clause
      const include: any = {}
      if (includeProject === 'true') {
        include.project = {
          select: {
            id: true,
            title: true,
            color: true,
          }
        }
      }
      if (includeTags === 'true') {
        include.tags = {
          include: {
            tag: true
          }
        }
      }

      const tasks = await prisma.task.findMany({
        where,
        include: Object.keys(include).length > 0 ? include : undefined,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { dueDate: 'asc' },
        ],
      })

      // Transform tags if included
      const transformedTasks = tasks.map(task => ({
        ...task,
        tags: task.tags?.map(tt => tt.tag),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        dueDate: task.dueDate?.toISOString() || null,
        completedAt: task.completedAt?.toISOString() || null,
      }))

      res.status(200).json(transformedTasks)
    } catch (error) {
      console.error('Error fetching tasks:', error)
      res.status(500).json({ error: 'Failed to fetch tasks' })
    }
  }
}
```

### Step 3.2: POST /api/tasks (Create Task)

```typescript
if (req.method === 'POST') {
  try {
    const { title, description, status, priority, dueDate, projectId, tagIds } = req.body

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' })
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        status: status || 'todo',
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            color: true,
          }
        }
      }
    })

    // Add tags if provided
    if (tagIds && tagIds.length > 0) {
      await prisma.taskTag.createMany({
        data: tagIds.map((tagId: string) => ({
          taskId: task.id,
          tagId,
        })),
      })
    }

    // Fetch complete task with tags
    const completeTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            color: true,
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      }
    })

    res.status(201).json({
      ...completeTask,
      tags: completeTask?.tags.map(tt => tt.tag),
    })
  } catch (error) {
    console.error('Error creating task:', error)
    res.status(500).json({ error: 'Failed to create task' })
  }
}
```

### Step 3.3: PATCH /api/tasks/[id] (Update Task)

Create `pages/api/tasks/[id].ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid task ID' })
  }

  if (req.method === 'PATCH') {
    try {
      const { title, description, status, priority, dueDate, projectId, tagIds, completedAt } = req.body

      // Build update data
      const updateData: any = {}
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (status !== undefined) {
        updateData.status = status
        // Auto-set completedAt when status becomes 'done'
        if (status === 'done' && !completedAt) {
          updateData.completedAt = new Date()
        } else if (status !== 'done') {
          updateData.completedAt = null
        }
      }
      if (priority !== undefined) updateData.priority = priority
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
      if (projectId !== undefined) updateData.projectId = projectId
      if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null

      // Update task
      const task = await prisma.task.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              color: true,
            }
          },
          tags: {
            include: {
              tag: true
            }
          }
        }
      })

      // Update tags if provided
      if (tagIds !== undefined) {
        // Remove all existing tags
        await prisma.taskTag.deleteMany({
          where: { taskId: id }
        })

        // Add new tags
        if (tagIds.length > 0) {
          await prisma.taskTag.createMany({
            data: tagIds.map((tagId: string) => ({
              taskId: id,
              tagId,
            })),
          })
        }

        // Refetch with updated tags
        const updatedTask = await prisma.task.findUnique({
          where: { id },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                color: true,
              }
            },
            tags: {
              include: {
                tag: true
              }
            }
          }
        })

        return res.status(200).json({
          ...updatedTask,
          tags: updatedTask?.tags.map(tt => tt.tag),
        })
      }

      res.status(200).json({
        ...task,
        tags: task.tags.map(tt => tt.tag),
      })
    } catch (error) {
      console.error('Error updating task:', error)
      res.status(500).json({ error: 'Failed to update task' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Delete task (cascade deletes task_tags automatically)
      await prisma.task.delete({
        where: { id }
      })

      res.status(204).end()
    } catch (error) {
      console.error('Error deleting task:', error)
      res.status(500).json({ error: 'Failed to delete task' })
    }
  }

  if (req.method === 'GET') {
    try {
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              color: true,
            }
          },
          tags: {
            include: {
              tag: true
            }
          }
        }
      })

      if (!task) {
        return res.status(404).json({ error: 'Task not found' })
      }

      res.status(200).json({
        ...task,
        tags: task.tags.map(tt => tt.tag),
      })
    } catch (error) {
      console.error('Error fetching task:', error)
      res.status(500).json({ error: 'Failed to fetch task' })
    }
  }
}
```

**Checkpoint:** ✅ Task endpoints migrated

---

## Phase 4: Migrate Project Endpoints (30 minutes)

### Step 4.1: Projects API

Create `pages/api/projects.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { includeTaskCount } = req.query

      const projects = await prisma.project.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        ...(includeTaskCount === 'true' && {
          include: {
            _count: {
              select: { tasks: true }
            }
          }
        })
      })

      const transformedProjects = projects.map(project => ({
        ...project,
        taskCount: (project as any)._count?.tasks,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      }))

      res.status(200).json(transformedProjects)
    } catch (error) {
      console.error('Error fetching projects:', error)
      res.status(500).json({ error: 'Failed to fetch projects' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, description, color, icon, status } = req.body

      if (!title) {
        return res.status(400).json({ error: 'Title is required' })
      }

      const project = await prisma.project.create({
        data: {
          title,
          description: description || null,
          color: color || null,
          icon: icon || null,
          status: status || 'active',
        }
      })

      res.status(201).json(project)
    } catch (error) {
      console.error('Error creating project:', error)
      res.status(500).json({ error: 'Failed to create project' })
    }
  }
}
```

### Step 4.2: Individual Project API

Create `pages/api/projects/[id].ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' })
  }

  if (req.method === 'GET') {
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          _count: {
            select: { tasks: true }
          }
        }
      })

      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      res.status(200).json({
        ...project,
        taskCount: (project as any)._count.tasks,
      })
    } catch (error) {
      console.error('Error fetching project:', error)
      res.status(500).json({ error: 'Failed to fetch project' })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { title, description, color, icon, status } = req.body

      const updateData: any = {}
      if (title !== undefined) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (color !== undefined) updateData.color = color
      if (icon !== undefined) updateData.icon = icon
      if (status !== undefined) updateData.status = status

      const project = await prisma.project.update({
        where: { id },
        data: updateData,
      })

      res.status(200).json(project)
    } catch (error) {
      console.error('Error updating project:', error)
      res.status(500).json({ error: 'Failed to update project' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Delete project (sets projectId to null in tasks)
      await prisma.project.delete({
        where: { id }
      })

      res.status(204).end()
    } catch (error) {
      console.error('Error deleting project:', error)
      res.status(500).json({ error: 'Failed to delete project' })
    }
  }
}
```

**Checkpoint:** ✅ Project endpoints migrated

---

## Phase 5: Add Tag Endpoints (20 minutes)

Create `pages/api/tags.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const tags = await prisma.tag.findMany({
        orderBy: {
          name: 'asc'
        }
      })

      res.status(200).json(tags)
    } catch (error) {
      console.error('Error fetching tags:', error)
      res.status(500).json({ error: 'Failed to fetch tags' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, color } = req.body

      if (!name) {
        return res.status(400).json({ error: 'Name is required' })
      }

      const tag = await prisma.tag.create({
        data: {
          name,
          color: color || null,
        }
      })

      res.status(201).json(tag)
    } catch (error) {
      console.error('Error creating tag:', error)
      res.status(500).json({ error: 'Failed to create tag' })
    }
  }
}
```

**Checkpoint:** ✅ Tag endpoints created

---

## Phase 6: Test Endpoints (20 minutes)

### Step 6.1: Create Test Script

Create `scripts/test-api-endpoints.ts`:

```typescript
const API_URL = 'http://localhost:3000/api'

async function testEndpoints() {
  console.log('🧪 Testing API endpoints...\n')

  try {
    // Test 1: Create project
    console.log('Test 1: POST /api/projects')
    const projectRes = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Project',
        description: 'API test project',
        color: '#3b82f6',
        icon: '🧪',
      })
    })
    const project = await projectRes.json()
    console.log('✓ Created project:', project.id)

    // Test 2: Create task
    console.log('\nTest 2: POST /api/tasks')
    const taskRes = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Task',
        description: 'API test task',
        status: 'todo',
        priority: 'high',
        projectId: project.id,
      })
    })
    const task = await taskRes.json()
    console.log('✓ Created task:', task.id)

    // Test 3: Get all tasks
    console.log('\nTest 3: GET /api/tasks')
    const tasksRes = await fetch(`${API_URL}/tasks?includeProject=true`)
    const tasks = await tasksRes.json()
    console.log('✓ Fetched', tasks.length, 'tasks')

    // Test 4: Update task
    console.log('\nTest 4: PATCH /api/tasks/[id]')
    const updateRes = await fetch(`${API_URL}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'done',
      })
    })
    const updatedTask = await updateRes.json()
    console.log('✓ Updated task status:', updatedTask.status)

    // Test 5: Delete task
    console.log('\nTest 5: DELETE /api/tasks/[id]')
    await fetch(`${API_URL}/tasks/${task.id}`, { method: 'DELETE' })
    console.log('✓ Deleted task')

    // Test 6: Delete project
    console.log('\nTest 6: DELETE /api/projects/[id]')
    await fetch(`${API_URL}/projects/${project.id}`, { method: 'DELETE' })
    console.log('✓ Deleted project')

    console.log('\n✅ ALL API TESTS PASSED\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

testEndpoints()
```

### Step 6.2: Run Tests

```bash
# Start dev server in one terminal
npm run dev

# Run tests in another terminal
npx ts-node scripts/test-api-endpoints.ts
```

**Expected output:**
```
✅ ALL API TESTS PASSED
```

**Checkpoint:** ✅ All endpoints tested and working

---

## Phase 7: Comment Out Notion Code (10 minutes)

**Don't delete yet** — keep as reference during parallel testing.

In your API files, comment out Notion imports and code:

```typescript
// OLD NOTION CODE - TO BE REMOVED IN SESSION 4
// import { Client } from '@notionhq/client'
// const notion = new Client({ auth: process.env.NOTION_API_KEY })
```

**Checkpoint:** ✅ Notion code commented out (not deleted)

---

## Phase 8: Commit Changes (10 minutes)

```bash
git add lib/prisma.ts
git add types/
git add pages/api/
git add scripts/test-api-endpoints.ts
git commit -m "feat: migrate API endpoints from Notion to Prisma"
git push
```

**Checkpoint:** ✅ Changes committed and pushed

---

## ✅ Session 2 Complete!

### What You Accomplished

- ✅ Set up Prisma Client singleton
- ✅ Created TypeScript type definitions
- ✅ Migrated Task endpoints (GET, POST, PATCH, DELETE)
- ✅ Migrated Project endpoints
- ✅ Created Tag endpoints
- ✅ Tested all endpoints
- ✅ Commented out Notion code
- ✅ Committed changes

### What's Different

**Before (Notion):**
```typescript
const response = await notion.databases.query({
  database_id: TASKS_DB_ID,
})
// Parse Notion's complex response format
```

**After (Prisma):**
```typescript
const tasks = await prisma.task.findMany({
  include: { project: true, tags: true }
})
// Clean, typed objects
```

---

## 🎯 Next Steps

**Before Session 3:**
1. Review `lib/prisma.ts` and understand the singleton pattern
2. Test API in Postman or your iOS app (should still use Notion data)
3. Read SESSION-3.md overview
4. **CRITICAL:** Back up Notion workspace before Session 3

**Session 3 Preview:**
- Export all data from Notion
- Import into Postgres
- Verify data integrity
- Parallel testing (24-48 hours)

---

**Ready for Session 3?** Open SESSION-3.md! 🚀

*Session 2 Guide v1.0 • January 15, 2026*
