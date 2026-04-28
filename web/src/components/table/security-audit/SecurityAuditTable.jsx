import React, { useMemo } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardTable from '../../common/ui/CardTable';
import { getSecurityAuditColumns } from './SecurityAuditColumnDefs';

const SecurityAuditTable = ({
  records,
  loading,
  openDetailModal,
  activePage,
  pageSize,
  t,
}) => {
  const columns = useMemo(
    () => getSecurityAuditColumns({ t, openDetailModal, activePage, pageSize }),
    [t, openDetailModal, activePage, pageSize]
  );

  return (
    <CardTable
      columns={columns}
      dataSource={records}
      rowKey='key'
      loading={loading}
      scroll={{ x: 'max-content' }}
      empty={
        <Empty
          image={<IllustrationNoResult />}
          darkModeImage={<IllustrationNoResultDark />}
          description={t('搜索无结果')}
        />
      }
      pagination={false}
    />
  );
};

export default SecurityAuditTable;
