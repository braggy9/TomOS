/**
 * MatterOS TypeScript Types
 * Legal matter management types for TomOS ecosystem
 */

export type MatterType =
  | 'contract'
  | 'dispute'
  | 'compliance'
  | 'advisory'
  | 'employment'
  | 'ip'
  | 'regulatory';

export type MatterStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export type MatterPriority = 'low' | 'medium' | 'high' | 'urgent';

export type BillingStatus =
  | 'billable'
  | 'non_billable'
  | 'fixed_fee'
  | 'time_and_materials';

export type DocumentType =
  | 'contract'
  | 'email'
  | 'memo'
  | 'correspondence'
  | 'court_filing'
  | 'research';

export type DocumentStatus = 'draft' | 'final' | 'executed' | 'superseded';

export type EventType =
  | 'status_change'
  | 'document_added'
  | 'task_completed'
  | 'note_added'
  | 'meeting'
  | 'deadline';

export type NoteType =
  | 'general'
  | 'decision'
  | 'analysis'
  | 'research'
  | 'meeting_notes';

export interface Matter {
  id: string;
  title: string;
  description: string | null;
  client: string;
  matterNumber: string | null;
  type: MatterType;
  status: MatterStatus;
  priority: MatterPriority;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date;
  budget: number | null;
  actualSpend: number | null;
  billingStatus: BillingStatus | null;
  clientContact: string | null;
  leadCounsel: string | null;
  teamMembers: string[];
  externalCounsel: string[];
  practiceArea: string | null;
  jurisdiction: string | null;
  tags: string[];
}

export interface MatterDocument {
  id: string;
  matterId: string;
  title: string;
  type: DocumentType;
  description: string | null;
  fileUrl: string | null;
  localPath: string | null;
  version: string | null;
  status: DocumentStatus | null;
  author: string | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  signedAt: Date | null;
  expiresAt: Date | null;
}

export interface MatterEvent {
  id: string;
  matterId: string;
  type: EventType;
  title: string;
  description: string | null;
  actor: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface MatterNote {
  id: string;
  matterId: string;
  title: string | null;
  content: string;
  type: NoteType;
  author: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types

export interface CreateMatterRequest {
  title: string;
  description?: string;
  client: string;
  matterNumber?: string;
  type: MatterType;
  status?: MatterStatus;
  priority?: MatterPriority;
  dueDate?: string;
  budget?: number;
  billingStatus?: BillingStatus;
  clientContact?: string;
  leadCounsel?: string;
  teamMembers?: string[];
  externalCounsel?: string[];
  practiceArea?: string;
  jurisdiction?: string;
  tags?: string[];
  createdBy?: string;
}

export interface UpdateMatterRequest {
  title?: string;
  description?: string;
  client?: string;
  matterNumber?: string;
  type?: MatterType;
  status?: MatterStatus;
  priority?: MatterPriority;
  dueDate?: string;
  completedAt?: string;
  budget?: number;
  actualSpend?: number;
  billingStatus?: BillingStatus;
  clientContact?: string;
  leadCounsel?: string;
  teamMembers?: string[];
  externalCounsel?: string[];
  practiceArea?: string;
  jurisdiction?: string;
  tags?: string[];
  updatedBy?: string;
}

export interface CreateDocumentRequest {
  title: string;
  type: DocumentType;
  description?: string;
  fileUrl?: string;
  localPath?: string;
  version?: string;
  status?: DocumentStatus;
  author?: string;
  reviewedBy?: string;
  signedAt?: string;
  expiresAt?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  type?: DocumentType;
  description?: string;
  fileUrl?: string;
  localPath?: string;
  version?: string;
  status?: DocumentStatus;
  author?: string;
  reviewedBy?: string;
  signedAt?: string;
  expiresAt?: string;
}

export interface CreateEventRequest {
  type: EventType;
  title: string;
  description?: string;
  actor?: string;
  metadata?: Record<string, any>;
}

export interface CreateNoteRequest {
  title?: string;
  content: string;
  type?: NoteType;
  author?: string;
  tags?: string[];
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  type?: NoteType;
  author?: string;
  tags?: string[];
}

// API Response Wrappers

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Extended Matter with related data

export interface MatterWithRelations extends Matter {
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
  }>;
  _count?: {
    documents: number;
    events: number;
    notes: number;
    tasks: number;
  };
  documents?: MatterDocument[];
  events?: MatterEvent[];
  notes?: MatterNote[];
}
