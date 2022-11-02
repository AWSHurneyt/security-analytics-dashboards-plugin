/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import moment from 'moment';
import {
  EuiBasicTableColumn,
  EuiButtonIcon,
  EuiEmptyPrompt,
  EuiInMemoryTable,
  EuiLink,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';
import { FieldValueSelectionFilterConfigType } from '@elastic/eui/src/components/search_bar/filters/field_value_selection_filter';
import dateMath from '@elastic/datemath';
import { renderTime } from '../../../../utils/helpers';
import { DEFAULT_EMPTY_DATA } from '../../../../utils/constants';
import { DetectorsService, OpenSearchService } from '../../../../services';
import FindingDetailsFlyout from '../FindingDetailsFlyout';
import { Finding } from '../../models/interfaces';
import CreateAlertFlyout from '../CreateAlertFlyout';
import { NotificationChannelTypeOptions } from '../../../CreateDetector/components/ConfigureAlerts/models/interfaces';
import { FindingItemType } from '../../containers/Findings/Findings';

interface FindingsTableProps extends RouteComponentProps {
  detectorService: DetectorsService;
  opensearchService: OpenSearchService;
  findings: FindingItemType[];
  notificationChannels: NotificationChannelTypeOptions[];
  refreshNotificationChannels: () => void;
  loading: boolean;
  rules: object;
  startTime: string;
  endTime: string;
  onRefresh: () => void;
  onFindingsFiltered: (findings: FindingItemType[]) => void;
}

interface FindingsTableState {
  findingsFiltered: boolean;
  filteredFindings: Finding[];
  flyout: object;
  flyoutOpen: boolean;
  selectedFinding?: Finding;
}

export default class FindingsTable extends Component<FindingsTableProps, FindingsTableState> {
  constructor(props: FindingsTableProps) {
    super(props);
    this.state = {
      findingsFiltered: false,
      filteredFindings: [],
      flyout: undefined,
      flyoutOpen: false,
      selectedFinding: undefined,
    };
  }

  componentDidMount = async () => {
    await this.filterFindings();
  };

  componentDidUpdate(prevProps: Readonly<FindingsTableProps>) {
    if (
      prevProps.startTime !== this.props.startTime ||
      prevProps.endTime !== this.props.endTime ||
      prevProps.findings.length !== this.props.findings.length
    )
      this.filterFindings();
  }

  filterFindings = () => {
    const { findings, startTime, endTime } = this.props;
    const startMoment = dateMath.parse(startTime);
    const endMoment = dateMath.parse(endTime);
    const filteredFindings = findings.filter((finding) =>
      moment(finding.timestamp).isBetween(moment(startMoment), moment(endMoment))
    );
    this.setState({ findingsFiltered: true, filteredFindings: filteredFindings });
    this.props.onFindingsFiltered(filteredFindings);
  };

  closeFlyout = (refreshPage: boolean = false) => {
    this.setState({ flyout: undefined, flyoutOpen: false, selectedFinding: undefined });
    if (refreshPage) this.props.onRefresh();
  };

  renderFindingDetailsFlyout = (finding: Finding) => {
    if (this.state.flyoutOpen) this.closeFlyout();
    else
      this.setState({
        flyout: (
          <FindingDetailsFlyout
            {...this.props}
            finding={finding}
            closeFlyout={this.closeFlyout}
            allRules={this.props.rules}
          />
        ),
        flyoutOpen: true,
        selectedFinding: finding,
      });
  };

  renderCreateAlertFlyout = (finding: Finding) => {
    if (this.state.flyoutOpen) this.closeFlyout();
    else {
      const ruleOptions = finding.queries.map((query) => {
        const rule = this.props.rules[query.id];
        return {
          name: rule.title,
          id: query.id,
          severity: rule.level,
          tags: rule.tags.map((tag) => tag.value),
        };
      });
      this.setState({
        flyout: (
          <CreateAlertFlyout
            {...this.props}
            finding={finding}
            closeFlyout={this.closeFlyout}
            notificationChannels={this.props.notificationChannels}
            allRules={this.props.rules}
            refreshNotificationChannels={this.props.refreshNotificationChannels}
            rulesOptions={ruleOptions}
          />
        ),
        flyoutOpen: true,
        selectedFinding: finding,
      });
    }
  };

  render() {
    const { findings, loading, rules } = this.props;
    const { findingsFiltered, filteredFindings, flyout, flyoutOpen } = this.state;

    const columns: EuiBasicTableColumn<Finding>[] = [
      {
        field: 'timestamp',
        name: 'Time',
        sortable: true,
        dataType: 'date',
        render: renderTime,
      },
      {
        field: 'id',
        name: 'Finding ID',
        sortable: true,
        dataType: 'string',
        render: (id, finding) =>
          (
            <EuiLink onClick={() => this.renderFindingDetailsFlyout(finding)}>
              {`${(id as string).slice(0, 7)}...`}
            </EuiLink>
          ) || DEFAULT_EMPTY_DATA,
      },
      {
        field: 'queries',
        name: 'Rule name',
        sortable: true,
        dataType: 'string',
        render: (queries) => rules[queries[0].id].title || DEFAULT_EMPTY_DATA,
      },
      {
        field: 'detector._source.name',
        name: 'Threat detector',
        sortable: true,
        dataType: 'string',
        render: (name) => name || DEFAULT_EMPTY_DATA,
      },
      {
        field: 'queries',
        name: 'Log type',
        sortable: true,
        dataType: 'string',
        render: (queries) => rules[queries[0].id].category || DEFAULT_EMPTY_DATA,
      },
      {
        field: 'queries',
        name: 'Rule severity',
        sortable: true,
        dataType: 'string',
        render: (queries) => rules[queries[0].id].level || DEFAULT_EMPTY_DATA,
      },
      {
        name: 'Actions',
        sortable: false,
        actions: [
          {
            render: (finding) => (
              <EuiToolTip content={'View details'}>
                <EuiButtonIcon
                  aria-label={'View details'}
                  iconType={'expand'}
                  onClick={() => this.renderFindingDetailsFlyout(finding)}
                />
              </EuiToolTip>
            ),
          },
          {
            render: (finding) => (
              <EuiToolTip content={'Create alert'}>
                <EuiButtonIcon
                  aria-label={'Create alert'}
                  iconType={'bell'}
                  onClick={() => this.renderCreateAlertFlyout(finding)}
                />
              </EuiToolTip>
            ),
          },
        ],
      },
    ];

    const logTypes = new Set();
    const severities = new Set();
    filteredFindings.forEach((finding) => {
      if (finding) {
        const queryId = finding.queries[0].id;
        logTypes.add(rules[queryId].category);
        severities.add(rules[queryId].level);
      }
    });

    const search = {
      box: {
        incremental: true,
        placeholder: 'Search findings',
      },
      filters: [
        {
          type: 'field_value_selection',
          field: 'severity',
          name: 'Rule severity',
          options: Array.from(severities).map((severity) => ({ value: severity })),
          multiSelect: 'or',
        } as FieldValueSelectionFilterConfigType,
        {
          type: 'field_value_selection',
          field: 'type',
          name: 'Log type',
          options: Array.from(logTypes).map((type) => ({ value: type })),
          multiSelect: 'or',
        } as FieldValueSelectionFilterConfigType,
      ],
    };

    const sorting = {
      sort: {
        field: 'name',
        direction: 'asc',
      },
    };

    return (
      <div>
        <EuiInMemoryTable
          items={findingsFiltered ? filteredFindings : findings}
          columns={columns}
          itemId={(item) => item.id}
          pagination={true}
          search={search}
          sorting={sorting}
          isSelectable={false}
          loading={loading}
          noItemsMessage={
            <EuiEmptyPrompt
              style={{ maxWidth: '45em' }}
              body={
                <EuiText>
                  <p>There are no existing findings.</p>
                </EuiText>
              }
            />
          }
        />
        {flyoutOpen && flyout}
      </div>
    );
  }
}
