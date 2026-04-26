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

import React, { useRef } from 'react';
import { Modal, Form } from '@douyinfe/semi-ui';
import { parseLocalTimestamp } from '../../../helpers';

const SearchModal = ({
  searchModalVisible,
  handleSearchConfirm,
  handleCloseModal,
  isMobile,
  isAdminUser,
  inputs,
  datePresets,
  handleInputChange,
  handleDateRangeChange,
  t,
}) => {
  const formRef = useRef();

  const FORM_FIELD_PROPS = {
    className: 'w-full mb-2 !rounded-lg',
  };

  const createFormField = (Component, props) => (
    <Component {...FORM_FIELD_PROPS} {...props} />
  );

  const { start_timestamp, end_timestamp, username } = inputs;

  return (
    <Modal
      title={t('搜索条件')}
      visible={searchModalVisible}
      onOk={handleSearchConfirm}
      onCancel={handleCloseModal}
      closeOnEsc={true}
      size={isMobile ? 'full-width' : 'medium'}
      centered
    >
      <Form ref={formRef} layout='vertical' className='w-full'>
        {createFormField(Form.DatePicker, {
          field: 'date_range',
          label: t('时间范围'),
          type: 'dateTimeRange',
          value: [parseLocalTimestamp(start_timestamp), parseLocalTimestamp(end_timestamp)],
          presets: datePresets,
          presetPosition: 'left',
          onChange: handleDateRangeChange,
        })}

        {isAdminUser &&
          createFormField(Form.Input, {
            field: 'username',
            label: t('用户名称'),
            value: username,
            placeholder: t('可选值'),
            name: 'username',
            onChange: (value) => handleInputChange(value, 'username'),
          })}
      </Form>
    </Modal>
  );
};

export default SearchModal;
