/**
 * Dynamic endpoint resolution for salon storefront
 */

export async function getGraphQLEndpoint(): Promise<string> {
  // In development, use localhost
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/graphql';
  }

  // In production, use the configured API URL
  return process.env.NEXT_PUBLIC_API_URL || '/api/graphql';
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}
