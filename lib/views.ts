import { diffDays, formatDayHeading, todayKey } from "./dates";
import type { State } from "./store";
import type { AgentRun, Task, ViewId } from "./types";

export interface Group {
  id: string;
  title: string;
  tone?: "danger";
  tasks: Task[];
}

const byPriorityThenDue = (a: Task, b: Task) =>
  a.priority - b.priority || (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.createdAt - a.createdAt;

export function latestRun(state: State, task: Task): AgentRun | undefined {
  return task.runIds.length ? state.runs[task.runIds[0]] : undefined;
}

export function groupsForView(state: State, view: ViewId, query = ""): Group[] {
  const q = query.trim().toLowerCase();
  const all = state.order
    .map((id) => state.tasks[id])
    .filter(Boolean)
    .filter((t) => !q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q));
  const open = all.filter((t) => !t.done);
  const today = todayKey();

  if (view === "completed") {
    const done = all.filter((t) => t.done).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    return [{ id: "done", title: "", tasks: done }];
  }

  if (view === "today") {
    const overdue = open.filter((t) => t.due && t.due < today).sort(byPriorityThenDue);
    const due = open.filter((t) => t.due === today).sort(byPriorityThenDue);
    const doneToday = all.filter(
      (t) => t.done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString(),
    );
    return [
      { id: "overdue", title: "Overdue", tone: "danger" as const, tasks: overdue },
      { id: "today", title: overdue.length ? "Today" : "", tasks: due },
      { id: "done", title: "Completed today", tasks: doneToday },
    ].filter((g) => g.tasks.length);
  }

  if (view === "upcoming") {
    const map = new Map<string, Task[]>();
    const overdue = open.filter((t) => t.due && t.due < today).sort(byPriorityThenDue);
    for (const t of open.filter((t) => t.due && t.due >= today).sort((a, b) => a.due!.localeCompare(b.due!))) {
      if (!map.has(t.due!)) map.set(t.due!, []);
      map.get(t.due!)!.push(t);
    }
    const groups: Group[] = [];
    if (overdue.length) groups.push({ id: "overdue", title: "Overdue", tone: "danger", tasks: overdue });
    for (const [key, tasks] of map) {
      groups.push({ id: key, title: formatDayHeading(key), tasks: tasks.sort(byPriorityThenDue) });
    }
    const someday = open.filter((t) => !t.due).sort(byPriorityThenDue);
    if (someday.length) groups.push({ id: "someday", title: "No date", tasks: someday });
    return groups;
  }

  if (view.startsWith("list:")) {
    const listId = view.slice(5);
    const tasks = open.filter((t) => t.listId === listId);
    return [{ id: "open", title: "", tasks: tasks.sort(byPriorityThenDue) }];
  }

  // All tasks: everything open, most urgent first
  return [{ id: "open", title: "", tasks: [...open].sort(byPriorityThenDue) }];
}

export function counts(state: State) {
  const today = todayKey();
  const open = Object.values(state.tasks).filter((t) => !t.done);
  const runs = Object.values(state.runs);
  const byList: Record<string, number> = {};
  for (const t of open) byList[t.listId] = (byList[t.listId] ?? 0) + 1;
  return {
    inbox: open.length,
    today: open.filter((t) => t.due && t.due <= today).length,
    overdue: open.filter((t) => t.due && diffDays(t.due) < 0).length,
    upcoming: open.filter((t) => t.due && t.due >= today).length,
    running: runs.filter((r) => r.status === "running").length,
    attention: runs.filter((r) => r.status === "needs_input" || (r.unread && r.status !== "running")).length,
    byList,
  };
}

export function viewTitle(state: State, view: ViewId): string {
  if (view.startsWith("list:")) return state.lists.find((l) => l.id === view.slice(5))?.name ?? "List";
  return { inbox: "All tasks", today: "Today", upcoming: "Upcoming", agents: "Agents", completed: "Completed" }[
    view as "inbox"
  ];
}
