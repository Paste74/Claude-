"use client";

import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  Monitor,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { uid, useStore } from "@/lib/store";
import type { ViewId } from "@/lib/types";
import { counts } from "@/lib/views";
import { cx, IconButton, Kbd } from "./ui";

export type ThemePref = "light" | "dark" | "system";

const LIST_COLORS = ["#7c5cff", "#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#ef4444", "#64748b"];

export function Sidebar({
  view,
  setView,
  openPalette,
  theme,
  setTheme,
  onNavigate,
}: {
  view: ViewId;
  setView: (v: ViewId) => void;
  openPalette: () => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  onNavigate?: () => void;
}) {
  const { state, dispatch } = useStore();
  const c = counts(state);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const go = (v: ViewId) => {
    setView(v);
    onNavigate?.();
  };

  const createList = () => {
    const n = name.trim();
    if (n) {
      const id = uid();
      dispatch({
        type: "list/add",
        list: { id, name: n, color: LIST_COLORS[state.lists.length % LIST_COLORS.length] },
      });
      go(`list:${id}`);
    }
    setName("");
    setAdding(false);
  };

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex h-12 items-center gap-2 px-4">
        <Logo />
        <span className="text-[14.5px] font-semibold tracking-[-0.01em]">Tempo</span>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={openPalette}
          className="flex h-8 w-full items-center gap-2 rounded-lg bg-surface px-2.5 text-[13px] text-fg-3 shadow-card transition-colors hover:text-fg-2"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <NavItem icon={<Inbox className="h-4 w-4" />} label="All tasks" count={c.inbox} active={view === "inbox"} onClick={() => go("inbox")} />
        <NavItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Today"
          count={c.today}
          countTone={c.overdue ? "danger" : undefined}
          active={view === "today"}
          onClick={() => go("today")}
          iconColor="var(--accent)"
        />
        <NavItem icon={<CalendarDays className="h-4 w-4" />} label="Upcoming" count={c.upcoming} active={view === "upcoming"} onClick={() => go("upcoming")} />
        <NavItem
          icon={<Sparkles className="h-4 w-4" />}
          label="Agents"
          count={c.running || c.attention || undefined}
          countTone={c.running ? "live" : c.attention ? "accent" : undefined}
          active={view === "agents"}
          onClick={() => go("agents")}
        />
        <NavItem icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" active={view === "completed"} onClick={() => go("completed")} />

        <div className="group mt-5 mb-1 flex items-center justify-between px-2.5">
          <span className="text-[11.5px] font-medium tracking-wide text-fg-3 uppercase">Lists</span>
          <IconButton label="New list" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        </div>
        {state.lists.map((l) => (
          <div key={l.id} className="group relative">
            <NavItem
              icon={<span className="m-[3px] h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color }} />}
              label={l.name}
              count={c.byList[l.id]}
              active={view === `list:${l.id}`}
              onClick={() => go(`list:${l.id}`)}
            />
            <IconButton
              label={`Delete ${l.name}`}
              className="absolute top-1 right-1 h-6 w-6 bg-sidebar opacity-0 group-hover:opacity-100"
              onClick={() => {
                if (confirm(`Delete the list “${l.name}”? Its tasks move to All tasks.`)) {
                  dispatch({ type: "list/delete", id: l.id });
                  if (view === `list:${l.id}`) go("inbox");
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ))}
        {adding ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={createList}
            onKeyDown={(e) => {
              if (e.key === "Enter") createList();
              if (e.key === "Escape") {
                setName("");
                setAdding(false);
              }
            }}
            placeholder="List name"
            className="mt-0.5 h-8 w-full rounded-lg bg-surface px-2.5 text-[13px] shadow-card outline-none"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg-3 transition-colors hover:bg-hover hover:text-fg-2"
          >
            <Plus className="h-4 w-4" /> New list
          </button>
        )}
      </nav>

      <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
        <div className="flex rounded-lg bg-hover p-0.5">
          {(
            [
              ["light", Sun],
              ["dark", Moon],
              ["system", Monitor],
            ] as const
          ).map(([t, Icon]) => (
            <button
              key={t}
              aria-label={`${t} theme`}
              title={`${t[0].toUpperCase()}${t.slice(1)} theme`}
              onClick={() => setTheme(t)}
              className={cx(
                "flex h-6 w-7 items-center justify-center rounded-md transition-colors",
                theme === t ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg-2",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-fg-3">
          <Kbd>?</Kbd> shortcuts
        </span>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  count,
  countTone,
  active,
  onClick,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  countTone?: "danger" | "accent" | "live";
  active?: boolean;
  onClick: () => void;
  iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
        active ? "bg-active font-medium text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
      )}
    >
      <span className="flex w-4 justify-center" style={{ color: active ? iconColor ?? "var(--text)" : undefined }}>
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {!!count && (
        <span
          className={cx(
            "flex min-w-5 items-center justify-center gap-1 rounded-full px-1.5 text-[11.5px] tabular-nums",
            countTone === "danger" && "text-danger",
            countTone === "accent" && "bg-accent text-white font-medium h-[18px]",
            countTone === "live" && "text-accent-text font-medium",
            !countTone && "text-fg-3",
          )}
        >
          {countTone === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
          {count}
        </span>
      )}
    </button>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="tempo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6dff" />
          <stop offset="1" stopColor="#5b38ee" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#tempo-g)" />
      <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.6" cy="16.6" r="1.6" fill="white" opacity="0.85" />
    </svg>
  );
}
