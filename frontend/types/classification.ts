/**
 * Classification Types
 * Based on actual DB schema: classifications table
 */
export interface Classification {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  depth: number;
  path: string;
  sort_no: number;
  is_active: boolean;
  owner_dept_id: number | null;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface ClassificationTreeNode extends Classification {
  children: ClassificationTreeNode[];
}

export interface ClassificationCreate {
  project_id: number;
  parent_id?: number | null;
  name: string;
  sort_no?: number;
  is_active?: boolean;
  owner_dept_id?: number | null;
}

export interface ClassificationUpdate {
  name?: string;
  parent_id?: number | null;
  sort_no?: number;
  is_active?: boolean;
  owner_dept_id?: number | null;
}

export interface ClassificationListParams {
  project_id?: number;
  parent_id?: number | null;
  is_active?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
}

