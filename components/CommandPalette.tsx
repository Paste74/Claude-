"use client";

import { CalendarDays, CheckCircle2, CornerDownLeft, Inbox, Moon, Plus, Search, Sparkles, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AGENT_LIST } from "@/lib/agents";
import { useStore } from "@/lib/store";
import type { AgentId, ViewId } from "@/lib/types";
import { AgentAvatar, cx, Kbd } from "./ui";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  section: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  setView,
  openTask,
  selectedTaskId,
  newTask,
  toggleTheme,
  delegate,
}: {
  open: boolean;
  onClose: () => void;
  setView: (v: ViewId) => void;
  openTask: (id: string) => void;
  selectedTaskId: string | null;
  newTask: () => void;
  toggleTheme: () => void;
  delegate: (taskId: string, agent: AgentId) => void;
}) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => input.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];
    const selected = selectedTaskId ? state.tasks[selectedTaskId] : null;
    if (selected) {
      for (const a of AGENT_LIST)
        cmds.push({
          id: `delegate-${a.id}`,
          label: `Hand “${selected.title}” to ${a.name}`,
          hint: a.tagline,
          icon: <AgentAvatar agentId={a.id} size={18} />,
          section: "Agents",
          run: () => delegate(selected.id, a.id),
        });
    }
    cmds.push(
      { id: "new", label: "New task", icon: <Plus className="h-4 w-4" />, section: "Actions", hint: "N", run: newTask },
      { id: "theme", label: "Toggle dark mode", icon: <Moon className="h-4 w-4" />, section: "Actions", run: toggleTheme },
      { id: "v-inbox", label: "Go to All tasks", icon: <Inbox className="h-4 w-4" />, section: "Navigate", hint: "G A", run: () => setView("inbox") },
      { id: "v-today", label: "Go to Today", icon: <Sun className="h-4 w-4" />, section: "Navigate", hint: "G T", run: () => setView("today") },
      { id: "v-up", label: "Go to Upcoming", icon: <CalendarDays className="h-4 w-4" />, section: "Navigate", hint: "G U", run: () => setView("upcoming") },
      { id: "v-agents", label: "Go to Agents", icon: <Sparkles className="h-4 w-4" />, section: "Navigate", hint: "G G", run: () => setView("agents") },
      { id: "v-done", label: "Go to Completed", icon: <CheckCircle2 className="h-4 w-4" />, section: "Navigate", run: () => setView("completed") },
      ...state.lists.map((l) => ({
        id: `l-${l.id}`,
        label: `Go to ${l.name}`,
        icon: <span className="m-[3px] h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color }} />,
        section: "Navigate",
        run: () => setView(`list:${l.id}`),
      })),
    );
    const tasks = state.order
      .map((id) => state.tasks[id])
      .filter(Boolean)
      .map<Command>((t) => ({
        id: `t-${t.id}`,
        label: t.title,
        icon: (
          <span className={cx("m-[1px] h-3.5 w-3.5 rounded-full border-[1.5px]", t.done ? "border-accent bg-accent" : "border-fg-3")} />
        ),
        section: "Tasks",
        run: () => openTask(t.id),
      }));
    return [...cmds, ...tasks];
  }, [state, selectedTaskId, delegate, newTask, toggleTheme, setView, openTask]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands.filter((c) => c.section !== "Tasks").concat(commands.filter((c) => c.section === "Tasks").slice(0, 6));
    return commands
      .map((c) => ({ c, score: score(c.label.toLowerCase(), s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.c);
  }, [commands, q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;

  const exec = (c?: Command) => {
    if (!c) return;
    onClose();
    c.run();
  };

  let lastSection = "";
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/25 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className="pop-in w-full max-w-[580px] overflow-hidden rounded-2xl bg-elevated shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-fg-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                exec(filtered[idx]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Search tasks, run an agent, or jump to…"
            className="h-12 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-fg-3"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-fg-3">No results</div>}
          {filtered.map((c, i) => {
            const header = c.section !== lastSection ? c.section : null;
            lastSection = c.section;
            return (
              <div key={c.id}>
                {header && <div className="px-2.5 pt-2.5 pb-1 text-[11.5px] font-medium text-fg-3">{header}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => exec(c)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px]",
                    i === idx ? "bg-active" : "",
                  )}
                >
                  <span className="flex w-5 justify-center text-fg-2">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="shrink-0 text-[12px] text-fg-3">{c.hint}</span>}
                  {i === idx && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-fg-3" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Simple fuzzy score: substring beats subsequence; earlier match beats later.
function score(text: string, q: string): number {
  const i = text.indexOf(q);
  if (i >= 0) return 100 - i;
  let ti = 0;
  for (const ch of q) {
    ti = text.indexOf(ch, ti);
    if (ti < 0) return 0;
    ti++;
  }
  return 10;
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const rows: [string, string[]][] = [
    ["Command palette", ["⌘", "K"]],
    ["New task", ["N"]],
    ["Move selection", ["J", "K"]],
    ["Open task", ["Enter"]],
    ["Complete task", ["X"]],
    ["Hand to Copilot", ["A"]],
    ["Close panel", ["Esc"]],
    ["Go to Today / Upcoming / Agents", ["G", "T / U / G"]],
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 px-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="pop-in w-full max-w-[400px] rounded-2xl bg-elevated p-5 shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-[15px] font-semibold">Keyboard shortcuts</h2>
        <div className="flex flex-col gap-2.5">
          {rows.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <span className="text-fg-2">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k} className="h-5 min-w-5 px-1.5 text-[11px]">
                    {k}
                  </Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
