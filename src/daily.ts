export type Daily = { today: { date: string; done: number }; completedDays: string[] };

const withDay = (days: string[], day: string): string[] => (days.includes(day) ? days : [...days, day]);

/**
 * Called when one item is finished on `day`. `remaining` = how many items are still available today after this one.
 * An item counts toward the day unless it belongs to an extra round, the stored day is already `day` and that day
 * is already complete; an extra round that crosses midnight therefore counts, item by item, for the new day.
 * The day completes at `daily` items or when nothing is left to practise.
 */
export function finishItem(prev: Daily, day: string, extra: boolean, remaining: number, daily: number): Daily {
  const sameDay = prev.today.date === day;
  if (extra && sameDay && prev.completedDays.includes(day)) return prev;
  const done = (sameDay ? prev.today.done : 0) + 1;
  const complete = done >= daily || remaining === 0;
  return {
    today: { date: day, done },
    completedDays: complete ? withDay(prev.completedDays, day) : prev.completedDays,
  };
}

/** Marks `day` complete when nothing is left to practise and it is not complete yet. */
export function completeIfExhausted(prev: Daily, day: string, available: number): Daily {
  if (available > 0 || prev.completedDays.includes(day)) return prev;
  return {
    today: { date: day, done: prev.today.date === day ? prev.today.done : 0 },
    completedDays: [...prev.completedDays, day],
  };
}
