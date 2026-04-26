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

import { useMemo } from 'react';
import { Wallet, Activity, Zap, Gauge, Info } from 'lucide-react';
import {
  IconMoneyExchangeStroked,
  IconHistogram,
  IconCoinMoneyStroked,
  IconTextStroked,
  IconPulse,
  IconStopwatchStroked,
  IconTypograph,
  IconSend,
} from '@douyinfe/semi-icons';
import { Tooltip } from '@douyinfe/semi-ui';
import { renderQuota } from '../../helpers';
import { createSectionTitle } from '../../helpers/dashboard';

export const useDashboardStats = (
  userState,
  consumeQuota,
  consumeTokens,
  times,
  myRequestCount,
  isAdminUser,
  subscriptionInfo,
  timeLabel,
  trendData,
  performanceMetrics,
  consumedQuota,
  totalRequestCount,
  navigate,
  t,
) => {
  const groupedStatsData = useMemo(
    () => [
      {
        title: createSectionTitle(Wallet, t('账户数据')),
        color: 'bg-blue-50',
        items: [
          {
            title: t('当前订阅'),
            value: subscriptionInfo
              ? `${renderQuota(subscriptionInfo.remaining)} / ${renderQuota(subscriptionInfo.total)}`
              : t('无'),
            planTitle: subscriptionInfo?.planTitle || '',
            hasSubscriptionBar: true,
            subscriptionPercent: subscriptionInfo?.total > 0
              ? Math.round((subscriptionInfo.remaining / subscriptionInfo.total) * 100)
              : null,
            icon: <IconMoneyExchangeStroked />,
            avatarColor: 'blue',
            trendData: [],
            trendColor: '#3b82f6',
          },
          {
            layout: 'inline',
            inlineItems: [
              {
                title: t('总消耗'),
                value: renderQuota(consumedQuota),
                icon: <IconHistogram />,
                avatarColor: 'purple',
              },
              {
                title: t('总请求'),
                value: totalRequestCount.toLocaleString(),
                icon: <IconSend />,
                avatarColor: 'teal',
              },
            ],
          },
        ],
      },
      {
        title: createSectionTitle(Activity, t('使用统计'), timeLabel),
        color: 'bg-green-50',
        items: [
          {
            title: t('我的请求'),
            value: myRequestCount,
            icon: <IconSend />,
            avatarColor: 'green',
            trendData: [],
            trendColor: '#10b981',
          },
          ...(isAdminUser
            ? [
                {
                  title: t('平台请求'),
                  value: times,
                  icon: <IconPulse />,
                  avatarColor: 'cyan',
                  trendData: trendData.times,
                  trendColor: '#06b6d4',
                },
              ]
            : []),
        ],
      },
      {
        title: createSectionTitle(Zap, t('资源消耗'), timeLabel),
        color: 'bg-yellow-50',
        items: [
          {
            title: t('统计额度'),
            value: renderQuota(consumeQuota),
            icon: <IconCoinMoneyStroked />,
            avatarColor: 'yellow',
            trendData: trendData.consumeQuota,
            trendColor: '#f59e0b',
          },
          {
            title: t('统计 Tokens'),
            value: isNaN(consumeTokens) ? 0 : consumeTokens.toLocaleString(),
            icon: <IconTextStroked />,
            avatarColor: 'pink',
            trendData: trendData.tokens,
            trendColor: '#ec4899',
          },
        ],
      },
      {
        title: createSectionTitle(Gauge, t('性能指标'), timeLabel),
        color: 'bg-indigo-50',
        items: [
          {
            title: (
              <span className='inline-flex items-center gap-1'>
                {t('平均 RPM')}
                <Tooltip content={t('每分钟请求数 (Requests Per Minute)')} position='top'>
                  <Info size={12} className='text-gray-400 cursor-help' />
                </Tooltip>
              </span>
            ),
            value: performanceMetrics.avgRPM,
            icon: <IconStopwatchStroked />,
            avatarColor: 'indigo',
            trendData: trendData.rpm,
            trendColor: '#6366f1',
          },
          {
            title: (
              <span className='inline-flex items-center gap-1'>
                {t('平均 TPM')}
                <Tooltip content={t('每分钟 Token 数 (Tokens Per Minute)')} position='top'>
                  <Info size={12} className='text-gray-400 cursor-help' />
                </Tooltip>
              </span>
            ),
            value: performanceMetrics.avgTPM,
            icon: <IconTypograph />,
            avatarColor: 'orange',
            trendData: trendData.tpm,
            trendColor: '#f97316',
          },
        ],
      },
    ],
    [
      consumedQuota,
      totalRequestCount,
      subscriptionInfo,
      timeLabel,
      times,
      myRequestCount,
      isAdminUser,
      consumeQuota,
      consumeTokens,
      trendData,
      performanceMetrics,
      navigate,
      t,
    ],
  );

  return {
    groupedStatsData,
  };
};
