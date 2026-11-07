"use client";

import { CalendarDays, CornerDownLeft, Hash, Plus, Sparkles, X } from "lucide-react";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AGENT_LIST, AGENTS } from "@/lib/agents";
import { formatDue, todayKey } from "@/lib/dates";
import { parseQuickAdd } from "@/lib/parse";
import { useStore } from "@/lib/store";
import type { AgentId, ViewId } from "@/lib/types";
import { AgentAvatar, cx, Kbd, MenuItem, Popover, PriorityFlag, PRIORITY_LABEL } from "./ui";

export interface QuickAddHandle {
  focus: () => void;
}

export const QuickAdd = forwardRef<QuickAddHandle, { view: ViewId; onCreated?: (id: string) => void }>(
  function QuickAdd({ view, onCreated }, ref) {
    const { state, addTask, startAgent } = useStore();
    const [text, setText] = useState("");
    const [focused, setFocused] = useState(false);
    const [agent, setAgent] = useState<AgentId | null>(null);
    const [agentMenu, setAgentMenu] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

    const parsed = useMemo(() => parseQuickAdd(text, state.lists), [text, state.lists]);
    const defaultList = view.startsWith("list:") ? view.slice(5) : undefined;
    const defaultDue = view === "today" ? todayKey() : undefined;

    const submit = () => {
      if (!parsed.title) return;
      const task = addTask({
        title: parsed.title,
        due: parsed.due ?? defaultDue,
        priority: parsed.priority,
        listId: parsed.listId ?? defaultList,
      });
      if (agent) startAgent(task.id, agent);
      setText("");
      onCreated?.(task.id);
    };

    const active = focused || text.length > 0;
    const listForChip = parsed.listName ?? (defaultList ? state.lists.find((l) => l.id === defaultList)?.name : undefined);

    return (
      <div
        className={cx(
          "rounded-xl bg-surface transition-shadow duration-150",
          active ? "shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]" : "shadow-card",
        )}
      >
        <div className="flex items-center gap-2.5 px-3">
          <Plus className={cx("h-4 w-4 shrink-0 transition-colors", active ? "text-accent" : "text-fg-3")} />
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                setText("");
                input.current?.blur();
              }
            }}
            placeholder="Add a task… try “Draft launch email tomorrow p2 #work”"
            className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3"
          />
          {!active && <Kbd>N</Kbd>}
        </div>
        {active && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-2.5 py-2">
            {parsed.due || defaultDue ? (
              <Chip>
                <CalendarDays className="h-3 w-3" /> {formatDue((parsed.due ?? defaultDue)!)}
              </Chip>
            ) : null}
            {parsed.priority && (
              <Chip>
                <PriorityFlag priority={parsed.priority} className="h-3 w-3" /> {PRIORITY_LABEL[parsed.priority]}
              </Chip>
            )}
            {listForChip && (
              <Chip>
                <Hash className="h-3 w-3" /> {listForChip}
              </Chip>
            )}
            <div className="relative">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAgentMenu((v) => !v)}
                className={cx(
                  "flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors",
                  agent ? "bg-accent-soft text-accent-text" : "text-fg-3 hover:bg-hover hover:text-fg-2",
                )}
              >
                {agent ? <AgentAvatar agentId={agent} size={14} /> : <Sparkles className="h-3 w-3" />}
                {agent ? `${AGENTS[agent].name} will start` : "Hand to an agent"}
                {agent && (
                  <X
                    className="h-3 w-3 opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAgent(null);
                    }}
                  />
                )}
              </button>
              <Popover open={agentMenu} onClose={() => setAgentMenu(false)} className="w-64">
                {AGENT_LIST.map((a) => (
                  <MenuItem
                    key={a.id}
                    active={agent === a.id}
                    onClick={() => {
                      setAgent(a.id);
                      setAgentMenu(false);
                      input.current?.focus();
                    }}
                  >
                    <AgentAvatar agentId={a.id} size={20} />
                    <span className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-[11.5px] text-fg-3">{a.tagline}</span>
                    </span>
                  </MenuItem>
                ))}
              </Popover>
            </div>
            <span className="ml-auto hidden items-center gap-1 text-[11.5px] text-fg-3 sm:flex">
              <CornerDownLeft className="h-3 w-3" /> to add
            </span>
          </div>
        )}
      </div>
    );
  },
);

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pop-in flex h-6 items-center gap-1.5 rounded-md bg-hover px-2 text-[12px] font-medium text-fg-2">
      {children}
    </span>
  );
}
