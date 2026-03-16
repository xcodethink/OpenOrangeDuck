// Date formatting utilities

export function formatDate(dateStr: string, locale: string = 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateFull(dateStr: string, locale: string = 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMonth(dateStr: string, locale: string = 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  });
}

export function formatDay(dateStr: string, locale: string = 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Returns YYYY-MM-DD key for grouping */
export function dayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getRelativeTime(dateStr: string, locale: string = 'en'): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (locale === 'zh') {
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return formatDate(dateStr, locale);
  }

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr, locale);
}

export function groupByMonth(dates: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  dates.forEach(dateStr => {
    const monthKey = formatMonth(dateStr);
    const existing = groups.get(monthKey) || [];
    existing.push(dateStr);
    groups.set(monthKey, existing);
  });

  return groups;
}
