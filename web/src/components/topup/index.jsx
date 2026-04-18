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

import React, { useEffect, useState, useContext } from 'react';
import {
  API,
  showError,
  renderQuota,
} from '../../helpers';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';

import SubscriptionPlansCard from './SubscriptionPlansCard';
import {
  Avatar,
  Card,
  Typography,
} from '@douyinfe/semi-ui';
import {
  CreditCard,
  TrendingUp,
  BarChart2,
} from 'lucide-react';

const { Text } = Typography;

const TopUp = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);

  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(false);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);
  const [payMethods, setPayMethods] = useState([]);

  // 订阅相关
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      userDispatch({ type: 'login', payload: data });
    } else {
      showError(message);
    }
  };

  const getSubscriptionPlans = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setSubscriptionPlans(res.data.data || []);
      }
    } catch (e) {
      setSubscriptionPlans([]);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getSubscriptionSelf = async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        const activeSubs = res.data.data?.subscriptions || [];
        setActiveSubscriptions(activeSubs);
        const allSubs = res.data.data?.all_subscriptions || [];
        setAllSubscriptions(allSubs);
      }
    } catch (e) {
      // ignore
    }
  };

  const getTopupInfo = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { data, success } = res.data;
      if (success) {
        let methods = data.pay_methods || [];
        try {
          if (typeof methods === 'string') {
            methods = JSON.parse(methods);
          }
          if (methods && methods.length > 0) {
            methods = methods.filter((m) => m.name && m.type);
          } else {
            methods = [];
          }
          setPayMethods(methods);
        } catch (e) {
          setPayMethods([]);
        }
        setEnableOnlineTopUp(data.enable_online_topup || false);
        setEnableStripeTopUp(data.enable_stripe_topup || false);
        setEnableCreemTopUp(data.enable_creem_topup || false);
      }
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    getUserQuota().then();
    getTopupInfo().then();
    getSubscriptionPlans().then();
    getSubscriptionSelf().then();
  }, []);

  return (
    <div className='w-full max-w-4xl mx-auto relative min-h-screen lg:min-h-0 mt-[60px] px-2'>
      <Card className='!rounded-2xl shadow-sm border-0'>
        {/* 卡片头部 */}
        <div className='flex items-center mb-4'>
          <Avatar size='small' color='blue' className='mr-3 shadow-md'>
            <CreditCard size={16} />
          </Avatar>
          <div>
            <Typography.Text className='text-lg font-medium'>
              {t('额度管理')}
            </Typography.Text>
          </div>
        </div>

        {/* 账户统计 */}
        <Card
          className='!rounded-xl w-full mb-4'
          cover={
            <div
              className='relative h-30'
              style={{
                '--palette-primary-darkerChannel': '37 99 235',
                backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className='relative z-10 h-full flex flex-col justify-between p-4'>
                <div className='flex justify-between items-center'>
                  <Text strong style={{ color: 'white', fontSize: '16px' }}>
                    {t('账户统计')}
                  </Text>
                </div>

                <div className='grid grid-cols-2 gap-6 mt-4'>
                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {renderQuota(userState?.user?.used_quota)}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <TrendingUp
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '12px',
                        }}
                      >
                        {t('历史消耗')}
                      </Text>
                    </div>
                  </div>

                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {userState?.user?.request_count || 0}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <BarChart2
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '12px',
                        }}
                      >
                        {t('请求次数')}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
        />

        {/* 订阅套餐 */}
        <SubscriptionPlansCard
          t={t}
          loading={subscriptionLoading}
          plans={subscriptionPlans}
          payMethods={payMethods}
          enableOnlineTopUp={enableOnlineTopUp}
          enableStripeTopUp={enableStripeTopUp}
          enableCreemTopUp={enableCreemTopUp}
          activeSubscriptions={activeSubscriptions}
          allSubscriptions={allSubscriptions}
          reloadSubscriptionSelf={getSubscriptionSelf}
          withCard={false}
        />
      </Card>
    </div>
  );
};

export default TopUp;
