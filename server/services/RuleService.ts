/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OpenSearchDashboardsRequest,
  OpenSearchDashboardsResponseFactory,
  IOpenSearchDashboardsResponse,
  ResponseError,
  RequestHandlerContext,
  ILegacyCustomClusterClient,
} from 'opensearch-dashboards/server';
import {
  CreateRuleParams,
  CreateRulesResponse,
  GetRulesParams,
  GetRulesResponse,
} from '../models/interfaces';
import { CLIENT_RULE_METHODS } from '../utils/constants';
import { Rule } from '../../models/interfaces';
import { ServerResponse } from '../models/types';

export default class RulesService {
  osDriver: ILegacyCustomClusterClient;

  constructor(osDriver: ILegacyCustomClusterClient) {
    this.osDriver = osDriver;
  }

  /**
   * Calls backend POST Rules API.
   */

  createRule = async (
    _context: RequestHandlerContext,
    request: OpenSearchDashboardsRequest,
    response: OpenSearchDashboardsResponseFactory
  ): Promise<
    IOpenSearchDashboardsResponse<ServerResponse<CreateRulesResponse> | ResponseError>
  > => {
    try {
      const rule = request.body as Rule;
      const params: CreateRuleParams = { body: rule };
      const { callAsCurrentUser: callWithRequest } = this.osDriver.asScoped(request);
      const createRuleResponse: CreateRulesResponse = await callWithRequest(
        CLIENT_RULE_METHODS.CREATE_RULE,
        params
      );

      return response.custom({
        statusCode: 200,
        body: {
          ok: true,
          response: createRuleResponse,
        },
      });
    } catch (error: any) {
      console.error('Security Analytics - RulesService - createRule:', error);
      return response.custom({
        statusCode: 200,
        body: {
          ok: false,
          error: error.message,
        },
      });
    }
  };

  getRules = async (
    _context: RequestHandlerContext,
    request: OpenSearchDashboardsRequest<{}, GetRulesParams>,
    response: OpenSearchDashboardsResponseFactory
  ): Promise<IOpenSearchDashboardsResponse<ServerResponse<GetRulesResponse> | ResponseError>> => {
    try {
      const { prePackaged } = request.query;
      const params: GetRulesParams = {
        prePackaged,
        body: request.body,
      };
      console.log(`Making get rules req: ${params}`);
      const { callAsCurrentUser: callWithRequest } = this.osDriver.asScoped(request);
      const getRuleResponse: GetRulesResponse = await callWithRequest(
        CLIENT_RULE_METHODS.GET_RULES,
        params
      );

      return response.custom({
        statusCode: 200,
        body: {
          ok: true,
          response: getRuleResponse,
        },
      });
    } catch (error: any) {
      console.error('Security Analytics - RulesService - getRules:', error);
      return response.custom({
        statusCode: 200,
        body: {
          ok: false,
          error: error.message,
        },
      });
    }
  };
}