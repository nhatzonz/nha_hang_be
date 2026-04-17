export type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * Lấy range từ period string hoặc custom from/to.
 * Week = 7 ngày gần đây, Month = 30 ngày, Year = 365 ngày.
 */
export const resolvePeriod = (
  period?: PeriodType,
  from?: string,
  to?: string,
): DateRange => {
  const now = new Date();

  if (period === 'custom' || (from && to)) {
    return {
      from: from ? startOfDay(new Date(from)) : startOfDay(now),
      to: to ? endOfDay(new Date(to)) : endOfDay(now),
    };
  }

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: startOfDay(start), to: endOfDay(now) };
  }

  if (period === 'month') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { from: startOfDay(start), to: endOfDay(now) };
  }

  if (period === 'year') {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    return { from: startOfDay(start), to: endOfDay(now) };
  }

  // Default: today
  return { from: startOfDay(now), to: endOfDay(now) };
};

/**
 * Tính kỳ trước liền kề (cùng độ dài) để so sánh.
 */
export const getPreviousRange = (range: DateRange): DateRange => {
  const duration = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - duration - 1),
    to: new Date(range.from.getTime() - 1),
  };
};

export const calcChangePercent = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};
