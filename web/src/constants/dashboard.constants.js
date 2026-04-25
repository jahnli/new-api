/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import dayjs from 'dayjs';

// ========== UI 配置常量 ==========
export const CHART_CONFIG = { mode: 'desktop-browser' };

export const CARD_PROPS = {
  shadows: '',
  bordered: true,
  headerLine: true,
};

export const FORM_FIELD_PROPS = {
  className: 'w-full mb-2 !rounded-lg',
  size: 'large',
};

export const ICON_BUTTON_CLASS = 'text-white hover:bg-opacity-80 !rounded-full';
export const FLEX_CENTER_GAP2 = 'flex items-center gap-2';

export const ILLUSTRATION_SIZE = { width: 96, height: 96 };

// ========== 时间相关常量 ==========
export const TIME_OPTIONS = [
  { label: '小时', value: 'hour', adminOnly: false },
  { label: '天', value: 'day', adminOnly: false },
  { label: '周', value: 'week', adminOnly: false },
  { label: '月', value: 'month', adminOnly: true },
  { label: '季度', value: 'quarter', adminOnly: true },
  { label: '半年', value: 'half_year', adminOnly: true },
  { label: '年', value: 'year', adminOnly: true },
];

export const DEFAULT_TIME_INTERVALS = {
  hour: { seconds: 3600, minutes: 60 },
  today: { seconds: 3600, minutes: 60 },
  day: { seconds: 86400, minutes: 1440 },
  week: { seconds: 604800, minutes: 10080 },
  month: { seconds: 2592000, minutes: 43200 },
  quarter: { seconds: 7776000, minutes: 129600 },
  half_year: { seconds: 15552000, minutes: 259200 },
  year: { seconds: 31536000, minutes: 525600 },
};

export const GRANULARITY_TIME_OFFSETS = {
  hour: 3600,
  today: 86400,
  day: 86400,
  week: 604800,
  month: 2592000,
  quarter: 7776000,
  half_year: 15552000,
  year: 31536000,
};

export const getGranularityTimeRange = (granularity) => {
  const now = dayjs();
  switch (granularity) {
    case 'hour':
      return { start: now.subtract(1, 'hour').startOf('hour'), end: now };
    case 'today':
      return { start: now.subtract(24, 'hour').startOf('hour'), end: now };
    case 'day':
      return {
        start: now.subtract(1, 'day').startOf('day'),
        end: now.subtract(1, 'day').endOf('day'),
      };
    case 'week':
      return { start: now.subtract(7, 'day').startOf('day'), end: now.endOf('day') };
    case 'month':
      return { start: now.subtract(1, 'month').startOf('day'), end: now.endOf('day') };
    case 'quarter':
      return { start: now.subtract(3, 'month').startOf('day'), end: now.endOf('day') };
    case 'half_year':
      return { start: now.subtract(6, 'month').startOf('day'), end: now.endOf('day') };
    case 'year':
      return { start: now.subtract(1, 'year').startOf('day'), end: now.endOf('day') };
    default:
      return { start: now.subtract(1, 'hour'), end: now };
  }
};

// ========== 默认时间设置 ==========
export const DEFAULT_TIME_RANGE = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  HALF_YEAR: 'half_year',
  YEAR: 'year',
};

// ========== 图表默认配置 ==========
export const DEFAULT_CHART_SPECS = {
  PIE: {
    type: 'pie',
    outerRadius: 0.8,
    innerRadius: 0.5,
    padAngle: 0.6,
    valueField: 'value',
    categoryField: 'type',
    pie: {
      style: {
        cornerRadius: 10,
      },
      state: {
        hover: {
          outerRadius: 0.85,
          stroke: '#000',
          lineWidth: 1,
        },
        selected: {
          outerRadius: 0.85,
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
    legends: {
      visible: true,
      orient: 'left',
    },
    label: {
      visible: true,
    },
  },

  BAR: {
    type: 'bar',
    stack: true,
    legends: {
      visible: true,
      selectMode: 'single',
    },
    bar: {
      state: {
        hover: {
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
  },

  LINE: {
    type: 'line',
    legends: {
      visible: true,
      selectMode: 'single',
    },
  },
};

// ========== 公告图例数据 ==========
export const ANNOUNCEMENT_LEGEND_DATA = [
  { color: 'grey', label: '默认', type: 'default' },
  { color: 'blue', label: '进行中', type: 'ongoing' },
  { color: 'green', label: '成功', type: 'success' },
  { color: 'orange', label: '警告', type: 'warning' },
  { color: 'red', label: '异常', type: 'error' },
];

// ========== Uptime 状态映射 ==========
export const UPTIME_STATUS_MAP = {
  1: { color: '#10b981', label: '正常', text: '可用率' }, // UP
  0: { color: '#ef4444', label: '异常', text: '有异常' }, // DOWN
  2: { color: '#f59e0b', label: '高延迟', text: '高延迟' }, // PENDING
  3: { color: '#3b82f6', label: '维护中', text: '维护中' }, // MAINTENANCE
};

// ========== 本地存储键名 ==========
export const STORAGE_KEYS = {
  DATA_EXPORT_DEFAULT_TIME: 'data_export_default_time',
  MJ_NOTIFY_ENABLED: 'mj_notify_enabled',
};

// ========== 默认值 ==========
export const DEFAULTS = {
  PAGE_SIZE: 20,
  CHART_HEIGHT: 96,
  MODEL_TABLE_PAGE_SIZE: 10,
  MAX_TREND_POINTS: 7,
};

// ========== 仪表盘日期预设 ==========
export const DASHBOARD_DATE_PRESETS = [
  {
    text: '最近一小时',
    start: () => dayjs().subtract(1, 'hour').startOf('hour').toDate(),
    end: () => dayjs().toDate(),
    granularity: 'hour',
    adminOnly: false,
  },
  {
    text: '最近一天',
    start: () => dayjs().subtract(24, 'hour').startOf('hour').toDate(),
    end: () => dayjs().toDate(),
    granularity: 'today',
    adminOnly: false,
  },
  {
    text: '昨天',
    start: () => dayjs().subtract(1, 'day').startOf('day').toDate(),
    end: () => dayjs().subtract(1, 'day').endOf('day').toDate(),
    granularity: 'day',
    adminOnly: false,
  },
  {
    text: '最近一周',
    start: () => dayjs().subtract(7, 'day').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
    granularity: 'week',
    adminOnly: false,
  },
  {
    text: '最近一月',
    start: () => dayjs().subtract(1, 'month').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
    granularity: 'month',
    adminOnly: true,
  },
  {
    text: '最近一季度',
    start: () => dayjs().subtract(3, 'month').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
    granularity: 'quarter',
    adminOnly: true,
  },
  {
    text: '最近半年',
    start: () => dayjs().subtract(6, 'month').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
    granularity: 'half_year',
    adminOnly: true,
  },
  {
    text: '最近一年',
    start: () => dayjs().subtract(1, 'year').startOf('day').toDate(),
    end: () => dayjs().endOf('day').toDate(),
    granularity: 'year',
    adminOnly: true,
  },
];
