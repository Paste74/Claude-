"use client";

import clsx from "clsx";
import { Check, Flag } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AGENTS } from "@/lib/agents";
import type { AgentId, Priority } from "@/lib/types";
import { AgentGlyph } from "./icons";

export const cx = clsx;

type Variant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
>(function Button({ variant = "secondary", size = "md", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-100 select-none whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
        variant === "secondary" && "bg-surface text-fg shadow-card hover:bg-hover",
        variant === "ghost" && "text-fg-2 hover:bg-hover hover:text-fg",
        variant === "danger" && "text-danger hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]",
        className,
      )}
    />
  );
});

export function IconButton({
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-hover hover:text-fg",
        className,
      )}
    />
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-sans text-[10.5px] font-medium text-fg-3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  1: "var(--p1)",
  2: "var(--p2)",
  3: "var(--p3)",
  4: "var(--text-3)",
};
export const PRIORITY_LABEL: Record<Priority, string> = { 1: "Urgent", 2: "High", 3: "Medium", 4: "No priority" };

export function PriorityFlag({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Flag
      className={cx("h-3.5 w-3.5", className)}
      style={{ color: PRIORITY_COLOR[priority] }}
      fill={priority < 4 ? PRIORITY_COLOR[priority] : "none"}
      fillOpacity={0.2}
      strokeWidth={2}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  priority = 4,
  size = 18,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  priority?: Priority;
  size?: number;
  label?: string;
}) {
  const color = priority < 4 ? PRIORITY_COLOR[priority] : "var(--text-3)";
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Mark incomplete" : "Mark complete")}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cx(
        "group/check relative flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150",
        checked && "check-pop",
      )}
      style={{
        width: size,
        height: size,
        borderColor: checked ? "var(--accent)" : color,
        background: checked ? "var(--accent)" : priority < 4 ? `color-mix(in srgb, ${color} 10%, transparent)` : "transparent",
      }}
    >
      <Check
        className={cx(
          "transition-opacity",
          checked ? "text-white opacity-100" : "opacity-0 group-hover/check:opacity-60",
        )}
        style={{ width: size * 0.62, height: size * 0.62, color: checked ? "white" : color }}
        strokeWidth={3}
      />
    </button>
  );
}

export function AgentAvatar({
  agentId,
  size = 22,
  active,
  className,
}: {
  agentId: AgentId;
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const a = AGENTS[agentId];
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-[7px] text-white", active && "pulse-ring", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a.color}, color-mix(in srgb, ${a.color} 70%, #000))`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      <AgentGlyph agentId={agentId} size={size * 0.58} />
    </span>
  );
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx("prose-tempo", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// Minimal popover anchored below its trigger. Closes on outside click / Esc.
export function Popover({
  open,
  onClose,
  children,
  className,
  align = "start",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown));
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cx(
        "pop-in absolute top-full z-50 mt-1.5 rounded-xl bg-elevated p-1 shadow-pop",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  active,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-hover",
        active && "bg-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    (text: string) => {
      void navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    },
  ];
}
