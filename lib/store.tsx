"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addDays, todayKey } from "./dates";
import type {
  AgentAction,
  AgentEvent,
  AgentId,
  AgentInput,
  AgentRequest,
  AgentRun,
  List,
  Priority,
  Subtask,
  Task,
  TaskSnapshot,
  TimelineItem,
} from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------------------------------------------------------------- state

export interface State {
  tasks: Record<string, Task>;
  order: string[]; // newest first
  lists: List[];
  runs: Record<string, AgentRun>;
}

type Action =
  | { type: "hydrate"; state: State }
  | { type: "task/add"; task: Task }
  | { type: "task/update"; id: string; patch: Partial<Task> }
  | { type: "task/toggle"; id: string }
  | { type: "task/delete"; id: string }
  | { type: "subtask/add"; taskId: string; subtask: Subtask }
  | { type: "subtask/update"; taskId: string; id: string; patch: Partial<Subtask> }
  | { type: "subtask/delete"; taskId: string; id: string }
  | { type: "deliverable/delete"; taskId: string; id: string }
  | { type: "list/add"; list: List }
  | { type: "list/update"; id: string; patch: Partial<List> }
  | { type: "list/delete"; id: string }
  | { type: "run/create"; run: AgentRun }
  | { type: "run/patch"; id: string; patch: Partial<AgentRun> }
  | { type: "run/delete"; id: string }
  | { type: "run/event"; id: string; event: AgentEvent }
  | { type: "run/user"; id: string; text: string }
  | { type: "agent/action"; runId: string; action: AgentAction };

function updateTask(state: State, id: string, fn: (t: Task) => Task): State {
  const t = state.tasks[id];
  if (!t) return state;
  return { ...state, tasks: { ...state.tasks, [id]: fn(t) } };
}

function updateRun(state: State, id: string, fn: (r: AgentRun) => AgentRun): State {
  const r = state.runs[id];
  if (!r) return state;
  return { ...state, runs: { ...state.runs, [id]: fn(r) } };
}

function pushTimeline(r: AgentRun, item: TimelineItem): AgentRun {
  return { ...r, timeline: [...r.timeline, item] };
}

function applyRunEvent(r: AgentRun, e: AgentEvent): AgentRun {
  const now = Date.now();
  const last = r.timeline[r.timeline.length - 1];
  switch (e.type) {
    case "text":
      if (last?.kind === "text")
        return { ...r, timeline: [...r.timeline.slice(0, -1), { ...last, text: last.text + e.delta }] };
      return pushTimeline(r, { id: uid(), kind: "text", text: e.delta, at: now });
    case "thinking":
      if (last?.kind === "thinking" && !last.done)
        return { ...r, timeline: [...r.timeline.slice(0, -1), { ...last, text: last.text + e.delta }] };
      return pushTimeline(r, { id: uid(), kind: "thinking", text: e.delta, at: now });
    case "block_end":
      if (last?.kind === "thinking" && !last.done)
        return { ...r, timeline: [...r.timeline.slice(0, -1), { ...last, done: true }] };
      return r;
    case "draft": {
      if (last?.kind === "draft" && !last.done)
        return {
          ...r,
          timeline: [
            ...r.timeline.slice(0, -1),
            {
              ...last,
              title: e.title || last.title,
              content: e.content || last.content,
              done: e.done,
            },
          ],
        };
      if (e.done) return r;
      return pushTimeline(r, { id: uid(), kind: "draft", title: e.title, content: e.content, at: now });
    }
    case "step":
      return pushTimeline(r, { id: uid(), kind: "step", label: e.label, detail: e.detail, icon: e.icon, at: now });
    case "sources":
      return pushTimeline(r, { id: uid(), kind: "sources", sources: e.sources, at: now });
    case "action":
      return r;
    case "append":
      return { ...r, history: [...r.history, ...e.messages] };
    case "await_input":
      return {
        ...pushTimeline(r, { id: uid(), kind: "question", question: e.pending.question, at: now }),
        status: "needs_input",
        pending: e.pending,
        unread: true,
      };
    case "usage":
      return { ...r, outputTokens: (r.outputTokens ?? 0) + e.outputTokens };
    case "error":
      return { ...pushTimeline(r, { id: uid(), kind: "error", message: e.message, at: now }), status: "error", unread: true };
    case "done":
      if (r.status === "running") return { ...r, status: "done", finishedAt: now, unread: true };
      return { ...r, finishedAt: now };
  }
}

function applyAgentAction(state: State, run: AgentRun, a: AgentAction): State {
  const taskId = run.taskId;
  switch (a.type) {
    case "add_subtasks":
      return updateTask(state, taskId, (t) => ({
        ...t,
        subtasks: [
          ...t.subtasks,
          ...a.subtasks.map((s) => ({ id: s.id, title: s.title, estimateMinutes: s.estimateMinutes, done: false, byAgent: true })),
        ],
      }));
    case "update_task":
      return updateTask(state, taskId, (t) => ({
        ...t,
        title: a.patch.title ?? t.title,
        priority: a.patch.priority ?? t.priority,
        due: a.patch.due === null ? undefined : (a.patch.due ?? t.due),
        notes: a.patch.notesAppend ? [t.notes.trim(), a.patch.notesAppend.trim()].filter(Boolean).join("\n\n") : t.notes,
      }));
    case "save_deliverable":
      return updateTask(state, taskId, (t) => ({
        ...t,
        deliverables: [
          { ...a.deliverable, agentId: run.agentId, createdAt: Date.now() },
          ...t.deliverables,
        ],
      }));
    case "create_task": {
      const parent = state.tasks[taskId];
      const task: Task = {
        id: a.task.id,
        title: a.task.title,
        notes: a.task.notes ?? "",
        due: a.task.due,
        priority: a.task.priority ?? 4,
        listId: parent?.listId ?? "inbox",
        done: false,
        createdAt: Date.now(),
        subtasks: [],
        deliverables: [],
        runIds: [],
      };
      return { ...state, tasks: { ...state.tasks, [task.id]: task }, order: [task.id, ...state.order] };
    }
  }
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "task/add":
      return { ...state, tasks: { ...state.tasks, [a.task.id]: a.task }, order: [a.task.id, ...state.order] };
    case "task/update":
      return updateTask(state, a.id, (t) => ({ ...t, ...a.patch }));
    case "task/toggle":
      return updateTask(state, a.id, (t) => ({ ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() }));
    case "task/delete": {
      const { [a.id]: removed, ...tasks } = state.tasks;
      if (!removed) return state;
      const runs = { ...state.runs };
      removed.runIds.forEach((r) => delete runs[r]);
      return { ...state, tasks, runs, order: state.order.filter((x) => x !== a.id) };
    }
    case "subtask/add":
      return updateTask(state, a.taskId, (t) => ({ ...t, subtasks: [...t.subtasks, a.subtask] }));
    case "subtask/update":
      return updateTask(state, a.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.map((s) => (s.id === a.id ? { ...s, ...a.patch } : s)),
      }));
    case "subtask/delete":
      return updateTask(state, a.taskId, (t) => ({ ...t, subtasks: t.subtasks.filter((s) => s.id !== a.id) }));
    case "deliverable/delete":
      return updateTask(state, a.taskId, (t) => ({ ...t, deliverables: t.deliverables.filter((d) => d.id !== a.id) }));
    case "list/add":
      return { ...state, lists: [...state.lists, a.list] };
    case "list/update":
      return { ...state, lists: state.lists.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
    case "list/delete": {
      const tasks = Object.fromEntries(
        Object.entries(state.tasks).map(([id, t]) => [id, t.listId === a.id ? { ...t, listId: "inbox" } : t]),
      );
      return { ...state, tasks, lists: state.lists.filter((l) => l.id !== a.id) };
    }
    case "run/create": {
      const next = { ...state, runs: { ...state.runs, [a.run.id]: a.run } };
      return updateTask(next, a.run.taskId, (t) => ({ ...t, runIds: [a.run.id, ...t.runIds] }));
    }
    case "run/patch":
      return updateRun(state, a.id, (r) => ({ ...r, ...a.patch }));
    case "run/delete": {
      const run = state.runs[a.id];
      if (!run) return state;
      const { [a.id]: _, ...runs } = state.runs;
      return updateTask({ ...state, runs }, run.taskId, (t) => ({ ...t, runIds: t.runIds.filter((x) => x !== a.id) }));
    }
    case "run/event":
      return updateRun(state, a.id, (r) => applyRunEvent(r, a.event));
    case "run/user":
      return updateRun(state, a.id, (r) => ({
        ...pushTimeline(r, { id: uid(), kind: "user", text: a.text, at: Date.now() }),
        status: "running",
        pending: undefined,
        finishedAt: undefined,
      }));
    case "agent/action": {
      const run = state.runs[a.runId];
      return run ? applyAgentAction(state, run, a.action) : state;
    }
  }
}

// ---------------------------------------------------------------- seed

export const INBOX: List = { id: "inbox", name: "Inbox", color: "#8b8b98" };

function seed(): State {
  const t = todayKey();
  const lists: List[] = [
    { id: "work", name: "Work", color: "#7c5cff" },
    { id: "personal", name: "Personal", color: "#10b981" },
    { id: "home", name: "Home", color: "#f59e0b" },
  ];
  const mk = (p: Partial<Task> & { title: string }): Task => ({
    id: uid(),
    notes: "",
    done: false,
    createdAt: Date.now(),
    priority: 4,
    listId: "inbox",
    subtasks: [],
    deliverables: [],
    runIds: [],
    ...p,
  });
  const tasks = [
    mk({
      title: "Email landlord about the broken dishwasher",
      notes: "It's been leaking since last weekend. Unit 4B. Landlord is Maria.",
      due: t,
      priority: 1,
      listId: "home",
    }),
    mk({
      title: "Plan the Q1 team offsite",
      notes: "12 people, 2 days, budget around $8k. Somewhere within 2 hours of the office.",
      due: addDays(t, 6),
      priority: 2,
      listId: "work",
    }),
    mk({
      title: "Choose noise-cancelling headphones under $300",
      notes: "Mostly for flights and the office. Comfort matters more than bass.",
      listId: "personal",
      priority: 3,
    }),
    mk({
      title: "Prepare quarterly business review deck",
      due: addDays(t, 1),
      priority: 2,
      listId: "work",
      subtasks: [
        { id: uid(), title: "Pull revenue numbers from the dashboard", done: true },
        { id: uid(), title: "Draft the highlights slide", done: false },
        { id: uid(), title: "Get feedback from Priya", done: false },
      ],
    }),
    mk({ title: "Renew passport", due: addDays(t, 14), listId: "personal", priority: 3 }),
    mk({ title: "Book a dentist appointment", listId: "personal", done: true, completedAt: Date.now() - 3600_000 }),
    mk({ title: "Pick up dry cleaning", due: t, listId: "home" }),
  ];
  return {
    lists,
    tasks: Object.fromEntries(tasks.map((x) => [x.id, x])),
    order: tasks.map((x) => x.id),
    runs: {},
  };
}

const STORAGE_KEY = "tempo:v1";

function load(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    // Runs that were streaming when the page closed can't resume.
    for (const r of Object.values(s.runs)) {
      if (r.status === "running") {
        r.status = "cancelled";
        r.timeline.push({ id: uid(), kind: "error", message: "Interrupted when the page was closed.", at: Date.now() });
      }
    }
    return s;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- context

interface Store {
  state: State;
  ready: boolean;
  dispatch: React.Dispatch<Action>;
  listById: (id: string) => List;
  addTask: (p: { title: string; due?: string; priority?: Priority; listId?: string; notes?: string }) => Task;
  startAgent: (taskId: string, agentId: AgentId, instruction?: string) => string | null;
  replyToRun: (runId: string, text: string) => void;
  cancelRun: (runId: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tasks: {}, order: [], lists: [], runs: {} });
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    dispatch({ type: "hydrate", state: load() ?? seed() });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const h = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage full or blocked */
      }
    }, 250);
    return () => clearTimeout(h);
  }, [state, ready]);

  const listById = useCallback(
    (id: string) => state.lists.find((l) => l.id === id) ?? INBOX,
    [state.lists],
  );

  const addTask: Store["addTask"] = useCallback((p) => {
    const task: Task = {
      id: uid(),
      title: p.title,
      notes: p.notes ?? "",
      due: p.due,
      priority: p.priority ?? 4,
      listId: p.listId ?? "inbox",
      done: false,
      createdAt: Date.now(),
      subtasks: [],
      deliverables: [],
      runIds: [],
    };
    dispatch({ type: "task/add", task });
    return task;
  }, []);

  const snapshot = (task: Task): TaskSnapshot => {
    const list = stateRef.current.lists.find((l) => l.id === task.listId) ?? INBOX;
    return {
      title: task.title,
      notes: task.notes,
      due: task.due,
      priority: task.priority,
      listName: list.name,
      subtasks: task.subtasks.map((s) => ({ title: s.title, done: s.done })),
      deliverables: task.deliverables.slice(0, 3).map((d) => ({ title: d.title, content: d.content })),
    };
  };

  const stream = useCallback(async (runId: string, input: AgentInput) => {
    const run = stateRef.current.runs[runId];
    const task = run && stateRef.current.tasks[run.taskId];
    if (!run || !task) return;
    const ctrl = new AbortController();
    controllers.current.set(runId, ctrl);
    const body: AgentRequest = {
      agentId: run.agentId,
      task: snapshot(task),
      history: run.history,
      input,
      today: new Date().toLocaleDateString("en-CA") + ` (${new Date().toLocaleDateString(undefined, { weekday: "long" })})`,
    };
    let finished = false;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Agent request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as AgentEvent;
          if (event.type === "action") dispatch({ type: "agent/action", runId, action: event.action });
          else dispatch({ type: "run/event", id: runId, event });
          if (event.type === "done") finished = true;
        }
      }
      if (!finished) dispatch({ type: "run/event", id: runId, event: { type: "done" } });
    } catch (err) {
      if (ctrl.signal.aborted) {
        dispatch({ type: "run/patch", id: runId, patch: { status: "cancelled", finishedAt: Date.now() } });
      } else {
        dispatch({
          type: "run/event",
          id: runId,
          event: { type: "error", message: err instanceof Error ? err.message : "Connection lost" },
        });
      }
    } finally {
      controllers.current.delete(runId);
    }
  }, []);

  const startAgent: Store["startAgent"] = useCallback(
    (taskId, agentId, instruction) => {
      if (!stateRef.current.tasks[taskId]) return null;
      const run: AgentRun = {
        id: uid(),
        taskId,
        agentId,
        status: "running",
        startedAt: Date.now(),
        history: [],
        timeline: instruction ? [{ id: uid(), kind: "user", text: instruction, at: Date.now() }] : [],
      };
      dispatch({ type: "run/create", run });
      // Let the reducer commit before streaming reads the run back.
      queueMicrotask(() => {
        stateRef.current = reducer(stateRef.current, { type: "run/create", run });
        void stream(run.id, { type: "start", instruction });
      });
      return run.id;
    },
    [stream],
  );

  const replyToRun: Store["replyToRun"] = useCallback(
    (runId, text) => {
      const run = stateRef.current.runs[runId];
      if (!run || run.status === "running") return;
      const pending = run.pending;
      dispatch({ type: "run/user", id: runId, text });
      void stream(runId, { type: "reply", text, pending });
    },
    [stream],
  );

  const cancelRun = useCallback((runId: string) => {
    controllers.current.get(runId)?.abort();
  }, []);

  const value = useMemo(
    () => ({ state, ready, dispatch, listById, addTask, startAgent, replyToRun, cancelRun }),
    [state, ready, listById, addTask, startAgent, replyToRun, cancelRun],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
