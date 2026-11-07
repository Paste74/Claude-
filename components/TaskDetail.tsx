"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Hash,
  Maximize2,
  Minimize2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AGENT_LIST, AGENTS } from "@/lib/agents";
import { addDays, formatDue, relativeTime, todayKey } from "@/lib/dates";
import { INBOX, uid, useStore } from "@/lib/store";
import type { AgentId, AgentRun, Deliverable, Priority, Task } from "@/lib/types";
import { AgentRunView } from "./AgentRunView";
import {
  AgentAvatar,
  Button,
  Checkbox,
  cx,
  IconButton,
  Markdown,
  MenuItem,
  Popover,
  PriorityFlag,
  PRIORITY_LABEL,
  useCopy,
} from "./ui";

type Tab = "details" | "agent";

export function TaskDetail({
  taskId,
  onClose,
  tab,
  setTab,
}: {
  taskId: string;
  onClose: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const { state, dispatch, cancelRun } = useStore();
  const task = state.tasks[taskId];
  const runs = task ? task.runIds.map((id) => state.runs[id]).filter(Boolean) : [];
  const [runId, setRunId] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const activeRun = runs.find((r) => r.id === runId) ?? runs[0];

  useEffect(() => setRunId(null), [taskId, runs.length]);

  if (!task) return null;
  const live = runs.find((r) => r.status === "running" || r.status === "needs_input");

  return (
    <aside
      className={cx(
        "slide-in flex h-full w-full shrink-0 flex-col border-l border-line bg-surface transition-[width] duration-200 md:w-[460px]",
        wide && "lg:w-[720px]",
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3">
        <div className="flex rounded-lg bg-hover p-0.5">
          <TabButton active={tab === "details"} onClick={() => setTab("details")}>
            Details
          </TabButton>
          <TabButton active={tab === "agent"} onClick={() => setTab("agent")} disabled={!runs.length}>
            <Sparkles className="h-3.5 w-3.5" /> Agent
            {live && <span className={cx("h-1.5 w-1.5 rounded-full", live.status === "running" ? "animate-pulse bg-accent" : "bg-warn")} />}
          </TabButton>
        </div>
        <div className="ml-auto flex items-center">
          <IconButton label={wide ? "Narrow panel" : "Widen panel"} className="hidden lg:inline-flex" onClick={() => setWide((w) => !w)}>
            {wide ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton
            label="Delete task"
            onClick={() => {
              runs.forEach((r) => r.status === "running" && cancelRun(r.id));
              dispatch({ type: "task/delete", id: task.id });
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Close (Esc)" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {tab === "agent" && activeRun ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {runs.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRunId(r.id)}
                  className={cx(
                    "flex h-7 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-1 text-[12px] transition-colors",
                    r.id === activeRun.id ? "bg-active font-medium text-fg" : "text-fg-3 hover:bg-hover",
                  )}
                >
                  <AgentAvatar agentId={r.agentId} size={20} className="rounded-full" active={r.status === "running"} />
                  {AGENTS[r.agentId].name}
                  <span className="text-fg-3">{relativeTime(r.startedAt)}</span>
                </button>
              ))}
            </div>
          )}
          <AgentRunView key={activeRun.id} run={activeRun} />
        </div>
      ) : (
        <Details task={task} runs={runs} openAgent={() => setTab("agent")} />
      )}
    </aside>
  );
}

function TabButton({
  active,
  children,
  ...props
}: { active: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors disabled:opacity-40",
        active ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg-2",
      )}
    >
      {children}
    </button>
  );
}

function Details({ task, runs, openAgent }: { task: Task; runs: AgentRun[]; openAgent: () => void }) {
  const { dispatch, listById } = useStore();
  const list = listById(task.listId);
  const live = runs.find((r) => r.status === "running" || r.status === "needs_input");
  const latest = runs[0];
  const patch = (p: Partial<Task>) => dispatch({ type: "task/update", id: task.id, patch: p });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 pt-5 pb-10">
        <div className="flex items-start gap-3">
          <div className="pt-[5px]">
            <Checkbox
              checked={task.done}
              priority={task.priority}
              size={20}
              onChange={() => dispatch({ type: "task/toggle", id: task.id })}
            />
          </div>
          <AutoTextarea
            key={task.id}
            value={task.title}
            onChange={(v) => patch({ title: v.replace(/\n/g, " ") })}
            className={cx("text-[19px] leading-7 font-semibold tracking-[-0.015em]", task.done && "text-fg-3 line-through")}
            placeholder="Task name"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 pl-8">
          <DuePicker due={task.due} onChange={(due) => patch({ due })} />
          <PriorityPicker priority={task.priority} onChange={(priority) => patch({ priority })} />
          <ListPicker listId={list.id} onChange={(listId) => patch({ listId })} />
        </div>

        {(live || (latest?.unread && latest.status !== "running")) && (
          <button
            onClick={openAgent}
            className="mt-5 flex w-full items-center gap-3 rounded-xl bg-accent-soft px-3.5 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]"
          >
            <AgentAvatar agentId={(live ?? latest).agentId} size={26} active={live?.status === "running"} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">
                {live?.status === "running"
                  ? `${AGENTS[live.agentId].name} is working on this`
                  : live?.status === "needs_input"
                    ? `${AGENTS[live.agentId].name} has a question`
                    : `${AGENTS[latest.agentId].name} finished`}
              </span>
              <span className="block truncate text-[12px] text-fg-2">{runSummary(live ?? latest)}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-accent-text" />
          </button>
        )}

        <Section title="Notes">
          <AutoTextarea
            key={task.id + "-notes"}
            value={task.notes}
            onChange={(v) => patch({ notes: v })}
            placeholder="Add details or context. Agents read this."
            className="min-h-[60px] rounded-lg px-0 text-[13.5px] leading-relaxed text-fg-2"
          />
        </Section>

        <Subtasks task={task} />

        {task.deliverables.length > 0 && (
          <Section title="Drafts & deliverables" count={task.deliverables.length}>
            <div className="flex flex-col gap-2.5">
              {task.deliverables.map((d) => (
                <DeliverableCard key={d.id} d={d} onDelete={() => dispatch({ type: "deliverable/delete", taskId: task.id, id: d.id })} />
              ))}
            </div>
          </Section>
        )}

        {!live && <Delegate task={task} hasRuns={runs.length > 0} openAgent={openAgent} />}
      </div>
    </div>
  );
}

function runSummary(run: AgentRun): string {
  const t = run.timeline;
  if (run.status === "needs_input") {
    const q = [...t].reverse().find((i) => i.kind === "question");
    return q && q.kind === "question" ? q.question : "Waiting for your reply";
  }
  for (let i = t.length - 1; i >= 0; i--) {
    const it = t[i];
    if (it.kind === "step") return it.label + (it.detail ? ` · ${it.detail}` : "");
    if (it.kind === "text" && run.status !== "running") return it.text.replace(/[#*_`>]/g, "").slice(0, 140);
    if (it.kind === "draft") return `Writing ${it.title || "a draft"}…`;
    if (it.kind === "thinking") return "Thinking…";
  }
  return "Getting started…";
}

function Section({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-fg-3 uppercase">{title}</h3>
        {count !== undefined && <span className="text-[12px] text-fg-3">{count}</span>}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function Subtasks({ task }: { task: Task }) {
  const { dispatch } = useStore();
  const [text, setText] = useState("");
  const done = task.subtasks.filter((s) => s.done).length;
  const minutes = task.subtasks.filter((s) => !s.done).reduce((n, s) => n + (s.estimateMinutes ?? 0), 0);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    dispatch({ type: "subtask/add", taskId: task.id, subtask: { id: uid(), title: t, done: false } });
    setText("");
  };

  return (
    <Section
      title="Subtasks"
      action={
        task.subtasks.length > 0 ? (
          <span className="text-[12px] text-fg-3">
            {done}/{task.subtasks.length} done{minutes ? ` · ~${minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)}h` : `${minutes}m`} left` : ""}
          </span>
        ) : undefined
      }
    >
      {task.subtasks.length > 0 && (
        <div className="mb-1 h-1 overflow-hidden rounded-full bg-hover">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(done / task.subtasks.length) * 100}%` }} />
        </div>
      )}
      <div className="flex flex-col">
        {task.subtasks.map((s) => (
          <div key={s.id} className="group pop-in flex items-center gap-2.5 rounded-lg py-1.5 pr-1 hover:bg-hover">
            <span className="pl-1">
              <Checkbox
                size={16}
                checked={s.done}
                onChange={() => dispatch({ type: "subtask/update", taskId: task.id, id: s.id, patch: { done: !s.done } })}
              />
            </span>
            <input
              value={s.title}
              onChange={(e) => dispatch({ type: "subtask/update", taskId: task.id, id: s.id, patch: { title: e.target.value } })}
              className={cx("min-w-0 flex-1 bg-transparent text-[13.5px] outline-none", s.done && "text-fg-3 line-through")}
            />
            {s.estimateMinutes && !s.done && <span className="text-[11.5px] text-fg-3 tabular-nums">{s.estimateMinutes}m</span>}
            {s.byAgent && (
              <span title="Added by an agent">
                <Sparkles className="h-3 w-3 text-accent-text opacity-70" />
              </span>
            )}
            <IconButton
              label="Delete subtask"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => dispatch({ type: "subtask/delete", taskId: task.id, id: s.id })}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ))}
        <div className="flex items-center gap-2.5 py-1.5 pl-1">
          <Plus className="h-4 w-4 text-fg-3" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            onBlur={add}
            placeholder="Add subtask"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-3"
          />
        </div>
      </div>
    </Section>
  );
}

function DeliverableCard({ d, onDelete }: { d: Deliverable; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, copy] = useCopy();
  return (
    <div className="overflow-hidden rounded-xl bg-bg shadow-card">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <AgentAvatar agentId={d.agentId as AgentId} size={22} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{d.title}</div>
          <div className="text-[11.5px] text-fg-3">
            {AGENTS[d.agentId as AgentId]?.name ?? "Agent"} · {relativeTime(d.createdAt)}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => copy(d.content)}>
          {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <IconButton label="Delete" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      <div className={cx("relative border-t border-line px-3.5 py-3", !open && "max-h-44 overflow-hidden")}>
        <Markdown className="text-[13px]">{d.content}</Markdown>
        {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-bg to-transparent" />}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1 border-t border-line py-1.5 text-[12px] font-medium text-fg-3 hover:bg-hover hover:text-fg-2"
      >
        {open ? "Show less" : "Show all"}
        <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}

function Delegate({ task, hasRuns, openAgent }: { task: Task; hasRuns: boolean; openAgent: () => void }) {
  const { startAgent } = useStore();
  const [picked, setPicked] = useState<AgentId>("copilot");
  const [instruction, setInstruction] = useState("");
  const agent = AGENTS[picked];

  const go = (text?: string) => {
    startAgent(task.id, picked, (text ?? instruction).trim() || undefined);
    setInstruction("");
    openAgent();
  };

  return (
    <Section title={hasRuns ? "Hand off again" : "Hand off to an agent"}>
      <div className="rounded-xl bg-bg p-1.5 shadow-card">
        <div className="grid grid-cols-4 gap-1">
          {AGENT_LIST.map((a) => (
            <button
              key={a.id}
              onClick={() => setPicked(a.id)}
              className={cx(
                "flex flex-col items-center gap-1.5 rounded-lg px-1 pt-2.5 pb-2 text-[12px] font-medium transition-colors",
                picked === a.id ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:bg-hover hover:text-fg-2",
              )}
            >
              <AgentAvatar agentId={a.id} size={26} />
              {a.name}
            </button>
          ))}
        </div>
        <p className="px-2 pt-2.5 pb-1 text-[12.5px] leading-snug text-fg-2">{agent.description}</p>
        <div className="mt-1.5 flex items-end gap-2 rounded-lg bg-surface p-1.5 pl-2.5 shadow-card">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go();
              }
            }}
            rows={1}
            placeholder={`Anything ${agent.name} should know? (optional)`}
            className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-1 text-[13px] outline-none placeholder:text-fg-3 [field-sizing:content]"
          />
          <Button variant="primary" size="sm" onClick={() => go()}>
            Start <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 px-1 pt-2 pb-0.5">
          {agent.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => go(s)}
              className="h-6 rounded-full border border-line-strong px-2.5 text-[12px] text-fg-2 transition-colors hover:bg-hover hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- pickers

function Pill({ children, onClick, muted }: { children: React.ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex h-7 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[12.5px] transition-colors hover:bg-hover",
        muted ? "text-fg-3" : "text-fg",
      )}
    >
      {children}
    </button>
  );
}

function DuePicker({ due, onChange }: { due?: string; onChange: (d?: string) => void }) {
  const [open, setOpen] = useState(false);
  const t = todayKey();
  const opts: [string, string | undefined][] = [
    ["Today", t],
    ["Tomorrow", addDays(t, 1)],
    ["In 3 days", addDays(t, 3)],
    ["Next week", addDays(t, 7)],
    ["No date", undefined],
  ];
  return (
    <div className="relative">
      <Pill onClick={() => setOpen((o) => !o)} muted={!due}>
        <CalendarDays className="h-3.5 w-3.5" />
        {due ? formatDue(due) : "Due date"}
      </Pill>
      <Popover open={open} onClose={() => setOpen(false)} className="w-52">
        {opts.map(([label, v]) => (
          <MenuItem
            key={label}
            active={due === v}
            onClick={() => {
              onChange(v);
              setOpen(false);
            }}
          >
            <span className="flex-1">{label}</span>
            {v && <span className="text-[11.5px] text-fg-3">{formatDue(v) === label ? "" : formatDue(v)}</span>}
          </MenuItem>
        ))}
        <div className="mt-1 border-t border-line px-1.5 pt-1.5 pb-0.5">
          <input
            type="date"
            value={due ?? ""}
            onChange={(e) => {
              onChange(e.target.value || undefined);
              setOpen(false);
            }}
            className="h-8 w-full rounded-md bg-hover px-2 text-[12.5px] outline-none"
          />
        </div>
      </Popover>
    </div>
  );
}

function PriorityPicker({ priority, onChange }: { priority: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Pill onClick={() => setOpen((o) => !o)} muted={priority === 4}>
        <PriorityFlag priority={priority} />
        {priority === 4 ? "Priority" : PRIORITY_LABEL[priority]}
      </Pill>
      <Popover open={open} onClose={() => setOpen(false)} className="w-44">
        {([1, 2, 3, 4] as Priority[]).map((p) => (
          <MenuItem
            key={p}
            active={priority === p}
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
          >
            <PriorityFlag priority={p} />
            <span className="flex-1">{PRIORITY_LABEL[p]}</span>
            <span className="text-[11.5px] text-fg-3">P{p}</span>
          </MenuItem>
        ))}
      </Popover>
    </div>
  );
}

function ListPicker({ listId, onChange }: { listId: string; onChange: (id: string) => void }) {
  const { state, listById } = useStore();
  const [open, setOpen] = useState(false);
  const list = listById(listId);
  return (
    <div className="relative">
      <Pill onClick={() => setOpen((o) => !o)} muted={list.id === "inbox"}>
        {list.id === "inbox" ? <Hash className="h-3.5 w-3.5" /> : <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: list.color }} />}
        {list.id === "inbox" ? "List" : list.name}
      </Pill>
      <Popover open={open} onClose={() => setOpen(false)} className="w-48">
        {[INBOX, ...state.lists].map((l) => (
          <MenuItem
            key={l.id}
            active={l.id === listId}
            onClick={() => {
              onChange(l.id);
              setOpen(false);
            }}
          >
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color }} />
            {l.id === "inbox" ? "No list" : l.name}
          </MenuItem>
        ))}
      </Popover>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx("w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-fg-3", className)}
    />
  );
}
