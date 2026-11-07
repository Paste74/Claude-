"use client";

import { AlertCircle, ArrowUp, Brain, ChevronRight, CircleStop, MessageCircleQuestion } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AGENTS } from "@/lib/agents";
import { useStore } from "@/lib/store";
import type { AgentRun, TimelineItem } from "@/lib/types";
import { StepGlyph } from "./icons";
import { AgentAvatar, Button, cx, Markdown } from "./ui";

export function AgentRunView({ run }: { run: AgentRun }) {
  const { replyToRun, cancelRun, dispatch } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [draft, setDraft] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const agent = AGENTS[run.agentId];
  const running = run.status === "running";

  // Keep pinned to the bottom while streaming unless the user scrolls up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [run.timeline]);

  useEffect(() => {
    if (run.unread && !running) dispatch({ type: "run/patch", id: run.id, patch: { unread: false } });
  }, [run.unread, running, run.id, dispatch]);

  useEffect(() => {
    if (run.status === "needs_input") composer.current?.focus();
  }, [run.status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || running) return;
    replyToRun(run.id, t);
    setDraft("");
    stick.current = true;
  };

  const elapsed = run.finishedAt ? Math.max(1, Math.round((run.finishedAt - run.startedAt) / 1000)) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 overflow-y-auto px-5 py-4"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <AgentAvatar agentId={run.agentId} size={28} active={running} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold">{agent.name}</div>
            <div className="text-[12px] text-fg-3">{agent.tagline}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {run.timeline.map((item, i) => (
            <TimelineRow key={item.id} item={item} live={running && i === run.timeline.length - 1} />
          ))}
          {running && (run.timeline.length === 0 || run.timeline[run.timeline.length - 1].kind === "user") && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="shimmer-text font-medium">Getting started…</span>
            </div>
          )}
          {running && lastIsQuiet(run.timeline) && (
            <div className="flex items-center gap-2 pl-0.5 text-[13px]">
              <span className="shimmer-text font-medium">Working…</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-surface px-4 pt-3 pb-4">
        <div className="mb-2 flex min-h-6 items-center justify-between text-[12px] text-fg-3">
          {running ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {agent.name} is working
              </span>
              <Button size="sm" variant="ghost" onClick={() => cancelRun(run.id)}>
                <CircleStop className="h-3.5 w-3.5" /> Stop
              </Button>
            </>
          ) : run.status === "needs_input" ? (
            <span className="font-medium text-warn">Waiting for your answer</span>
          ) : (
            <span>
              {run.status === "done" ? "Finished" : run.status === "cancelled" ? "Stopped" : "Stopped with an error"}
              {elapsed ? ` in ${elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}m`}` : ""}
              {run.outputTokens ? ` · ${run.outputTokens.toLocaleString()} tokens` : ""}
            </span>
          )}
        </div>
        {!running && run.status !== "needs_input" && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {["Make it more concise", "Go deeper", "Try a different approach"].map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="h-6 rounded-full border border-line-strong px-2.5 text-[12px] text-fg-2 transition-colors hover:bg-hover hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div
          className={cx(
            "flex items-end gap-2 rounded-xl bg-bg p-1.5 pl-3 shadow-card transition-shadow focus-within:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]",
            running && "opacity-60",
          )}
        >
          <textarea
            ref={composer}
            value={draft}
            disabled={running}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            placeholder={
              running ? "The agent is working…" : run.status === "needs_input" ? "Type your answer…" : `Reply to ${agent.name} or ask for changes…`
            }
            className="max-h-36 min-h-7 flex-1 resize-none bg-transparent py-1 text-[13.5px] outline-none placeholder:text-fg-3 [field-sizing:content]"
          />
          <button
            aria-label="Send"
            disabled={running || !draft.trim()}
            onClick={() => send(draft)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

function lastIsQuiet(t: TimelineItem[]) {
  const last = t[t.length - 1];
  return !!last && (last.kind === "step" || last.kind === "sources" || (last.kind === "thinking" && !!last.done) || (last.kind === "draft" && !!last.done));
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function TimelineRow({ item, live }: { item: TimelineItem; live: boolean }) {
  switch (item.kind) {
    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13.5px] whitespace-pre-wrap text-white">
            {item.text}
          </div>
        </div>
      );
    case "text":
      return <Markdown className="text-[13.5px]">{item.text}</Markdown>;
    case "thinking":
      return <Thinking text={item.text} live={live && !item.done} />;
    case "step":
      return (
        <div className="pop-in flex items-center gap-2.5 text-[13px]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hover text-fg-2">
            <StepGlyph icon={item.icon} />
          </span>
          <span className="shrink-0 text-fg-2">{item.label}</span>
          {item.detail && (
            <span className="min-w-0 truncate text-fg-3" title={item.detail}>
              {item.icon === "read" ? hostname(item.detail) : `“${item.detail}”`}
            </span>
          )}
        </div>
      );
    case "sources":
      return (
        <div className="flex flex-wrap gap-1.5 pl-[34px]">
          {item.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              title={s.title}
              className="flex h-6 max-w-[200px] items-center gap-1.5 rounded-md bg-hover px-2 text-[11.5px] text-fg-2 transition-colors hover:bg-active hover:text-fg"
            >
              <span className="truncate">{hostname(s.url)}</span>
            </a>
          ))}
        </div>
      );
    case "draft":
      return <DraftCard title={item.title} content={item.content} live={!item.done} />;
    case "question":
      return (
        <div className="pop-in rounded-xl border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-warn">
            <MessageCircleQuestion className="h-3.5 w-3.5" /> Question for you
          </div>
          <div className="text-[13.5px]">{item.question}</div>
        </div>
      );
    case "error":
      return (
        <div className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {item.message}
        </div>
      );
  }
}

function Thinking({ text, live }: { text: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 text-[13px] text-fg-3 hover:text-fg-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hover">
          <Brain className="h-3.5 w-3.5" />
        </span>
        <span className={cx(live && "shimmer-text font-medium")}>{live ? "Thinking" : "Reasoning"}</span>
        <ChevronRight className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {open && text.trim() && (
        <div className="mt-2 ml-3 border-l-2 border-line pl-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg-3">
          {text.trim()}
        </div>
      )}
    </div>
  );
}

function DraftCard({ title, content, live }: { title: string; content: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  if (!live && !open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2.5 text-left text-[13px] text-fg-3 hover:text-fg-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hover">
          <StepGlyph icon="deliverable" />
        </span>
        Saved “{title || "Untitled"}” to the task
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    );
  return (
    <div className="pop-in overflow-hidden rounded-xl bg-surface shadow-card">
      <button
        onClick={() => !live && setOpen(false)}
        className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-[12.5px] font-medium"
      >
        <StepGlyph icon="deliverable" className="h-3.5 w-3.5 text-fg-3" />
        <span className={cx("truncate", live && "shimmer-text")}>{live ? `Writing ${title ? `“${title}”` : "draft"}…` : title}</span>
      </button>
      <div className={cx("relative max-h-56 overflow-hidden px-3 py-2.5", live && "flex flex-col justify-end")}>
        <Markdown className="text-[12.5px]">{live ? content.slice(-1400) || "…" : content}</Markdown>
        {live && <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-surface to-transparent" />}
      </div>
    </div>
  );
}
