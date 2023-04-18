/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CorrelationFinding,
  CorrelationGraphData,
  CorrelationGraphEventHandler,
  CorrelationGraphUpdateHandler,
  CorrelationLevelInfo,
  CorrelationRule,
  CorrelationsLevel,
  ICorrelationsStore,
} from '../../types';
import { DETECTOR_TYPES } from '../pages/Detectors/utils/constants';
import { euiPaletteColorBlind } from '@elastic/eui';
import { FilterItem } from '../pages/Correlations/components/FilterGroup';
import 'font-awesome/css/font-awesome.min.css';
import { iconByLogType } from '../pages/Correlations/utils/constants';

class ColorProvider {
  // private palette = euiPaletteColorBlindBehindText({ sortBy: 'natural' });
  private palette = euiPaletteColorBlind({ sortBy: 'natural' });
  private currentPos: number = 0;
  public colorByLogType: { [logType: string]: string } = {};

  constructor() {
    Object.values(DETECTOR_TYPES).forEach((type) => {
      this.colorByLogType[type.id] = this.next();
    });
  }

  public getColor(logType: string) {
    return this.colorByLogType[logType] || this.next();
  }

  private next() {
    this.currentPos = (this.currentPos + 1) % this.palette.length;
    return this.palette[this.currentPos];
  }
}

class DummyCorrelationDataProvider {
  private generatedPairs: Set<string> = new Set();
  private severities: ('Critical' | 'Medium' | 'Info' | 'Low')[] = [
    'Critical',
    'Medium',
    'Info',
    'Low',
  ];

  public generateDummyFindings() {
    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);
    const startTime = threeDaysAgo.getTime();
    const diff = now.getTime() - startTime;

    // const eachLogtypeCount = {};
    const findings: { [id: string]: CorrelationFinding } = {};
    Object.values(DETECTOR_TYPES).forEach((type) => {
      const findingCount = Math.ceil(15 * Math.random());
      for (let i = 1; i <= findingCount; i++) {
        const id = `${type.id}-${i}`;
        // const id = `${type.id.charAt(0)}${type.id.charAt(type.id.length - 1)}-${i}`;
        findings[id] = {
          logType: type.id,
          timestamp: new Date(startTime + Math.floor(Math.random() * diff)).toLocaleString(),
          id,
          correlationScore: Math.round(Math.random() * 100) / 100,
          // name: id,
          detectionRule: {
            name: 'Sample rule',
            severity: this.severities[Math.floor(Math.random() * 4)],
          },
        };
      }
    });

    return findings;
  }

  public generateDummyCorrelations(findings: { [id: string]: { logType: string } }) {
    this.generatedPairs = new Set();
    const findingIds = Object.keys(findings);
    const totalFindings = findingIds.length;
    const correlations: { [finding: string]: string[] } = {};
    let correlationCount = 0;

    while (correlationCount < 150) {
      while (true) {
        const pair = this.getNextPair(totalFindings);

        const f1 = findingIds[pair[0]];
        const f2 = findingIds[pair[1]];

        if (findings[f1].logType === findings[f2].logType) {
          continue;
        }

        if (!correlations[f1]) {
          correlations[f1] = [];
        }

        correlations[f1].push(f2);

        if (!correlations[f2]) {
          correlations[f2] = [];
        }

        correlations[f2].push(f1);

        break;
      }

      correlationCount++;
    }

    return correlations;
  }

  private getNextPair(max: number) {
    let next = this.generatePair(max);
    while (this.generatedPairs.has(next)) {
      next = this.generatePair(max);
    }
    this.generatedPairs.add(next);

    const pairIdx = next.split('-');

    return [Number.parseInt(pairIdx[0]), Number.parseInt(pairIdx[1])];
  }

  private generatePair(max: number) {
    const idx1 = Math.floor(Math.random() * max);
    const idx2 = Math.floor(Math.random() * max);

    const small = idx1 < idx2 ? idx1 : idx2;
    const big = idx1 > idx2 ? idx1 : idx2;
    const pair = `${small}-${big}`;

    return pair;
  }
}

export class CorrelationsStore implements ICorrelationsStore {
  private correlationRules: CorrelationRule[] = [
    {
      id: 's3-dns',
      name: 'Correlate S3 and DNS findings',
      queries: [
        {
          logType: 'dns',
          conditions: [
            { name: 'source.ip', value: '1.2.3.4', condition: 'AND' },
            { name: 'EventID', value: '2100', condition: 'AND' },
          ],
          index: 'dns-logs',
        },
        {
          logType: 's3',
          conditions: [{ name: 'src.ip', value: '1.2.3.4', condition: 'AND' }],
          index: 's3-logs',
        },
      ],
    },
    {
      id: 'nw-windows',
      name: 'Correlate Network and Windows findings',
      queries: [
        {
          logType: 'network',
          conditions: [{ name: 'src.ip', value: '172.10.0.0', condition: 'AND' }],
          index: 'network-logs',
        },
        {
          logType: 'Windows',
          conditions: [{ name: 'host', value: '172.10.0.0', condition: 'AND' }],
          index: 'windows-logs',
        },
      ],
    },
    {
      id: 'nw-ad_ldap',
      name: 'Correlate Network and AD_LDAP findings',
      queries: [
        {
          logType: 'network',
          conditions: [{ name: 'src.ip', value: '172.10.0.0', condition: 'AND' }],
          index: 'network-logs',
        },
        {
          logType: DETECTOR_TYPES.AD_LDAP.id,
          conditions: [{ name: 'account.id', value: '13452', condition: 'AND' }],
          index: 'ad_ldap-logs',
        },
      ],
    },
  ];
  private graphEventHandlers: { [event: string]: CorrelationGraphEventHandler[] } = {};
  public findings;
  private allCorrelations: { [finding: string]: string[] };
  public correlations: { [finding: string]: string[] };

  constructor() {
    const dataProvider = new DummyCorrelationDataProvider();
    this.findings = dataProvider.generateDummyFindings();
    this.allCorrelations = dataProvider.generateDummyCorrelations(this.findings);
    this.correlations = this.allCorrelations;
  }

  public registerGraphEventHandler(event: string, handler: CorrelationGraphEventHandler): void {
    this.graphEventHandlers[event] = this.graphEventHandlers[event] || [];
    this.graphEventHandlers[event].push(handler);
  }

  public createCorrelationRule(correlationRule: CorrelationRule): void {
    correlationRule.queries.forEach((query) => {
      query.conditions = query.conditions.filter((cond) => !!cond.name);
    });
    this.correlationRules.push(correlationRule);
  }

  public getCorrelationRules(): CorrelationRule[] {
    return this.correlationRules;
  }

  public deleteCorrelationRule(ruleId: string): void {}

  public getAllCorrelationsInWindow(timeWindow?: any): { [id: string]: CorrelationFinding[] } {
    return {};
  }

  public getAllFindings(): { [id: string]: CorrelationFinding } {
    return {};
  }

  public getCorrelatedFindings(findingId: string): CorrelationFinding[] {
    return [
      {
        id: 'dummy id',
        logType: 'dns',
        timestamp: 'April 24 2023',
        detectionRule: {
          name: 'Sample rule name',
          severity: 'Critical',
        },
        correlationScore: Math.round(Math.random() * 100) / 100,
      },
    ];
  }
}
