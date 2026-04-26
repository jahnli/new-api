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
import { Button, DatePicker, Input } from '@douyinfe/semi-ui';
import { RefreshCw } from 'lucide-react';
import { parseLocalTimestamp } from '../../helpers';

const DashboardHeader = ({
  getGreeting,
  getDepartment,
  greetingVisible,
  refresh,
  loading,
  isAdminUser,
  inputs,
  datePresets,
  handleDateRangeChange,
  handleInputChange,
  onReset,
  t,
}) => {
  const ICON_BUTTON_CLASS = 'text-white hover:bg-opacity-80 !rounded-full';

  return (
    <div className='mb-4'>
      <div className='flex items-center justify-between mb-3'>
        <div
          className='flex items-baseline gap-3 transition-opacity duration-1000 ease-in-out'
          style={{ opacity: greetingVisible ? 1 : 0 }}
        >
          <h2 className='text-2xl font-semibold text-gray-800'>
            {getGreeting}
          </h2>
          {getDepartment && (
            <span className='text-sm text-gray-500'>{getDepartment}</span>
          )}
        </div>
        <Button
          type='tertiary'
          icon={<RefreshCw size={16} />}
          onClick={refresh}
          loading={loading}
          className={`bg-blue-500 hover:bg-blue-600 ${ICON_BUTTON_CLASS}`}
        />
      </div>
      <div className='flex items-center gap-3 flex-wrap justify-end'>
        <DatePicker
          type='dateTimeRange'
          value={[parseLocalTimestamp(inputs.start_timestamp), parseLocalTimestamp(inputs.end_timestamp)]}
          presets={datePresets}
          presetPosition='left'
          onChange={handleDateRangeChange}
          density='compact'
          style={{ width: 430 }}
        />
        {isAdminUser && (
          <Input
            value={inputs.username}
            placeholder={t('用户名称')}
            onChange={(value) => handleInputChange(value, 'username')}
            style={{ width: 200 }}
            size='default'
          />
        )}
        <Button
          onClick={onReset}
        >
          {t('重置')}
        </Button>
        <Button
          theme='solid'
          type='primary'
          onClick={refresh}
          loading={loading}
        >
          {t('查询')}
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
