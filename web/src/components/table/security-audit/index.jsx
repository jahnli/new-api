import React from 'react';
import CardPro from '../../common/ui/CardPro';
import SecurityAuditTable from './SecurityAuditTable';
import SecurityAuditFilters from './SecurityAuditFilters';
import AuditDetailModal from './modals/AuditDetailModal';
import { useSecurityAuditData } from '../../../hooks/security-audit/useSecurityAuditData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const SecurityAuditPage = () => {
  const auditData = useSecurityAuditData();
  const isMobile = useIsMobile();

  return (
    <>
      <AuditDetailModal {...auditData} />
      <CardPro
        type='type2'
        searchArea={<SecurityAuditFilters {...auditData} />}
        paginationArea={createCardProPagination({
          currentPage: auditData.activePage,
          pageSize: auditData.pageSize,
          total: auditData.logCount,
          onPageChange: auditData.handlePageChange,
          onPageSizeChange: auditData.handlePageSizeChange,
          isMobile,
          t: auditData.t,
        })}
      >
        <SecurityAuditTable {...auditData} />
      </CardPro>
    </>
  );
};

export default SecurityAuditPage;
