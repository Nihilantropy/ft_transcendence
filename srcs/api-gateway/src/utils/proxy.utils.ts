/**
 * @file Proxy Utilities
 * @description Helper functions for request proxying
 */

import type { IncomingHttpHeaders } from 'http';

/**
 * Build target URL by replacing prefix
 */
export function buildTargetUrl(
  originalUrl: string,
  targetBaseUrl: string,
  stripPrefix?: string
): string {
  const targetPath = stripPrefix
    ? originalUrl.replace(stripPrefix, '')
    : originalUrl;

  return targetBaseUrl + targetPath;
}

/**
 * Extract headers for forwarding to target service
 */
export function extractHeaders(
  requestHeaders: IncomingHttpHeaders,
  ip: string,
  userId?: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': (requestHeaders['content-type'] as string) || 'application/json',
    'x-forwarded-for': ip,
    'x-forwarded-proto': 'https'
  };

  // Forward cookies if present
  if (requestHeaders['cookie']) {
    headers['cookie'] = requestHeaders['cookie'] as string;
  }

  // Forward user ID if available
  if (userId !== undefined) {
    headers['x-user-id'] = String(userId);
  }

  return headers;
}

/**
 * Determine if request body should be forwarded
 */
export function shouldForwardBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}
