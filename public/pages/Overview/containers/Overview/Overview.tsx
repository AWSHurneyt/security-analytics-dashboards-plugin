/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import './Overview.scss';
import { EuiFlexGrid, EuiFlexGroup, EuiFlexItem, EuiSuperDatePicker } from '@elastic/eui';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ContentPanel } from '../../../../components/ContentPanel';
import { BREADCRUMBS } from '../../../../utils/constants';
import { OverviewProps, OverviewState } from '../../models/interfaces';
import { CoreServicesContext } from '../../../../../public/components/core_services';
import { RecentAlertsWidget } from '../../components/Widgets/RecentAlertsWidget';
import { RecentFindingsWidget } from '../../components/Widgets/RecentFindingsWidget';
import { WidgetContainer } from '../../components/Widgets/WidgetContainer';
import { DetectorsWidget } from '../../components/Widgets/DetectorsWidget';
import { OverviewViewModel, OverviewViewModelActor } from '../../models/OverviewViewModel';
import { ServicesContext } from '../../../../services';
import { Summary } from '../../components/Widgets/Summary';
// import { expressionInterpreter as vegaExpressionInterpreter } from 'vega-interpreter/build/vega-interpreter.module';

export const Overview: React.FC<OverviewProps> = (props) => {
  const [state, setState] = useState<OverviewState>({
    groupBy: 'all_findings',
    overviewViewModel: {
      detectors: [],
      findings: [],
      alerts: [],
    },
  });
  const context = useContext(CoreServicesContext);
  const services = useContext(ServicesContext);

  const updateState = (overviewViewModel: OverviewViewModel) => {
    setState({
      ...state,
      overviewViewModel: { ...overviewViewModel },
    });
  };

  const overviewViewModelActor = useMemo(() => new OverviewViewModelActor(services), [services]);

  useEffect(() => {
    context?.chrome.setBreadcrumbs([BREADCRUMBS.SECURITY_ANALYTICS, BREADCRUMBS.OVERVIEW]);
    overviewViewModelActor.registerRefreshHandler(updateState);
    overviewViewModelActor.onRefresh();
  }, []);

  const onTimeChange = ({ start, end }: { start: string; end: string }) => {};

  const onRefresh = async () => {
    overviewViewModelActor.onRefresh();
  };

  return (
    <ContentPanel
      title={'Overview'}
      actions={[<EuiSuperDatePicker onTimeChange={onTimeChange} onRefresh={onRefresh} />]}
    >
      <EuiFlexGroup direction="column">
        <EuiFlexItem style={{ padding: 20 }}>
          <Summary
            alerts={state.overviewViewModel.alerts}
            findings={state.overviewViewModel.findings}
          />
        </EuiFlexItem>

        <EuiFlexItem>
          <EuiFlexGrid columns={2} gutterSize="m">
            <RecentAlertsWidget items={state.overviewViewModel.alerts} />
            <RecentFindingsWidget items={state.overviewViewModel.findings} />
            <WidgetContainer title="Top rules count from findings">
              <div id="#top_rules_vis" />
            </WidgetContainer>
            <DetectorsWidget detectorHits={state.overviewViewModel.detectors} {...props} />
          </EuiFlexGrid>
        </EuiFlexItem>
      </EuiFlexGroup>
    </ContentPanel>
  );
};
