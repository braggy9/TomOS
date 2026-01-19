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
