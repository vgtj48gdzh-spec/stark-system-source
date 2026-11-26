export const AI_TIME_BUCKET_OPTIONS = [
  { label: '全部时间桶', value: '' },
  { label: '本周', value: 'this_week' },
  { label: '上周', value: 'last_week' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '未来', value: 'future' },
  { label: '历史待处理', value: 'backlog_history' },
];

export const AI_PROCESSING_VIEW_OPTIONS = [
  { label: '当前待办', value: 'current' },
  { label: '已暂缓', value: 'deferred' },
  { label: '已完成', value: 'done' },
  { label: '全部', value: 'all' },
];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfWeek(date: Date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay() === 0 ? 7 : value.getDay();
  value.setDate(value.getDate() - day + 1);
  return value;
}

function endOfMonth(date: Date) {
  const value = startOfDay(date);
  value.setMonth(value.getMonth() + 1, 0);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMonths(date: Date, months: number) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return value;
}

function toPeriodKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export function buildTimeBucketPreset(
  timeBucket: string,
  periodMode: string,
): {
  periodKey?: string;
  dateFrom?: string;
  dateTo?: string;
} {
  if (!timeBucket) {
    return {};
  }

  const now = new Date();
  if (timeBucket === 'this_month') {
    return { periodKey: toPeriodKey(now) };
  }
  if (timeBucket === 'last_month') {
    return { periodKey: toPeriodKey(addMonths(now, -1)) };
  }
  if (timeBucket === 'this_week') {
    return {
      dateFrom: startOfWeek(now).toISOString(),
      dateTo: endOfWeek(now).toISOString(),
    };
  }
  if (timeBucket === 'last_week') {
    const anchor = addDays(now, -7);
    return {
      dateFrom: startOfWeek(anchor).toISOString(),
      dateTo: endOfWeek(anchor).toISOString(),
    };
  }
  if (timeBucket === 'future') {
    return { dateFrom: startOfDay(addDays(now, 1)).toISOString() };
  }
  if (timeBucket === 'backlog_history') {
    if (periodMode === 'week') {
      return {
        dateTo: endOfWeek(addDays(now, -7)).toISOString(),
      };
    }
    return {
      dateTo: endOfMonth(addMonths(now, -1)).toISOString(),
    };
  }
  return {};
}

export function formatAiProcessingView(value: string) {
  const matched = AI_PROCESSING_VIEW_OPTIONS.find((item) => item.value === value);
  return matched?.label ?? '当前待办';
}

export function formatAiTimeBucket(value: string) {
  const matched = AI_TIME_BUCKET_OPTIONS.find((item) => item.value === value);
  return matched?.label ?? '全部时间桶';
}

function readQueryValue(value: unknown, fallback = '') {
  if (Array.isArray(value)) {
    return String(value[0] ?? fallback);
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value);
}

// `timeBucket / processingView / periodMode` 是页面路由语义，
// 不能原样传给底层业务列表 API；页面层必须先翻译成真实的 dateFrom/dateTo/periodKey 筛选。
export function resolveAiRouteBucketState(
  query: Record<string, unknown>,
  options?: {
    defaultPeriodMode?: string;
    defaultProcessingView?: string;
  },
) {
  const periodMode = readQueryValue(query.periodMode, options?.defaultPeriodMode ?? 'month');
  const timeBucket = readQueryValue(query.timeBucket, '');
  const processingView = readQueryValue(
    query.processingView,
    options?.defaultProcessingView ?? 'current',
  );
  const routeDateFrom = readQueryValue(query.dateFrom, '');
  const routeDateTo = readQueryValue(query.dateTo, '');

  if (routeDateFrom && routeDateTo) {
    return {
      periodMode,
      timeBucket,
      processingView,
      dateRange: [routeDateFrom, routeDateTo] as [string, string],
    };
  }

  const preset = buildTimeBucketPreset(timeBucket, periodMode);
  return {
    periodMode,
    timeBucket,
    processingView,
    dateRange:
      preset.dateFrom && preset.dateTo
        ? ([preset.dateFrom, preset.dateTo] as [string, string])
        : ([] as []),
  };
}
