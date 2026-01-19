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
