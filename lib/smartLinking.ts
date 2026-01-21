import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ParsedLink {
  type: 'task' | 'matter' | 'project' | 'note';
  identifier: string;
  display: string;
  position: { start: number; end: number };
}

export interface SmartLinks {
  tasks: Array<{ id: string; title: string }>;
  matters: Array<{ id: string; title: string; matterNumber?: string | null }>;
  projects: Array<{ id: string; title: string }>;
  notes: Array<{ id: string; title: string }>;
}

/**
 * Parse content to extract smart link mentions
 * Patterns:
 * - @task-title or @"task title with spaces"
 * - #matter-123 or #matter-PUB-2026-001
 * - &project-name or &"project name"
 * - [[note-title]] (wiki-style)
 */
export function parseSmartLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];

  // Pattern 1: @task mentions
  // Matches: @task-name or @"task name with spaces"
  const taskPattern = /@(?:"([^"]+)"|([a-zA-Z0-9-_]+))/g;
  let match;

  while ((match = taskPattern.exec(content)) !== null) {
    links.push({
      type: 'task',
      identifier: match[1] || match[2],
      display: match[0],
      position: { start: match.index, end: taskPattern.lastIndex }
    });
  }

  // Pattern 2: #matter mentions
  // Matches: #matter-123, #PUB-2026-001, #CLT-001
  const matterPattern = /#([A-Z]{2,4}-\d{4}-\d{3}|matter-[a-zA-Z0-9-]+|\d+)/g;

  while ((match = matterPattern.exec(content)) !== null) {
    links.push({
      type: 'matter',
      identifier: match[1],
      display: match[0],
      position: { start: match.index, end: matterPattern.lastIndex }
    });
  }

  // Pattern 3: &project mentions
  // Matches: &project-name or &"project name"
  const projectPattern = /&(?:"([^"]+)"|([a-zA-Z0-9-_]+))/g;

  while ((match = projectPattern.exec(content)) !== null) {
    links.push({
      type: 'project',
      identifier: match[1] || match[2],
      display: match[0],
      position: { start: match.index, end: projectPattern.lastIndex }
    });
  }

  // Pattern 4: [[note]] mentions (wiki-style)
  // Matches: [[note title]]
  const notePattern = /\[\[([^\]]+)\]\]/g;

  while ((match = notePattern.exec(content)) !== null) {
    links.push({
      type: 'note',
      identifier: match[1],
      display: match[0],
      position: { start: match.index, end: notePattern.lastIndex }
    });
  }

  return links;
}

/**
 * Resolve parsed links to actual database entities
 */
export async function resolveSmartLinks(parsedLinks: ParsedLink[]): Promise<SmartLinks> {
  const links: SmartLinks = {
    tasks: [],
    matters: [],
    projects: [],
    notes: []
  };

  // Group by type for batch queries
  const taskIdentifiers = parsedLinks.filter(l => l.type === 'task').map(l => l.identifier);
  const matterIdentifiers = parsedLinks.filter(l => l.type === 'matter').map(l => l.identifier);
  const projectIdentifiers = parsedLinks.filter(l => l.type === 'project').map(l => l.identifier);
  const noteIdentifiers = parsedLinks.filter(l => l.type === 'note').map(l => l.identifier);

  // Resolve tasks
  if (taskIdentifiers.length > 0) {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { id: { in: taskIdentifiers } },
          { title: { in: taskIdentifiers, mode: 'insensitive' } }
        ]
      },
      select: { id: true, title: true }
    });
    links.tasks = tasks;
  }

  // Resolve matters
  if (matterIdentifiers.length > 0) {
    const matters = await prisma.matter.findMany({
      where: {
        OR: [
          { id: { in: matterIdentifiers } },
          { matterNumber: { in: matterIdentifiers } },
          { title: { in: matterIdentifiers, mode: 'insensitive' } }
        ]
      },
      select: { id: true, title: true, matterNumber: true }
    });
    links.matters = matters;
  }

  // Resolve projects
  if (projectIdentifiers.length > 0) {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { id: { in: projectIdentifiers } },
          { title: { in: projectIdentifiers, mode: 'insensitive' } }
        ]
      },
      select: { id: true, title: true }
    });
    links.projects = projects;
  }

  // Resolve notes (wiki-style linking)
  if (noteIdentifiers.length > 0) {
    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { id: { in: noteIdentifiers } },
          { title: { in: noteIdentifiers, mode: 'insensitive' } }
        ]
      },
      select: { id: true, title: true }
    });
    links.notes = notes;
  }

  return links;
}

/**
 * Process note content to extract and resolve smart links
 */
export async function processSmartLinks(content: string): Promise<{
  parsedLinks: ParsedLink[];
  resolvedLinks: SmartLinks;
}> {
  const parsedLinks = parseSmartLinks(content);
  const resolvedLinks = await resolveSmartLinks(parsedLinks);

  return { parsedLinks, resolvedLinks };
}

/**
 * Get backlinks for a note (all notes that link to this one)
 */
export async function getBacklinks(noteId: string): Promise<{
  id: string;
  title: string;
  excerpt: string | null;
  updatedAt: Date;
  linkContext: string;
}[]> {
  // Find the note's title first
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { title: true }
  });

  if (!note) {
    return [];
  }

  // Find all notes that link to this note
  // Either by ID reference in links JSON or by title mention in content
  const backlinks = await prisma.note.findMany({
    where: {
      OR: [
        {
          // Check if note ID is in the links JSON array
          links: {
            path: ['notes'],
            array_contains: [{ id: noteId }]
          }
        },
        {
          // Check if note title is mentioned wiki-style in content
          content: {
            contains: `[[${note.title}]]`,
            mode: 'insensitive'
          }
        }
      ],
      // Don't include the note itself
      NOT: {
        id: noteId
      }
    },
    select: {
      id: true,
      title: true,
      excerpt: true,
      content: true,
      updatedAt: true
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  // Extract context around the link mention
  return backlinks.map(backlink => {
    const linkPattern = new RegExp(`\\[\\[${note.title}\\]\\]`, 'i');
    const match = backlink.content.match(linkPattern);

    let linkContext = '';
    if (match && match.index !== undefined) {
      // Get 100 chars before and after the link
      const start = Math.max(0, match.index - 100);
      const end = Math.min(backlink.content.length, match.index + match[0].length + 100);
      linkContext = '...' + backlink.content.substring(start, end) + '...';
    }

    return {
      id: backlink.id,
      title: backlink.title,
      excerpt: backlink.excerpt,
      updatedAt: backlink.updatedAt,
      linkContext: linkContext || (backlink.excerpt || '')
    };
  });
}
