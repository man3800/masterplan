/**
 * Project Types
 * Based on actual DB schema: projects table
 */
export type ProjectStatus = "pending" | "in_progress" | "paused" | "done";

export interface Project {
  id: number;
  code: string | null;
  name: string;
  customer_code: string | null;
  customer_name: string | null;
  status: ProjectStatus;
  ordered_at: string | null; // ISO date string
  paused_at: string | null; // ISO date string
  completed_at: string | null; // ISO date string
  due_at: string | null; // ISO date string
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface ProjectCreate {
  code?: string | null;
  name: string;
  customer_code?: string | null;
  customer_name?: string | null;
  status?: ProjectStatus;
  ordered_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;
  due_at?: string | null;
}

export interface ProjectUpdate {
  code?: string | null;
  name?: string;
  customer_code?: string | null;
  customer_name?: string | null;
  status?: ProjectStatus;
  ordered_at?: string | null;
  paused_at?: string | null;
  completed_at?: string | null;
  due_at?: string | null;
}

export interface ProjectListParams {
  q?: string; // Search query
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
  sort?: string;
}

