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

import React from 'react';
import {
  Button,
  Space,
  Tag,
  Tooltip,
  Progress,
  Popover,
  Typography,
  Dropdown,
  Avatar,
} from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';
import { renderGroup, renderNumber, renderQuota, stringToColor } from '../../../helpers';

/**
 * Render user role
 */
const renderRole = (role, t) => {
  switch (role) {
    case 1:
      return (
        <Tag color='blue' shape='circle'>
          {t('普通用户')}
        </Tag>
      );
    case 10:
      return (
        <Tag color='yellow' shape='circle'>
          {t('管理员')}
        </Tag>
      );
    case 100:
      return (
        <Tag color='orange' shape='circle'>
          {t('超级管理员')}
        </Tag>
      );
    default:
      return (
        <Tag color='red' shape='circle'>
          {t('未知身份')}
        </Tag>
      );
  }
};

/**
 * Render username with remark
 */
const renderUsername = (text, record) => {
  const remark = record.remark;
  const cn = parseLdapCN(record.ldap_id);

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

  if (cn && cn !== text) {
    return (
      <div className='flex flex-col'>
        <Space spacing={2}>
          <span>{cn}</span>
          {remarkTag}
        </Space>
        <span className='text-xs text-gray-300'>{text}</span>
      </div>
    );
  }

  return (
    <Space spacing={2}>
      <span>{text}</span>
      {remarkTag}
    </Space>
  );
};

/**
 * Render user statistics
 */
const renderStatistics = (text, record, showEnableDisableModal, t) => {
  const isDeleted = record.DeletedAt !== null;

  // Determine tag text & color like original status column
  let tagColor = 'grey';
  let tagText = t('未知状态');
  if (isDeleted) {
    tagColor = 'red';
    tagText = t('已注销');
  } else if (record.status === 1) {
    tagColor = 'green';
    tagText = t('已启用');
  } else if (record.status === 2) {
    tagColor = 'red';
    tagText = t('已禁用');
  }

  const content = (
    <Tag color={tagColor} shape='circle' size='small'>
      {tagText}
    </Tag>
  );

  const tooltipContent = (
    <div className='text-xs'>
      <div>
        {t('调用次数')}: {renderNumber(record.request_count)}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position='top'>
      {content}
    </Tooltip>
  );
};

// Render separate quota usage column
const renderQuotaUsage = (text, record, t) => {
  const { Paragraph } = Typography;
  const subTotal = parseInt(record.subscription_quota_total) || 0;
  const subUsed = parseInt(record.subscription_quota_used) || 0;
  const hasSubscription = subTotal > 0;

  let used, remain, total;
  if (hasSubscription) {
    total = subTotal;
    used = subUsed;
    remain = total - used;
  } else {
    used = parseInt(record.used_quota) || 0;
    remain = parseInt(record.quota) || 0;
    total = used + remain;
  }
  const percent = total > 0 ? (remain / total) * 100 : 0;
  const popoverContent = (
    <div className='text-xs p-2'>
      <Paragraph copyable={{ content: renderQuota(used) }}>
        {t('已用额度')}: {renderQuota(used)}
      </Paragraph>
      <Paragraph copyable={{ content: renderQuota(remain) }}>
        {t('剩余额度')}: {renderQuota(remain)} ({percent.toFixed(0)}%)
      </Paragraph>
      <Paragraph copyable={{ content: renderQuota(total) }}>
        {t('总额度')}: {renderQuota(total)}
      </Paragraph>
    </div>
  );
  return (
    <Popover content={popoverContent} position='top'>
      <Tag color='white' shape='circle'>
        <div className='flex flex-col items-end'>
          <span className='text-xs leading-none'>{`${renderQuota(remain)} / ${renderQuota(total)}`}</span>
          <Progress
            percent={percent}
            stroke={
              percent <= 10
                ? 'var(--semi-color-danger)'
                : percent <= 30
                  ? 'var(--semi-color-warning)'
                  : 'var(--semi-color-success)'
            }
            aria-label='quota usage'
            format={() => `${percent.toFixed(0)}%`}
            style={{ width: '100%', marginTop: '1px', marginBottom: 0 }}
          />
        </div>
      </Tag>
    </Popover>
  );
};

/**
 * Render invite information
 */
const renderInviteInfo = (text, record, t) => {
  return (
    <div>
      <Space spacing={1}>
        <Tag color='white' shape='circle' className='!text-xs'>
          {t('邀请')}: {renderNumber(record.aff_count)}
        </Tag>
        <Tag color='white' shape='circle' className='!text-xs'>
          {t('收益')}: {renderQuota(record.aff_history_quota)}
        </Tag>
        <Tag color='white' shape='circle' className='!text-xs'>
          {record.inviter_id === 0
            ? t('无邀请人')
            : `${t('邀请人')}: ${record.inviter_id}`}
        </Tag>
      </Space>
    </div>
  );
};

/**
 * Render operations column
 */
const renderOperations = (
  text,
  record,
  {
    setEditingUser,
    setShowEditUser,
    showPromoteModal,
    showDemoteModal,
    showEnableDisableModal,
    showDeleteModal,
    showResetPasskeyModal,
    showResetTwoFAModal,
    showUserSubscriptionsModal,
    showUserStatsModal,
    t,
  },
) => {
  if (record.DeletedAt !== null) {
    return <></>;
  }

  const moreMenu = [
    record.status === 1
      ? {
          node: 'item',
          name: t('禁用'),
          type: 'danger',
          onClick: () => showEnableDisableModal(record, 'disable'),
        }
      : {
          node: 'item',
          name: t('启用'),
          onClick: () => showEnableDisableModal(record, 'enable'),
        },
    {
      node: 'item',
      name: t('编辑'),
      onClick: () => {
        setEditingUser(record);
        setShowEditUser(true);
      },
    },
    {
      node: 'item',
      name: t('提升'),
      onClick: () => showPromoteModal(record),
    },
    {
      node: 'item',
      name: t('降级'),
      onClick: () => showDemoteModal(record),
    },
    {
      node: 'divider',
    },
    {
      node: 'item',
      name: t('重置 Passkey'),
      onClick: () => showResetPasskeyModal(record),
    },
    {
      node: 'item',
      name: t('重置 2FA'),
      onClick: () => showResetTwoFAModal(record),
    },
    {
      node: 'divider',
    },
    {
      node: 'item',
      name: t('注销'),
      type: 'danger',
      onClick: () => showDeleteModal(record),
    },
  ];

  return (
    <Space>
      <Button
        type='primary'
        size='small'
        onClick={() => showUserStatsModal(record)}
      >
        {t('统计')}
      </Button>
      <Button
        type='tertiary'
        size='small'
        onClick={() => showUserSubscriptionsModal(record)}
      >
        {t('订阅')}
      </Button>
      <Dropdown menu={moreMenu} trigger='click' position='bottomRight'>
        <Button type='tertiary' size='small' icon={<IconMore />} />
      </Dropdown>
    </Space>
  );
};

const parseLdapCN = (dn) => {
  if (!dn) return '';
  const parts = dn.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.toUpperCase().startsWith('CN=')) {
      return trimmed.substring(3);
    }
  }
  return '';
};

const parseLdapOUs = (dn) => {
  if (!dn) return [];
  const ous = [];
  const parts = dn.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.toUpperCase().startsWith('OU=')) {
      ous.push(trimmed.substring(3));
    }
  }
  const len = ous.length;
  return [ous[len - 4] || '', ous[len - 5] || '', ous[len - 6] || ''];
};

/**
 * Get users table column definitions
 */
export const getUsersColumns = ({
  t,
  setEditingUser,
  setShowEditUser,
  showPromoteModal,
  showDemoteModal,
  showEnableDisableModal,
  showDeleteModal,
  showResetPasskeyModal,
  showResetTwoFAModal,
  showUserSubscriptionsModal,
  showUserStatsModal,
}) => {
  return [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
      render: (text, record) => renderUsername(text, record),
    },
    {
      title: t('剩余额度/总额度'),
      key: 'quota_usage',
      render: (text, record) => renderQuotaUsage(text, record, t),
    },
    {
      title: t('总消耗'),
      key: 'consumed_quota',
      render: (text, record) => {
        const quota = parseInt(record.total_consumed_quota) || 0;
        return renderQuota(quota);
      },
    },
    {
      title: 'Token',
      key: 'total_tokens',
      render: (text, record) => {
        const prompt = parseInt(record.total_prompt_tokens) || 0;
        const completion = parseInt(record.total_completion_tokens) || 0;
        const tokenCount = parseInt(record.token_count) || 0;
        const tooltipContent = (
          <div className='text-xs'>
            <div>{t('提示 Token')}: {renderNumber(prompt)}</div>
            <div>{t('完成 Token')}: {renderNumber(completion)}</div>
            <div>{t('令牌数')}: {tokenCount}</div>
          </div>
        );
        return (
          <Tooltip content={tooltipContent} position='top'>
            <span>{renderNumber(prompt + completion)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('请求次数'),
      key: 'request_count',
      render: (text, record) => {
        const requests = parseInt(record.total_request_count) || 0;
        return renderNumber(requests);
      },
    },
    {
      title: t('常用模型'),
      dataIndex: 'top_model',
      render: (text) => {
        if (!text) return '-';
        return (
          <Tooltip content={text} position='top'>
            <Tag size='small' color='blue' style={{ maxWidth: 200 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {text}
              </span>
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('部门'),
      dataIndex: 'ldap_id',
      render: (text) => {
        const ous = parseLdapOUs(text);
        const parts = ous.filter((o) => o);
        if (parts.length === 0) return '-';
        const display = parts[0];
        if (parts.length <= 1) return display;
        return (
          <Tooltip content={parts.join(' / ')} position='top'>
            <span>{display}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      render: (text) => {
        if (!text || text.startsWith('0001')) return '-';
        const d = new Date(text);
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      },
    },
    {
      title: t('角色'),
      dataIndex: 'role',
      render: (text, record, index) => {
        return <div>{renderRole(text, t)}</div>;
      },
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        return <div>{renderGroup(text)}</div>;
      },
    },
    {
      title: t('状态'),
      dataIndex: 'info',
      render: (text, record, index) =>
        renderStatistics(text, record, showEnableDisableModal, t),
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 200,
      render: (text, record, index) =>
        renderOperations(text, record, {
          setEditingUser,
          setShowEditUser,
          showPromoteModal,
          showDemoteModal,
          showEnableDisableModal,
          showDeleteModal,
          showResetPasskeyModal,
          showResetTwoFAModal,
          showUserSubscriptionsModal,
          showUserStatsModal,
          t,
        }),
    },
  ];
};
