// Date helpers. Due dates are local calendar days stored as YYYY-MM-DD.

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function diffDays(key: string, from = todayKey()): number {
  return Math.round((fromKey(key).getTime() - fromKey(from).getTime()) / 86_400_000);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDue(key: string): string {
  const n = diffDays(key);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  const d = fromKey(key);
  if (n > 1 && n < 7) return WEEKDAYS[d.getDay()];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function dueTone(key: string): "overdue" | "today" | "soon" | "later" {
  const n = diffDays(key);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  if (n <= 2) return "soon";
  return "later";
}

export function formatDayHeading(key: string): string {
  const n = diffDays(key);
  const d = fromKey(key);
  const date = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  if (n === 0) return `Today · ${date}`;
  if (n === 1) return `Tomorrow · ${date}`;
  return date;
}

export function relativeTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export { WEEKDAYS };
