/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ContentPanel } from '../../../../../../components/ContentPanel';
import { useHistory } from 'react-router-dom';
import Edit from '../Edit';
import { EuiIcon } from '@elastic/eui';

export const Create = () => {
  const history = useHistory();
  return (
    <ContentPanel
      title={'Create a rule'}
      actions={[
        <EuiIcon
          onClick={() => {
            history.push('/rules');
          }}
          type="cross"
        />,
      ]}
    >
      <Edit type={'new'} />
    </ContentPanel>
  );
};
