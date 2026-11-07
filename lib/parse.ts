import { addDays, todayKey, toKey, fromKey } from "./dates";
import type { List, Priority } from "./types";

// Natural-language quick add: "Send deck to Sam tomorrow p1 #work"

export interface ParsedTask {
  title: string;
  due?: string;
  dueLabel?: string;
  priority?: Priority;
  listId?: string;
  listName?: string;
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function nextWeekday(target: number, base = todayKey()): string {
  const d = fromKey(base);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(base, delta);
}

const DATE_PATTERNS: { re: RegExp; resolve: (m: RegExpMatchArray) => string }[] = [
  { re: /\b(today|tod)\b/i, resolve: () => todayKey() },
  { re: /\b(tomorrow|tmr|tmrw)\b/i, resolve: () => addDays(todayKey(), 1) },
  { re: /\bnext week\b/i, resolve: () => nextWeekday(1) },
  { re: /\bthis weekend\b/i, resolve: () => nextWeekday(6, addDays(todayKey(), -1)) },
  { re: /\bin (\d{1,3}) days?\b/i, resolve: (m) => addDays(todayKey(), Number(m[1])) },
  { re: /\bin (\d{1,2}) weeks?\b/i, resolve: (m) => addDays(todayKey(), Number(m[1]) * 7) },
  {
    re: /\b(?:on |next )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|urday|sday)?\b/i,
    resolve: (m) => nextWeekday(DAY_NAMES.indexOf(m[1].slice(0, 3).toLowerCase())),
  },
  {
    re: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})\b/i,
    resolve: (m) => {
      const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
        m[1].toLowerCase(),
      );
      const now = new Date();
      const d = new Date(now.getFullYear(), month, Number(m[2]));
      if (toKey(d) < todayKey()) d.setFullYear(d.getFullYear() + 1);
      return toKey(d);
    },
  },
];

export function parseQuickAdd(input: string, lists: List[]): ParsedTask {
  let text = ` ${input} `;
  const out: ParsedTask = { title: "" };

  const p = text.match(/\s(?:p|!)([1-4])(?=\s)/i);
  if (p) {
    out.priority = Number(p[1]) as Priority;
    text = text.replace(p[0], " ");
  }

  const tag = text.match(/\s#([\w-]+)(?=\s)/);
  if (tag) {
    const list = lists.find((l) => l.name.toLowerCase().replace(/\s+/g, "-") === tag[1].toLowerCase());
    if (list) {
      out.listId = list.id;
      out.listName = list.name;
      text = text.replace(tag[0], " ");
    }
  }

  for (const { re, resolve } of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      out.due = resolve(m);
      out.dueLabel = m[0].trim();
      text = text.replace(m[0], " ");
      break;
    }
  }

  out.title = text.replace(/\s+/g, " ").trim();
  return out;
}
