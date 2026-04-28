import React from 'react';
import { Button, Select, Tag } from '@douyinfe/semi-ui';
import { AUDIT_DATE_PRESETS } from '../../../hooks/security-audit/useSecurityAuditData';

const SecurityAuditFilters = ({
  selectedPreset,
  setSelectedPreset,
  startHour,
  endHour,
  refresh,
  loading,
  t,
}) => {
  return (
    <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap'>
      <Select
        value={selectedPreset}
        onChange={(value) => {
          setSelectedPreset(value);
        }}
        size='small'
        style={{ minWidth: 140 }}
        placeholder={t('选择时间范围')}
      >
        {AUDIT_DATE_PRESETS.map((preset, idx) => (
          <Select.Option key={idx} value={idx}>
            {t(preset.text)}
          </Select.Option>
        ))}
      </Select>
      <Tag color='violet' size='small'>
        {t('审计时段')}: {startHour}:00 — {endHour}:00
      </Tag>
      <Button
        type='tertiary'
        size='small'
        loading={loading}
        onClick={refresh}
      >
        {t('查询')}
      </Button>
    </div>
  );
};

export default SecurityAuditFilters;
