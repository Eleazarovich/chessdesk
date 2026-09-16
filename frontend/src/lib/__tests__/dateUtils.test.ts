import { describe, expect, it } from 'vitest';
import {
  formatLocalDateTime,
  getLocalDateString,
  getLocalTimeString,
  isCurrentOrFutureDate,
  isCurrentOrFutureDateTime,
} from '../dateUtils';

const now = new Date(2026, 8, 16, 14, 30);

describe('dateUtils', () => {
  it('formats local dates and times for date/time inputs', () => {
    expect(getLocalDateString(now)).toBe('2026-09-16');
    expect(getLocalTimeString(now)).toBe('14:30');
    expect(formatLocalDateTime(now)).toBe('16 Sep 2026, 14:30');
  });

  it('accepts today and future dates but rejects past dates', () => {
    expect(isCurrentOrFutureDate('2026-09-16', now)).toBe(true);
    expect(isCurrentOrFutureDate('2026-09-17', now)).toBe(true);
    expect(isCurrentOrFutureDate('2026-09-15', now)).toBe(false);
  });

  it('rejects past times only when the selected date is today', () => {
    expect(isCurrentOrFutureDateTime('2026-09-16', '14:29', now)).toBe(false);
    expect(isCurrentOrFutureDateTime('2026-09-16', '14:30', now)).toBe(true);
    expect(isCurrentOrFutureDateTime('2026-09-16', '14:31', now)).toBe(true);
    expect(isCurrentOrFutureDateTime('2026-09-17', '08:00', now)).toBe(true);
    expect(isCurrentOrFutureDateTime('2026-09-15', '23:59', now)).toBe(false);
  });
});
