// Core domain model. Everything here is plain JSON so it can be persisted
// to localStorage and sent over the wire to the agent API.

export type Priority = 1 | 2 | 3 | 4; // 1 = urgent, 4 = none

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  estimateMinutes?: number;
  byAgent?: boolean;
}

export interface Deliverable {
  id: string;
  title: string;
  content: string; // markdown
  agentId: string;
  createdAt: number;
}

export interface Source {
  title: string;
  url: string;
}

export type TimelineItem =
  | { id: string; kind: "user"; text: string; at: number }
  | { id: string; kind: "text"; text: string; at: number }
  | { id: string; kind: "thinking"; text: string; at: number; done?: boolean }
  | { id: string; kind: "step"; label: string; detail?: string; icon: StepIcon; at: number }
  | { id: string; kind: "sources"; sources: Source[]; at: number }
  | { id: string; kind: "draft"; title: string; content: string; at: number; done?: boolean }
  | { id: string; kind: "question"; question: string; at: number }
  | { id: string; kind: "error"; message: string; at: number };

export type StepIcon = "search" | "read" | "subtasks" | "edit" | "deliverable" | "task" | "info";

export type RunStatus = "running" | "needs_input" | "done" | "error" | "cancelled";

export interface PendingInput {
  toolUseId: string;
  question: string;
  // Results for other tools called in the same turn, sent back together
  // with the user's answer so every tool_use gets exactly one tool_result.
  partialResults: unknown[];
}

export interface AgentRun {
  id: string;
  taskId: string;
  agentId: AgentId;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  // Raw Claude API conversation (MessageParam[]). Append-only: it is never
  // edited, so thinking blocks and prompt caching stay valid across turns.
  history: unknown[];
  timeline: TimelineItem[];
  pending?: PendingInput;
  outputTokens?: number;
  unread?: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  completedAt?: number;
  createdAt: number;
  due?: string; // YYYY-MM-DD
  priority: Priority;
  listId: string;
  subtasks: Subtask[];
  deliverables: Deliverable[];
  runIds: string[];
}

export interface List {
  id: string;
  name: string;
  color: string;
}

export type ViewId =
  | "inbox"
  | "today"
  | "upcoming"
  | "agents"
  | "completed"
  | `list:${string}`;

export type AgentId = "copilot" | "planner" | "researcher" | "writer";

// What the agent sees about a task.
export interface TaskSnapshot {
  title: string;
  notes: string;
  due?: string;
  priority: Priority;
  listName: string;
  subtasks: { title: string; done: boolean }[];
  deliverables: { title: string; content: string }[];
}

// ---- Wire protocol between /api/agent and the client (NDJSON) ----

export type AgentAction =
  | { type: "add_subtasks"; subtasks: { id: string; title: string; estimateMinutes?: number }[] }
  | { type: "update_task"; patch: { title?: string; priority?: Priority; due?: string | null; notesAppend?: string } }
  | { type: "save_deliverable"; deliverable: { id: string; title: string; content: string } }
  | { type: "create_task"; task: { id: string; title: string; notes?: string; due?: string; priority?: Priority } };

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "block_end" }
  | { type: "step"; label: string; detail?: string; icon: StepIcon }
  | { type: "sources"; sources: Source[] }
  | { type: "draft"; title: string; content: string; done?: boolean }
  | { type: "action"; action: AgentAction }
  | { type: "append"; messages: unknown[] }
  | { type: "await_input"; pending: PendingInput }
  | { type: "usage"; outputTokens: number }
  | { type: "done" }
  | { type: "error"; message: string };

export type AgentInput =
  | { type: "start"; instruction?: string }
  | { type: "reply"; text: string; pending?: PendingInput };

export interface AgentRequest {
  agentId: AgentId;
  task: TaskSnapshot;
  history: unknown[];
  input: AgentInput;
  today: string;
}
