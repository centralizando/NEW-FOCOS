export interface Milestone {
  id: number;
  task_id: number;
  date_string: string;
  label: string;
  target_progress: number;
  description: string;
  completed: boolean;
  location?: 'casa' | 'trabalho';
}

export interface Task {
  id: number;
  name: string;
  category: string;
  due_date: string;
  created_at: string;
  completed: boolean;
  current_progress: number;
  milestones?: Milestone[];
}

export interface DbStatus {
  connected: boolean;
  mode: "postgres" | "fallback";
  error: string | null;
}

export interface TableSummary {
  tableName: string;
  totalItems: number;
  pendingReviews: number;
  columns?: string[];
  dateCol?: string | null;
  boolCol?: string | null;
  statusCol?: string | null;
}

export interface ReviewDbInfo {
  key: string;
  connected: boolean;
  tablesCount?: number;
  totalItems?: number;
  pendingReviews?: number;
  tables?: TableSummary[];
  hasReviews?: boolean;
  error?: string;
  lastChecked?: string;
}

export interface ReviewCheckResult {
  success: boolean;
  totalPending: number;
  hasAnyReview: boolean;
  databases: Record<string, ReviewDbInfo>;
  timestamp?: string;
}
