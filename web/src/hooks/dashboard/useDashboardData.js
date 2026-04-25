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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API, isAdmin, showError, timestamp2string } from '../../helpers';
import { getDefaultTime, getInitialTimestamp, getInitialEndTimestamp } from '../../helpers/dashboard';
import { TIME_OPTIONS, DASHBOARD_DATE_PRESETS, GRANULARITY_TIME_OFFSETS, getGranularityTimeRange } from '../../constants/dashboard.constants';
import { useIsMobile } from '../common/useIsMobile';
import { useMinimumLoadingTime } from '../common/useMinimumLoadingTime';

export const useDashboardData = (userState, userDispatch, statusState) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialized = useRef(false);

  // ========== 基础状态 ==========
  const [loading, setLoading] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const showLoading = useMinimumLoadingTime(loading);

  const [resetVersion, setResetVersion] = useState(0);

  const TIME_LABEL_MAP = {
    hour: '最近一小时',
    today: '最近一天',
    day: '昨天',
    week: '最近一周',
    month: '最近一月',
    quarter: '最近一季度',
    half_year: '最近半年',
    year: '最近一年',
  };

  // ========== 查询后的时间标签 ==========
  const [queriedTimeLabel, setQueriedTimeLabel] = useState(
    t(TIME_LABEL_MAP[getDefaultTime()] || ''),
  );

  // ========== 输入状态 ==========
  const [inputs, setInputs] = useState({
    username: '',
    token_name: '',
    model_name: '',
    start_timestamp: getInitialTimestamp(),
    end_timestamp: getInitialEndTimestamp(),
    channel: '',
    data_export_default_time: '',
  });

  const [dataExportDefaultTime, setDataExportDefaultTime] =
    useState(getDefaultTime());

  // ========== 数据状态 ==========
  const [quotaData, setQuotaData] = useState([]);
  const [consumeQuota, setConsumeQuota] = useState(0);
  const [consumeTokens, setConsumeTokens] = useState(0);
  const [times, setTimes] = useState(0);
  const [myRequestCount, setMyRequestCount] = useState(0);
  const [pieData, setPieData] = useState([{ type: 'null', value: '0' }]);
  const [lineData, setLineData] = useState([]);
  const [modelColors, setModelColors] = useState({});

  // ========== 总消耗 ==========
  const [consumedQuota, setConsumedQuota] = useState(0);

  // ========== 订阅状态 ==========
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  // ========== 图表状态 ==========
  const [activeChartTab, setActiveChartTab] = useState('1');

  // ========== 趋势数据 ==========
  const [trendData, setTrendData] = useState({
    balance: [],
    usedQuota: [],
    requestCount: [],
    times: [],
    consumeQuota: [],
    tokens: [],
    rpm: [],
    tpm: [],
  });

  // ========== Uptime 数据 ==========
  const [uptimeData, setUptimeData] = useState([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);
  const [activeUptimeTab, setActiveUptimeTab] = useState('');

  // ========== 常量 ==========
  const now = new Date();
  const isAdminUser = isAdmin();

  // ========== Panel enable flags ==========
  const apiInfoEnabled = statusState?.status?.api_info_enabled ?? true;
  const announcementsEnabled =
    statusState?.status?.announcements_enabled ?? true;
  const faqEnabled = statusState?.status?.faq_enabled ?? true;
  const uptimeEnabled = statusState?.status?.uptime_kuma_enabled ?? true;

  const hasApiInfoPanel = apiInfoEnabled;
  const hasInfoPanels = announcementsEnabled || faqEnabled || uptimeEnabled;

  // ========== Memoized Values ==========
  const datePresets = useMemo(
    () =>
      DASHBOARD_DATE_PRESETS
        .filter((preset) => !preset.adminOnly || isAdminUser)
        .map((preset) => ({
          text: t(preset.text),
          start: preset.start(),
          end: preset.end(),
        })),
    [t, isAdminUser],
  );

  const timeOptions = useMemo(
    () =>
      TIME_OPTIONS
        .filter((option) => !option.adminOnly || isAdminUser)
        .map((option) => ({
          ...option,
          label: t(option.label),
        })),
    [t, isAdminUser],
  );

  const performanceMetrics = useMemo(() => {
    const { start_timestamp, end_timestamp } = inputs;
    const timeDiff =
      (Date.parse(end_timestamp) - Date.parse(start_timestamp)) / 60000;
    const avgRPM = isNaN(times / timeDiff)
      ? '0'
      : (times / timeDiff).toFixed(3);
    const avgTPM = isNaN(consumeTokens / timeDiff)
      ? '0'
      : (consumeTokens / timeDiff).toFixed(3);

    return { avgRPM, avgTPM, timeDiff };
  }, [times, consumeTokens, inputs.start_timestamp, inputs.end_timestamp]);

  const getGreeting = useMemo(() => {
    const hours = new Date().getHours();
    let greeting = '';

    if (hours >= 5 && hours < 12) {
      greeting = t('早上好');
    } else if (hours >= 12 && hours < 14) {
      greeting = t('中午好');
    } else if (hours >= 14 && hours < 18) {
      greeting = t('下午好');
    } else {
      greeting = t('晚上好');
    }

    let displayName = userState?.user?.display_name || userState?.user?.username || '';
    const dn = userState?.user?.ldap_id;
    if (dn) {
      const cnMatch = dn.match(/CN=([^,]+)/i);
      if (cnMatch) {
        displayName = cnMatch[1];
      }
    }
    return `👋${greeting}，${displayName}`;
  }, [t, userState?.user?.username, userState?.user?.display_name, userState?.user?.ldap_id]);

  const getDepartment = useMemo(() => {
    const dn = userState?.user?.ldap_id;
    if (!dn) return '';
    const ous = [];
    const parts = dn.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.toUpperCase().startsWith('OU=')) {
        ous.push(trimmed.substring(3));
      }
    }
    const len = ous.length;
    const levels = [ous[len - 4] || '', ous[len - 5] || '', ous[len - 6] || ''];
    return levels.filter(Boolean).join(' / ');
  }, [userState?.user?.ldap_id]);

  // ========== 回调函数 ==========
  const handleDateRangeChange = useCallback((dateRange) => {
    if (!dateRange || dateRange.length < 2 || !dateRange[0] || !dateRange[1]) return;
    const [start, end] = dateRange;
    const startTs = start.getTime() / 1000;
    const endTs = end.getTime() / 1000;
    setInputs((prev) => ({
      ...prev,
      start_timestamp: timestamp2string(startTs),
      end_timestamp: timestamp2string(endTs),
    }));

    const diffSeconds = endTs - startTs;
    const matched = DASHBOARD_DATE_PRESETS
      .filter((p) => !p.adminOnly || isAdminUser)
      .find((p) => {
        const presetStart = p.start().getTime() / 1000;
        const presetEnd = p.end().getTime() / 1000;
        const presetDiff = presetEnd - presetStart;
        return (
          Math.abs(diffSeconds - presetDiff) < presetDiff * 0.05 &&
          Math.abs(startTs - presetStart) < 60 &&
          Math.abs(endTs - presetEnd) < 60
        );
      });
    if (matched) {
      setDataExportDefaultTime(matched.granularity);
    }
  }, [isAdminUser]);

  const handleInputChange = useCallback((value, name) => {
    if (name === 'data_export_default_time') {
      setDataExportDefaultTime(value);
      const range = getGranularityTimeRange(value);
      setInputs((prev) => ({
        ...prev,
        start_timestamp: timestamp2string(range.start.unix()),
        end_timestamp: timestamp2string(range.end.unix()),
      }));
      return;
    }
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }, []);

  const handleReset = useCallback(() => {
    const range = getGranularityTimeRange('today');
    setDataExportDefaultTime('today');
    localStorage.setItem('data_export_default_time', 'today');
    setInputs((prev) => ({
      ...prev,
      username: '',
      start_timestamp: timestamp2string(range.start.unix()),
      end_timestamp: timestamp2string(range.end.unix()),
    }));
    setResetVersion((v) => v + 1);
  }, []);

  const showSearchModal = useCallback(() => {
    setSearchModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSearchModalVisible(false);
  }, []);

  // ========== API 调用函数 ==========
  const loadQuotaData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '';
      const { start_timestamp, end_timestamp, username } = inputs;
      let localStartTimestamp = Date.parse(start_timestamp) / 1000;
      let localEndTimestamp = Date.parse(end_timestamp) / 1000;

      if (isAdminUser) {
        url = `/api/data/?username=${encodeURIComponent(username)}&start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
      } else {
        url = `/api/data/self/?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}&default_time=${dataExportDefaultTime}`;
      }

      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        setQuotaData(data);
        setQueriedTimeLabel(t(TIME_LABEL_MAP[dataExportDefaultTime] || ''));
        localStorage.setItem('data_export_default_time', dataExportDefaultTime);
        if (data.length === 0) {
          data.push({
            count: 0,
            model_name: '无数据',
            quota: 0,
            created_at: now.getTime() / 1000,
          });
        }
        data.sort((a, b) => a.created_at - b.created_at);
        return data;
      } else {
        showError(message);
        return [];
      }
    } finally {
      setLoading(false);
    }
  }, [inputs, dataExportDefaultTime, isAdminUser, now]);

  const loadUptimeData = useCallback(async () => {
    setUptimeLoading(true);
    try {
      const res = await API.get('/api/uptime/status');
      const { success, message, data } = res.data;
      if (success) {
        setUptimeData(data || []);
        if (data && data.length > 0 && !activeUptimeTab) {
          setActiveUptimeTab(data[0].categoryName);
        }
      } else {
        showError(message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUptimeLoading(false);
    }
  }, [activeUptimeTab]);

  const loadUserQuotaData = useCallback(async () => {
    if (!isAdminUser) return [];
    try {
      const { start_timestamp, end_timestamp } = inputs;
      const localStartTimestamp = Date.parse(start_timestamp) / 1000;
      const localEndTimestamp = Date.parse(end_timestamp) / 1000;
      const url = `/api/data/users?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
      const res = await API.get(url);
      const { success, message, data } = res.data;
      if (success) {
        return data || [];
      } else {
        showError(message);
        return [];
      }
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [inputs, isAdminUser]);

  const loadMyRequestCount = useCallback(async () => {
    try {
      const { start_timestamp, end_timestamp } = inputs;
      const localStartTimestamp = Date.parse(start_timestamp) / 1000;
      const localEndTimestamp = Date.parse(end_timestamp) / 1000;
      const url = `/api/data/self/count?start_timestamp=${localStartTimestamp}&end_timestamp=${localEndTimestamp}`;
      const res = await API.get(url);
      const { success, data } = res.data;
      if (success) {
        setMyRequestCount(data || 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, [inputs]);

  const getUserData = useCallback(async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  }, [userDispatch]);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        const activeSubs = res.data.data?.subscriptions || [];
        if (activeSubs.length > 0) {
          const sub = activeSubs[0];
          const total = sub.subscription?.amount_total || 0;
          const used = sub.subscription?.amount_used || 0;
          setSubscriptionInfo({
            planTitle: sub.plan_title || '',
            total,
            used,
            remaining: Math.max(0, total - used),
          });
        } else {
          setSubscriptionInfo(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadConsumedQuota = useCallback(async () => {
    try {
      const res = await API.get('/api/data/self/consumed');
      const { success, data } = res.data;
      if (success) {
        setConsumedQuota(data || 0);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const refresh = useCallback(async () => {
    const data = await loadQuotaData();
    await Promise.all([loadUptimeData(), loadMyRequestCount(), loadConsumedQuota()]);
    return data;
  }, [loadQuotaData, loadUptimeData, loadMyRequestCount, loadConsumedQuota]);

  const handleSearchConfirm = useCallback(
    async (updateChartDataCallback) => {
      const data = await refresh();
      if (data && data.length > 0 && updateChartDataCallback) {
        updateChartDataCallback(data);
      }
      setSearchModalVisible(false);
    },
    [refresh],
  );

  // ========== Effects ==========
  useEffect(() => {
    const timer = setTimeout(() => {
      setGreetingVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      getUserData();
      initialized.current = true;
    }
  }, [getUserData]);


  return {
    // 基础状态
    loading: showLoading,
    greetingVisible,
    searchModalVisible,

    // 输入状态
    inputs,
    dataExportDefaultTime,
    resetVersion,

    // 数据状态
    quotaData,
    consumeQuota,
    setConsumeQuota,
    consumeTokens,
    setConsumeTokens,
    times,
    setTimes,
    myRequestCount,
    setMyRequestCount,
    pieData,
    setPieData,
    lineData,
    setLineData,
    modelColors,
    setModelColors,

    // 订阅状态
    subscriptionInfo,

    // 总消耗
    consumedQuota,

    // 查询后的时间标签
    queriedTimeLabel,

    // 图表状态
    activeChartTab,
    setActiveChartTab,

    // 趋势数据
    trendData,
    setTrendData,

    // Uptime 数据
    uptimeData,
    uptimeLoading,
    activeUptimeTab,
    setActiveUptimeTab,

    // 计算值
    datePresets,
    timeOptions,
    performanceMetrics,
    getGreeting,
    getDepartment,
    isAdminUser,
    hasApiInfoPanel,
    hasInfoPanels,
    apiInfoEnabled,
    announcementsEnabled,
    faqEnabled,
    uptimeEnabled,

    // 函数
    handleInputChange,
    handleDateRangeChange,
    handleReset,
    showSearchModal,
    handleCloseModal,
    loadQuotaData,
    loadUserQuotaData,
    loadMyRequestCount,
    loadConsumedQuota,
    loadSubscriptionInfo,
    loadUptimeData,
    getUserData,
    refresh,
    handleSearchConfirm,

    // 导航和翻译
    navigate,
    t,
    isMobile,
  };
};
