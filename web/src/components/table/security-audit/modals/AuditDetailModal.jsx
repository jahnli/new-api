import React, { useMemo } from 'react';
import { Modal, Table, Empty } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getLogsColumns } from '../../usage-logs/UsageLogsColumnDefs';
import { copy, showSuccess } from '../../../../helpers';

const COLUMN_KEYS = {
  TIME: 'time',
  CHANNEL: 'channel',
  USERNAME: 'username',
  TOKEN: 'token',
  GROUP: 'group',
  TYPE: 'type',
  MODEL: 'model',
  USE_TIME: 'use_time',
  PROMPT: 'prompt',
  COMPLETION: 'completion',
  COST: 'cost',
  RETRY: 'retry',
  IP: 'ip',
  DETAILS: 'details',
};

const AuditDetailModal = ({
  showDetailModal,
  closeDetailModal,
  detailUsername,
  detailLogs,
  detailLoading,
  detailPage,
  detailTotal,
  detailPageSize,
  handleDetailPageChange,
  handleDetailPageSizeChange,
  isAdminUser,
  t,
}) => {
  const copyText = (text) => {
    copy(text);
    showSuccess(t('复制成功'));
  };

  const allColumns = useMemo(
    () =>
      getLogsColumns({
        t,
        COLUMN_KEYS,
        copyText,
        showUserInfoFunc: () => {},
        openChannelAffinityUsageCacheModal: () => {},
        isAdminUser: isAdminUser,
        billingDisplayMode: 'price',
      }),
    [t, isAdminUser]
  );

  const columns = useMemo(() => {
    const visibleKeys = new Set([
      COLUMN_KEYS.TIME,
      COLUMN_KEYS.MODEL,
      COLUMN_KEYS.USE_TIME,
      COLUMN_KEYS.PROMPT,
      COLUMN_KEYS.COMPLETION,
      COLUMN_KEYS.COST,
      COLUMN_KEYS.IP,
      COLUMN_KEYS.DETAILS,
    ]);
    if (isAdminUser) {
      visibleKeys.add(COLUMN_KEYS.CHANNEL);
    }
    return allColumns
      .filter((col) => visibleKeys.has(col.key))
      .map((col) => ({ ...col, fixed: undefined }));
  }, [allColumns, isAdminUser]);

  return (
    <Modal
      title={`${t('安全审计详情')} - ${detailUsername}`}
      visible={showDetailModal}
      onCancel={closeDetailModal}
      footer={null}
      centered
      width={1200}
      maskClosable
      closable
    >
      <Table
        columns={columns}
        dataSource={detailLogs}
        loading={detailLoading}
        rowKey='key'
        size='small'
        scroll={{ x: 'max-content' }}
        empty={
          <Empty
            image={<IllustrationNoResult />}
            darkModeImage={<IllustrationNoResultDark />}
            description={t('搜索无结果')}
          />
        }
        pagination={{
          currentPage: detailPage,
          pageSize: detailPageSize,
          total: detailTotal,
          onPageChange: handleDetailPageChange,
          onPageSizeChange: handleDetailPageSizeChange,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50],
        }}
      />
    </Modal>
  );
};

export default AuditDetailModal;
