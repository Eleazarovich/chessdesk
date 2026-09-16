const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeString(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatLocalDateTime(date = new Date()): string {
  const month = SHORT_MONTHS[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${month} ${date.getFullYear()}, ${getLocalTimeString(date)}`;
}

export function isCurrentOrFutureDate(value: string, now = new Date()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= getLocalDateString(now);
}

export function isCurrentOrFutureDateTime(
  dateValue: string,
  timeValue: string,
  now = new Date(),
): boolean {
  if (!isCurrentOrFutureDate(dateValue, now) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
    return false;
  }

  const today = getLocalDateString(now);
  if (dateValue > today) return true;
  return timeValue >= getLocalTimeString(now);
}
