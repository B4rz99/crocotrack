/**
 * Parse YYYY-MM-DD as UTC midnight and compare to today's UTC date.
 * Use for event/purchase dates stored as DATE (no time component).
 */
export function isoDateUtcNotAfterToday(val: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  const inputMs = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return inputMs <= todayMs;
}

/** Add whole days to a YYYY-MM-DD string using UTC calendar arithmetic. */
export function addDaysIsoUtc(dateStr: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const base = Date.UTC(y, m - 1, d);
  const next = new Date(base + days * 86_400_000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Today's date as YYYY-MM-DD in UTC. */
export function todayIsoDateUtc(): string {
  const n = new Date();
  const yy = n.getUTCFullYear();
  const mm = String(n.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(n.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
