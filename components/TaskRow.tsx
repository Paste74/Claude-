"use client";

import { CalendarDays, FileText, ListChecks, MessageCircleQuestion } from "lucide-react";
import { memo } from "react";
import { AGENTS } from "@/lib/agents";
import { dueTone, formatDue } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { AgentRun, List, Task } from "@/lib/types";
import { AgentAvatar, Checkbox, cx, PriorityFlag } from "./ui";

export const TaskRow = memo(function TaskRow({
  task,
  list,
  run,
  selected,
  focused,
  showList,
  onSelect,
}: {
  task: Task;
  list: List;
  run?: AgentRun;
  selected: boolean;
  focused: boolean;
  showList: boolean;
  onSelect: (id: string) => void;
}) {
  const { dispatch } = useStore();
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const tone = task.due ? dueTone(task.due) : null;

  return (
    <div
      role="button"
      tabIndex={-1}
      data-task-id={task.id}
      onClick={() => onSelect(task.id)}
      className={cx(
        "group relative flex cursor-default items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-75",
        selected ? "bg-accent-soft" : focused ? "bg-hover" : "hover:bg-hover",
      )}
    >
      <div className="pt-[1px]">
        <Checkbox checked={task.done} priority={task.priority} onChange={() => dispatch({ type: "task/toggle", id: task.id })} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "truncate text-[14px] leading-5 transition-colors",
              task.done ? "text-fg-3 line-through decoration-fg-3/50" : "text-fg",
            )}
          >
            {task.title}
          </span>
        </div>
        {(task.due || task.subtasks.length > 0 || task.deliverables.length > 0 || showList || task.notes) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-3">
            {task.due && (
              <span
                className={cx(
                  "flex items-center gap-1",
                  !task.done && tone === "overdue" && "text-danger",
                  !task.done && tone === "today" && "text-accent-text font-medium",
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {formatDue(task.due)}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className={cx("flex items-center gap-1", doneSubs === task.subtasks.length && "text-ok")}>
                <ListChecks className="h-3 w-3" />
                {doneSubs}/{task.subtasks.length}
              </span>
            )}
            {task.deliverables.length > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {task.deliverables.length} {task.deliverables.length === 1 ? "draft" : "drafts"}
              </span>
            )}
            {task.notes && !task.due && !task.subtasks.length && !task.deliverables.length && (
              <span className="truncate max-w-[280px]">{task.notes.split("\n")[0]}</span>
            )}
            {showList && list.id !== "inbox" && (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2.5px]" style={{ background: list.color }} />
                {list.name}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-[1px]">
        {run && <RunBadge run={run} />}
        {task.priority < 4 && !task.done && <PriorityFlag priority={task.priority} />}
      </div>
    </div>
  );
});

export function RunBadge({ run, compact }: { run: AgentRun; compact?: boolean }) {
  const name = AGENTS[run.agentId].name;
  if (run.status === "running")
    return (
      <span className="flex h-[22px] items-center gap-1.5 rounded-full bg-accent-soft pr-2 pl-0.5 text-[11.5px] font-medium text-accent-text">
        <AgentAvatar agentId={run.agentId} size={18} active className="rounded-full" />
        {!compact && <span className="shimmer-text">{name} working</span>}
      </span>
    );
  if (run.status === "needs_input")
    return (
      <span className="flex h-[22px] items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-2 text-[11.5px] font-medium text-warn">
        <MessageCircleQuestion className="h-3 w-3" />
        {!compact && "Needs you"}
      </span>
    );
  if (run.unread && run.status === "done")
    return (
      <span className="flex h-[22px] items-center gap-1.5 rounded-full bg-hover pr-2 pl-0.5 text-[11.5px] font-medium text-fg-2">
        <AgentAvatar agentId={run.agentId} size={18} className="rounded-full" />
        {!compact && "Ready to review"}
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    );
  if (run.status === "error" && run.unread)
    return (
      <span className="flex h-[22px] items-center rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-2 text-[11.5px] font-medium text-danger">
        Agent error
      </span>
    );
  return null;
}
