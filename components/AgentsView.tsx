"use client";

import { Menu } from "lucide-react";
import { AGENT_LIST, AGENTS } from "@/lib/agents";
import { relativeTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { AgentRun } from "@/lib/types";
import { RunBadge } from "./TaskRow";
import { AgentAvatar, cx, IconButton } from "./ui";

export function AgentsView({ onOpenRun, onMenu }: { onOpenRun: (taskId: string) => void; onMenu: () => void }) {
  const { state } = useStore();
  const runs = Object.values(state.runs).sort((a, b) => b.startedAt - a.startedAt);
  const needs = runs.filter((r) => r.status === "needs_input");
  const running = runs.filter((r) => r.status === "running");
  const review = runs.filter((r) => r.unread && (r.status === "done" || r.status === "error"));
  const rest = runs.filter((r) => !needs.includes(r) && !running.includes(r) && !review.includes(r));

  const deliverables = Object.values(state.tasks).reduce((n, t) => n + t.deliverables.length, 0);
  const subtasks = Object.values(state.tasks).reduce((n, t) => n + t.subtasks.filter((s) => s.byAgent).length, 0);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center px-4 md:hidden">
        <IconButton label="Open menu" onClick={onMenu}>
          <Menu className="h-4 w-4" />
        </IconButton>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 pt-4 pb-24 md:px-8 md:pt-16">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Agents</h1>
          <p className="mt-0.5 text-[13px] text-fg-3">Everything your agents are working on, and what they need from you.</p>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            <Stat label="Working now" value={running.length} live={running.length > 0} />
            <Stat label="Drafts produced" value={deliverables} />
            <Stat label="Steps planned" value={subtasks} />
          </div>

          {runs.length === 0 ? (
            <div className="mt-8">
              <p className="mb-3 text-[13px] text-fg-2">
                Open any task and hand it to an agent. They work in the background while you keep going.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {AGENT_LIST.map((a) => (
                  <div key={a.id} className="flex gap-3 rounded-xl bg-surface p-3.5 shadow-card">
                    <AgentAvatar agentId={a.id} size={32} />
                    <div>
                      <div className="text-[13.5px] font-semibold">{a.name}</div>
                      <div className="mt-0.5 text-[12.5px] leading-snug text-fg-2">{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <RunGroup title="Needs your input" runs={needs} onOpen={onOpenRun} />
              <RunGroup title="Working" runs={running} onOpen={onOpenRun} />
              <RunGroup title="Ready to review" runs={review} onOpen={onOpenRun} />
              <RunGroup title="History" runs={rest} onOpen={onOpenRun} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3 shadow-card">
      <div className="flex items-center gap-1.5 text-[12px] text-fg-3">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

function RunGroup({ title, runs, onOpen }: { title: string; runs: AgentRun[]; onOpen: (taskId: string) => void }) {
  const { state } = useStore();
  if (!runs.length) return null;
  return (
    <div className="mt-7">
      <div className="mb-1 flex items-center gap-2 border-b border-line px-3 pb-1.5 text-[12.5px] font-semibold text-fg-2">
        {title} <span className="font-normal text-fg-3">{runs.length}</span>
      </div>
      {runs.map((r) => {
        const task = state.tasks[r.taskId];
        if (!task) return null;
        const lastText = [...r.timeline].reverse().find((i) => i.kind === "text" || i.kind === "question" || i.kind === "error");
        const preview =
          lastText?.kind === "text"
            ? lastText.text
            : lastText?.kind === "question"
              ? lastText.question
              : lastText?.kind === "error"
                ? lastText.message
                : "";
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r.taskId)}
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-hover"
          >
            <AgentAvatar agentId={r.agentId} size={24} active={r.status === "running"} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px]">{task.title}</span>
              </div>
              <div className={cx("mt-0.5 truncate text-[12px] text-fg-3")}>
                {AGENTS[r.agentId].name} · {relativeTime(r.startedAt)}
                {preview && ` · ${preview.replace(/[#*_`>|]/g, "").slice(0, 120)}`}
              </div>
            </div>
            <RunBadge run={r} />
          </button>
        );
      })}
    </div>
  );
}
