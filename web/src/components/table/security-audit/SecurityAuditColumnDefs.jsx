import React from 'react';
import { Avatar, Space, Tag, Tooltip, Button } from '@douyinfe/semi-ui';
import {
  renderQuota,
  renderNumber,
  timestamp2string,
  stringToColor,
} from '../../../helpers';

function parseLdapCN(dn) {
  if (!dn) return '';
  const parts = dn.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.toUpperCase().startsWith('CN=')) {
      return trimmed.substring(3);
    }
  }
  return '';
}

const renderUsername = (text, record) => {
  const remark = record.remark;
  const cn = parseLdapCN(record.ldap_id);
  const displayName = (cn && cn !== text) ? cn : text;

  const remarkTag = remark ? (
    <Tooltip content={remark} position='top' showArrow>
      <Tag color='white' shape='circle' className='!text-xs'>
        <div className='flex items-center gap-1'>
          <div
            className='w-2 h-2 flex-shrink-0 rounded-full'
            style={{ backgroundColor: '#10b981' }}
          />
          {remark.length > 10 ? remark.slice(0, 10) + '…' : remark}
        </div>
      </Tag>
    </Tooltip>
  ) : null;

  const avatar = (
    <Avatar
      size='extra-small'
      color={stringToColor(displayName)}
      src={record.avatar_url || undefined}
    >
      {displayName.slice(0, 1)}
    </Avatar>
  );

  if (cn && cn !== text) {
    return (
      <Space align='center'>
        {avatar}
        <div className='flex flex-col'>
          <Space spacing={2}>
            <span>{cn}</span>
            {remarkTag}
          </Space>
          <span className='text-xs text-gray-300'>{text}</span>
        </div>
      </Space>
    );
  }

  return (
    <Space align='center'>
      {avatar}
      <Space spacing={2}>
        <span>{text}</span>
        {remarkTag}
      </Space>
    </Space>
  );
};

export const getSecurityAuditColumns = ({ t, openDetailModal, activePage, pageSize }) => [
  {
    title: '#',
    key: 'index',
    width: 50,
    render: (_, __, index) => (activePage - 1) * pageSize + index + 1,
  },
  {
    title: t('用户名'),
    dataIndex: 'username',
    key: 'username',
    width: 180,
    render: (text, record) => renderUsername(text, record),
  },
  {
    title: t('使用模型'),
    dataIndex: 'models',
    key: 'models',
    width: 200,
    render: (text) => {
      if (!text) return '-';
      const models = text.split(',').filter(Boolean);
      return (
        <div className='flex flex-wrap gap-1'>
          {models.map((m) => (
            <Tag key={m} color={stringToColor(m)} size='small'>
              {m}
            </Tag>
          ))}
        </div>
      );
    },
  },
  {
    title: t('开始时间'),
    dataIndex: 'start_time',
    key: 'start_time',
    width: 160,
    render: (val) => (val ? timestamp2string(val) : '-'),
  },
  {
    title: t('结束时间'),
    dataIndex: 'end_time',
    key: 'end_time',
    width: 160,
    render: (val) => (val ? timestamp2string(val) : '-'),
  },
  {
    title: t('总花费'),
    dataIndex: 'total_quota',
    key: 'total_quota',
    width: 120,
    render: (val) => renderQuota(val || 0),
  },
  {
    title: t('请求次数'),
    dataIndex: 'total_requests',
    key: 'total_requests',
    width: 100,
    render: (val) => renderNumber(val || 0),
  },
  {
    title: t('IP 地址'),
    dataIndex: 'ips',
    key: 'ips',
    width: 180,
    render: (text) => {
      if (!text) return '-';
      const ips = text.split(',').filter(Boolean);
      const top3 = ips.slice(0, 3);
      const remaining = ips.length - 3;
      return (
        <div className='flex flex-wrap gap-1'>
          {top3.map((ip) => (
            <Tooltip key={ip} content={ip}>
              <Tag color='orange' size='small'>
                {ip === '::1' ? 'localhost' : ip}
              </Tag>
            </Tooltip>
          ))}
          {remaining > 0 && (
            <Tooltip
              content={ips.slice(3).join(', ')}
              position='top'
              showArrow
            >
              <Tag color='grey' size='small'>
                +{remaining}
              </Tag>
            </Tooltip>
          )}
        </div>
      );
    },
  },
  {
    title: t('操作'),
    key: 'action',
    width: 80,
    fixed: 'right',
    render: (_, record) => (
      <Button
        theme='borderless'
        type='primary'
        size='small'
        onClick={() => openDetailModal(record)}
      >
        {t('详情')}
      </Button>
    ),
  },
];
