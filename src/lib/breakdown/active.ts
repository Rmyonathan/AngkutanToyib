/** Breakdown is ongoing: already started and not yet finished (end empty or in the future). */
export function isBreakdownActive(
  b: { startTime: Date | string; endTime: Date | string | null },
  now: Date = new Date()
) {
  const start = new Date(b.startTime).getTime();
  const end = b.endTime ? new Date(b.endTime).getTime() : null;
  return start <= now.getTime() && (end == null || end > now.getTime());
}
