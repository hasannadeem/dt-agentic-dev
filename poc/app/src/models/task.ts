export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate: string | null;
}
