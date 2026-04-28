import { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, timestamp2string, isAdmin } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { DASHBOARD_DATE_PRESETS } from '../../constants/dashboard.constants';
import { StatusContext } from '../../context/Status';

export const AUDIT_DATE_PRESETS = DASHBOARD_DATE_PRESETS.slice(1);

export const useSecurityAuditData = () => {
  const { t } = useTranslation();
  const isAdminUser = isAdmin();
  const [statusState] = useContext(StatusContext);

  const startHour =
    statusState?.status?.security_audit_start_hour ?? 3;
  const endHour =
    statusState?.status?.security_audit_end_hour ?? 7;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('audit-page-size');
    return saved ? parseInt(saved, 10) : ITEMS_PER_PAGE;
  });
  const [selectedPreset, setSelectedPreset] = useState(0);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailUserId, setDetailUserId] = useState(null);
  const [detailUsername, setDetailUsername] = useState('');
  const [detailLogs, setDetailLogs] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPageSize, setDetailPageSize] = useState(ITEMS_PER_PAGE);
  const [detailTimeRange, setDetailTimeRange] = useState(null);
  const [detailAuditDate, setDetailAuditDate] = useState('');

  const getTimeRange = useCallback(() => {
    const preset = AUDIT_DATE_PRESETS[selectedPreset];
    if (!preset) return { startTs: 0, endTs: 0 };
    return {
      startTs: Math.floor(preset.start().getTime() / 1000),
      endTs: Math.floor(preset.end().getTime() / 1000),
    };
  }, [selectedPreset]);

  const loadAuditRecords = useCallback(
    async (page, size) => {
      setLoading(true);
      try {
        const { startTs, endTs } = getTimeRange();
        const res = await API.get(
          `/api/audit/security?p=${page}&page_size=${size}&start_timestamp=${startTs}&end_timestamp=${endTs}`
        );
        const { success, message, data } = res.data;
        if (success) {
          setRecords(
            (data.items || []).map((item) => ({
              ...item,
              key: `user-${item.user_id}`,
              children: item.children
                ? item.children.map((child) => ({
                    ...child,
                    key: `user-${item.user_id}-${child.audit_date}`,
                  }))
                : undefined,
            }))
          );
          setLogCount(data.total || 0);
          setActivePage(page);
        } else {
          showError(message);
        }
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [getTimeRange]
  );

  const loadDetailLogs = useCallback(
    async (userId, page, size, overrideStartTs, overrideEndTs) => {
      setDetailLoading(true);
      try {
        const { startTs, endTs } = getTimeRange();
        const finalStartTs = overrideStartTs ?? startTs;
        const finalEndTs = overrideEndTs ?? endTs;
        const res = await API.get(
          `/api/audit/security/details?user_id=${userId}&p=${page}&page_size=${size}&start_timestamp=${finalStartTs}&end_timestamp=${finalEndTs}`
        );
        const { success, message, data } = res.data;
        if (success) {
          const logs = (data.items || []).map((item, idx) => ({
            ...item,
            key: `detail-${page}-${idx}`,
            timestamp2string: timestamp2string(item.created_at),
          }));
          setDetailLogs(logs);
          setDetailTotal(data.total || 0);
          setDetailPage(page);
        } else {
          showError(message);
        }
      } catch (err) {
        showError(err.message);
      } finally {
        setDetailLoading(false);
      }
    },
    [getTimeRange]
  );

  const openDetailModal = useCallback(
    (record) => {
      setDetailUserId(record.user_id);
      setDetailUsername(record.username || '');
      setDetailAuditDate(record.audit_date || '');
      setShowDetailModal(true);
      setDetailPage(1);
      const overrideStart = record.audit_date ? record.start_time : undefined;
      const overrideEnd = record.audit_date ? record.end_time : undefined;
      setDetailTimeRange(overrideStart != null ? { startTs: overrideStart, endTs: overrideEnd } : null);
      loadDetailLogs(record.user_id, 1, detailPageSize, overrideStart, overrideEnd);
    },
    [loadDetailLogs, detailPageSize]
  );

  const handleDetailPageChange = useCallback(
    (page) => {
      if (detailUserId) {
        loadDetailLogs(detailUserId, page, detailPageSize, detailTimeRange?.startTs, detailTimeRange?.endTs);
      }
    },
    [detailUserId, detailPageSize, detailTimeRange, loadDetailLogs]
  );

  const handleDetailPageSizeChange = useCallback(
    (size) => {
      setDetailPageSize(size);
      if (detailUserId) {
        loadDetailLogs(detailUserId, 1, size, detailTimeRange?.startTs, detailTimeRange?.endTs);
      }
    },
    [detailUserId, detailTimeRange, loadDetailLogs]
  );

  const closeDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setDetailLogs([]);
    setDetailUserId(null);
    setDetailTimeRange(null);
    setDetailAuditDate('');
  }, []);

  const refresh = useCallback(() => {
    loadAuditRecords(1, pageSize);
  }, [loadAuditRecords, pageSize]);

  const handlePageChange = useCallback(
    (page) => {
      loadAuditRecords(page, pageSize);
    },
    [loadAuditRecords, pageSize]
  );

  const handlePageSizeChange = useCallback(
    (size) => {
      setPageSize(size);
      localStorage.setItem('audit-page-size', String(size));
      loadAuditRecords(1, size);
    },
    [loadAuditRecords]
  );

  useEffect(() => {
    loadAuditRecords(1, pageSize);
  }, []);

  return {
    records,
    loading,
    activePage,
    logCount,
    pageSize,
    selectedPreset,
    setSelectedPreset,
    startHour,
    endHour,
    refresh,
    handlePageChange,
    handlePageSizeChange,
    openDetailModal,
    showDetailModal,
    closeDetailModal,
    detailUsername,
    detailAuditDate,
    detailLogs,
    detailLoading,
    detailPage,
    detailTotal,
    detailPageSize,
    handleDetailPageChange,
    handleDetailPageSizeChange,
    isAdminUser,
    t,
  };
};
