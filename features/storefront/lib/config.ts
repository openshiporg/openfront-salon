/**
 * GraphQL client for salon storefront
 * Uses dynamic endpoint resolution like the dashboard
 */

import { GraphQLClient, RequestDocument, Variables } from 'graphql-request';
import { getServerGraphQLTarget } from './getBaseUrl';

class SalonClient {
  // Built per request: the internal fetch carries the visitor's signed identity and must not be shared.
  private async getClient(): Promise<GraphQLClient> {
    const { endpoint, fetch: internalFetch } = await getServerGraphQLTarget();
    return new GraphQLClient(endpoint, {
      credentials: 'include',
      headers: {
        'Connection': 'keep-alive',
      },
      timeout: 10000,
      ...(internalFetch ? { fetch: internalFetch } : {}),
    });
  }

  async request<T = any, V extends Variables = Variables>(
    document: RequestDocument,
    variables?: V,
    requestHeaders?: HeadersInit
  ): Promise<T> {
    const client = await this.getClient();
    return await client.request(document, variables, requestHeaders);
  }
}

export const salonClient = new SalonClient();
