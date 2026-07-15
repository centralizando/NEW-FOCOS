export interface Milestone {
  id: number;
  task_id: number;
  date_string: string;
  label: string;
  target_progress: number;
  description: string;
  completed: boolean;
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
