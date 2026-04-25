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
import { Avatar, Tag, Typography, Divider } from '@douyinfe/semi-ui';
import {
  isRoot,
  isAdmin,
  renderQuota,
  stringToColor,
} from '../../../../helpers';
import { Coins, BarChart2, Users, ShieldCheck, Shield, User, Hash } from 'lucide-react';

const UserInfoHeader = ({ t, userState, consumedQuota }) => {
  const getUsername = () => {
    return userState.user ? userState.user.username : 'null';
  };

  const getAvatarText = () => {
    const username = getUsername();
    return username && username.length > 0 ? username.slice(0, 2).toUpperCase() : 'NA';
  };

  const getDisplayName = () => {
    const dn = userState.user?.ldap_id;
    if (dn) {
      const cnMatch = dn.match(/CN=([^,]+)/i);
      if (cnMatch) return cnMatch[1];
    }
    return userState.user?.display_name || getUsername();
  };

  const getRoleTag = () => {
    if (isRoot()) return { label: t('超级管理员'), icon: <ShieldCheck size={14} />, color: 'green' };
    if (isAdmin()) return { label: t('管理员'), icon: <Shield size={14} />, color: 'green' };
    return { label: t('普通用户'), icon: <User size={14} />, color: 'green' };
  };

  const role = getRoleTag();

  const stats = [
    { icon: <Coins size={15} />, label: t('总消耗'), value: renderQuota(consumedQuota) },
    { icon: <BarChart2 size={15} />, label: t('请求次数'), value: userState.user?.request_count || 0 },
    { icon: <Users size={15} />, label: t('用户分组'), value: userState?.user?.group || t('默认') },
  ];

  return (
    <div className='rounded-2xl overflow-hidden' style={{
      background: 'var(--semi-color-bg-1)',
      border: '1px solid var(--semi-color-border)',
    }}>
      {/* Cover image banner */}
      <div className='relative h-36 sm:h-44' style={{
        backgroundImage: 'url(/cover-4.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div className='absolute inset-0' style={{
          background: 'linear-gradient(to bottom, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.6) 100%)',
        }} />
      </div>

      {/* Profile — centered */}
      <div className='flex flex-col items-center -mt-14 sm:-mt-16 px-6 sm:px-8 relative z-10'>
        <Avatar
          size='extra-large'
          color={stringToColor(getUsername())}
          src={userState.user?.avatar_url || undefined}
          style={{
            width: 96, height: 96,
            fontSize: 32, fontWeight: 700,
            border: '4px solid var(--semi-color-bg-1)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          {getAvatarText()}
        </Avatar>

        <Typography.Title heading={3} style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          {getDisplayName()}
        </Typography.Title>

        <div className='flex items-center gap-2.5 mt-3 flex-wrap justify-center'>
          <Tag size='large' shape='circle' color={role.color} type='light' prefixIcon={role.icon}
            style={{ fontWeight: 600 }}>
            {role.label}
          </Tag>
          <Tag size='large' shape='circle' color='cyan' type='light'
            style={{ userSelect: 'text' }}>
            {getUsername()}
          </Tag>
          <Tag size='large' shape='circle' color='teal' type='light'
            prefixIcon={<Hash size={11} />}
            style={{ userSelect: 'text' }}>
            {userState?.user?.id}
          </Tag>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '20px 24px' }}>
        <Divider style={{ marginTop: 0, marginBottom: 16 }} />

        {/* Desktop */}
        <div className='hidden sm:flex items-center justify-center gap-8'>
          {stats.map((stat, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Divider layout='vertical' style={{ height: 32 }} />}
              <div className='flex flex-col items-center gap-1'>
                <div className='flex items-center gap-1.5' style={{ color: 'var(--semi-color-text-2)' }}>
                  {stat.icon}
                  <Typography.Text type='tertiary' size='small'>{stat.label}</Typography.Text>
                </div>
                <Typography.Title heading={5} style={{ margin: 0 }}>{stat.value}</Typography.Title>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Mobile */}
        <div className='sm:hidden space-y-3'>
          {stats.map((stat, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Divider style={{ margin: '8px 0' }} />}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2' style={{ color: 'var(--semi-color-text-2)' }}>
                  {stat.icon}
                  <Typography.Text type='tertiary' size='small'>{stat.label}</Typography.Text>
                </div>
                <Typography.Text strong>{stat.value}</Typography.Text>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserInfoHeader;
