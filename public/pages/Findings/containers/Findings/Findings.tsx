/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import moment from 'moment';
import { ContentPanel } from '../../../../components/ContentPanel';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiSuperDatePicker,
  EuiTitle,
} from '@elastic/eui';
import FindingsTable from '../../components/FindingsTable';
import FindingsService from '../../../../services/FindingsService';
import {
  DetectorsService,
  NotificationsService,
  OpenSearchService,
  RuleService,
} from '../../../../services';
import { BREADCRUMBS, DATE_MATH_FORMAT } from '../../../../utils/constants';
import { getFindingsVisualizationSpec } from '../../../Overview/utils/helpers';
import { CoreServicesContext } from '../../../../components/core_services';
import { Finding } from '../../models/interfaces';
import { Detector } from '../../../../../models/interfaces';
import { FeatureChannelList } from '../../../../../server/models/interfaces/Notifications';
import {
  getNotificationChannels,
  parseNotificationChannelsToOptions,
} from '../../../CreateDetector/components/ConfigureAlerts/utils/helpers';
import { createSelectComponent, renderVisualization } from '../../../../utils/helpers';

interface FindingsProps extends RouteComponentProps {
  detectorService: DetectorsService;
  findingsService: FindingsService;
  notificationsService: NotificationsService;
  opensearchService: OpenSearchService;
  ruleService: RuleService;
}

interface FindingsState {
  loading: boolean;
  detectors: Detector[];
  findings: Finding[];
  notificationChannels: FeatureChannelList[];
  rules: object;
  startTime: string;
  endTime: string;
  groupBy: string;
}

interface FindingVisualizationData {
  time: number;
  finding: number;
  logType?: string;
  ruleSeverity?: string;
}

export const groupByOptions = [
  { text: 'Log type', value: 'log_type' },
  { text: 'Rule severity', value: 'rule_severity' },
];

export default class Findings extends Component<FindingsProps, FindingsState> {
  static contextType = CoreServicesContext;

  constructor(props: FindingsProps) {
    super(props);
    const now = moment.now();
    const startTime = moment(now).subtract(15, 'hours').format(DATE_MATH_FORMAT);
    this.state = {
      loading: false,
      detectors: [],
      findings: [],
      notificationChannels: [],
      rules: {},
      startTime: startTime,
      endTime: moment(now).format(DATE_MATH_FORMAT),
      groupBy: 'log_type',
    };
  }

  componentDidMount = async () => {
    this.context.chrome.setBreadcrumbs([BREADCRUMBS.SECURITY_ANALYTICS, BREADCRUMBS.FINDINGS]);
    this.onRefresh();
  };

  onRefresh = async () => {
    this.getFindings();
    this.getNotificationChannels();
    renderVisualization(this.generateVisualizationSpec(), 'findings-view');
  };

  getFindings = async () => {
    this.setState({ loading: true });

    try {
      const { findingsService, detectorService } = this.props;

      const detectorsRes = await detectorService.getDetectors();
      if (detectorsRes.ok) {
        const detectors = detectorsRes.response.hits.hits;
        const ruleIds = new Set<string>();
        let findings: Finding[] = [];

        for (let detector of detectors) {
          const findingRes = await findingsService.getFindings({ detectorId: detector._id });

          if (findingRes.ok) {
            const detectorFindings = findingRes.response.findings.map((finding) => {
              finding.queries.forEach((rule) => ruleIds.add(rule.id));
              return { ...finding, detector: detector };
            });
            findings = findings.concat(detectorFindings);
          }
        }

        await this.getRules(Array.from(ruleIds));

        this.setState({ findings, detectors: detectors.map((detector) => detector._source) });
      } else {
        console.error('Failed to retrieve findings:', detectorsRes.error);
        // TODO: Display toast with error details
      }
    } catch (e) {
      console.error('Failed to retrieve findings:', e);
      // TODO: Display toast with error details
    }
    this.setState({ loading: false });
  };

  getRules = async (ruleIds: string[]) => {
    try {
      const { ruleService } = this.props;
      const body = {
        from: 0,
        size: 5000,
        query: {
          nested: {
            path: 'rule',
            query: {
              terms: {
                _id: ruleIds,
              },
            },
          },
        },
      };

      const prePackagedResponse = await ruleService.getRules(true, body);
      const customResponse = await ruleService.getRules(false, body);

      const allRules: { [id: string]: any } = {};
      if (prePackagedResponse.ok) {
        prePackagedResponse.response.hits.hits.forEach((hit) => (allRules[hit._id] = hit._source));
      } else {
        console.error('Failed to retrieve pre-packaged rules:', prePackagedResponse.error);
      }
      if (customResponse.ok) {
        customResponse.response.hits.hits.forEach((hit) => (allRules[hit._id] = hit._source));
      } else {
        console.error('Failed to retrieve custom rules:', customResponse.error);
        // TODO: Display toast with error details
      }
      this.setState({ rules: allRules });
    } catch (e) {
      console.error('Failed to retrieve rules:', e);
      // TODO: Display toast with error details
    }
  };

  getNotificationChannels = async () => {
    const channels = await getNotificationChannels(this.props.notificationsService);
    this.setState({ notificationChannels: channels });
  };

  onTimeChange = ({ start, end }: { start: string; end: string }) => {
    this.setState({ startTime: start, endTime: end });
  };

  generateVisualizationSpec() {
    return getFindingsVisualizationSpec([], '');
  }

  createGroupByControl(): React.ReactNode {
    return createSelectComponent(
      groupByOptions,
      this.state.groupBy,
      'alert-vis-groupBy',
      (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.setState({ groupBy: event.target.value });
      }
    );
  }

  render() {
    const { findings, loading, notificationChannels, rules, startTime, endTime } = this.state;

    return (
      <EuiFlexGroup direction="column">
        <EuiFlexItem>
          <EuiFlexGroup gutterSize={'s'} justifyContent={'spaceBetween'}>
            <EuiFlexItem>
              <EuiTitle size="l">
                <h1>Findings</h1>
              </EuiTitle>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiSuperDatePicker onTimeChange={this.onTimeChange} onRefresh={this.onRefresh} />
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size={'m'} />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiFlexGroup direction="column">
              <EuiFlexItem style={{ alignSelf: 'flex-end' }}>
                {this.createGroupByControl()}
              </EuiFlexItem>
              <EuiFlexItem>
                <div id="findings-view" style={{ width: '100%' }}></div>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPanel>

          <EuiSpacer size={'xxl'} />
        </EuiFlexItem>

        <EuiFlexItem>
          <ContentPanel title={'Findings'}>
            <FindingsTable
              {...this.props}
              findings={findings}
              loading={loading}
              rules={rules}
              startTime={startTime}
              endTime={endTime}
              onRefresh={this.onRefresh}
              notificationChannels={parseNotificationChannelsToOptions(notificationChannels)}
              refreshNotificationChannels={this.getNotificationChannels}
            />
          </ContentPanel>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }
}
