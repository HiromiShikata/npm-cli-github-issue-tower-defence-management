const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const formatRelativeTime = (iso: string, now: number): string => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const diff = now - then;
  if (diff < 45 * MS_PER_SECOND) {
    return 'just now';
  }
  if (diff < MS_PER_HOUR) {
    const minutes = Math.round(diff / MS_PER_MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diff < MS_PER_DAY) {
    const hours = Math.round(diff / MS_PER_HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.round(diff / MS_PER_DAY);
  if (days === 1) {
    return 'yesterday';
  }
  if (days < 30) {
    return `${days} days ago`;
  }
  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', {
    year: sameYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatFullTimestamp = (iso: string): string => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  return new Date(then).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
