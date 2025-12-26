/**
 * Task Types
 * Based on actual DB schema: tasks table
 */
export type TaskStatus = "open" | "closed" | "in_progress" | string;

export interface Task {
  id: number;
  project_id: number;
  project_name: string | null; // JOIN from projects.name
  classification_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  baseline_start: string | null; // ISO datetime string
  baseline_end: string | null; // ISO datetime string
  actual_start_date: string | null; // ISO date string
  actual_end_date: string | null; // ISO date string
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface TaskCreate {
  project_id: number;
  classification_id: number;
  title: string;
  description?: string | null;
  status?: string;
  baseline_start?: string | null;
  baseline_end?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  status?: string;
  classification_id?: number;
  baseline_start?: string | null;
  baseline_end?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}

export interface TaskListParams {
  q?: string; // Search query
  status?: string;
  project_id?: number;
  classification_id?: number;
  limit?: number;
  offset?: number;
  sort?: string;
}

