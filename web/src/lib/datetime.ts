import { format } from 'date-fns';

const DATE_TIME_FORMAT = 'yyyy-MM-dd HH:mm';

/** Format an ISO datetime (backend `createdAt`/`updatedAt`) for display. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, DATE_TIME_FORMAT);
}

/** Format an ISO datetime as a plain date (e.g. for `createdAt` labels). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, 'yyyy-MM-dd');
}
