import { describe, it, expect } from 'vitest';
import { buildTargetUrl, extractHeaders, shouldForwardBody } from '../proxy.utils.js';

describe('proxy.utils', () => {
  describe('buildTargetUrl', () => {
    it('should build target URL by replacing prefix', () => {
      const originalUrl = '/api/auth/login';
      const targetBaseUrl = 'http://auth-service:3001';
      const stripPrefix = '/api/auth';

      const result = buildTargetUrl(originalUrl, targetBaseUrl, stripPrefix);

      expect(result).toBe('http://auth-service:3001/login');
    });

    it('should handle URLs without prefix stripping', () => {
      const originalUrl = '/health';
      const targetBaseUrl = 'http://auth-service:3001';

      const result = buildTargetUrl(originalUrl, targetBaseUrl);

      expect(result).toBe('http://auth-service:3001/health');
    });

    it('should preserve query parameters', () => {
      const originalUrl = '/api/users/search?q=john';
      const targetBaseUrl = 'http://user-service:3002';
      const stripPrefix = '/api';

      const result = buildTargetUrl(originalUrl, targetBaseUrl, stripPrefix);

      expect(result).toBe('http://user-service:3002/users/search?q=john');
    });

    it('should not modify URLs when prefix not at start', () => {
      const originalUrl = '/auth/api/login';
      const targetBaseUrl = 'http://user-service:3002';
      const stripPrefix = '/api';

      const result = buildTargetUrl(originalUrl, targetBaseUrl, stripPrefix);

      expect(result).toBe('http://user-service:3002/auth/api/login');
    });
  });

  describe('extractHeaders', () => {
    it('should extract forwarding headers', () => {
      const requestHeaders = {
        'content-type': 'application/json',
        'cookie': 'accessToken=xyz',
        'user-agent': 'Mozilla/5.0',
        'host': 'localhost:8001'
      };
      const ip = '127.0.0.1';

      const result = extractHeaders(requestHeaders, ip);

      expect(result['content-type']).toBe('application/json');
      expect(result['cookie']).toBe('accessToken=xyz');
      expect(result['x-forwarded-for']).toBe('127.0.0.1');
      expect(result['x-forwarded-proto']).toBe('https');
    });

    it('should include user ID header if provided', () => {
      const requestHeaders = { 'content-type': 'application/json' };
      const ip = '127.0.0.1';
      const userId = 42;

      const result = extractHeaders(requestHeaders, ip, userId);

      expect(result['x-user-id']).toBe('42');
    });

    it('should not include user ID header if not provided', () => {
      const requestHeaders = { 'content-type': 'application/json' };
      const ip = '127.0.0.1';

      const result = extractHeaders(requestHeaders, ip);

      expect(result['x-user-id']).toBeUndefined();
    });
  });

  describe('shouldForwardBody', () => {
    it('should return false for GET requests', () => {
      expect(shouldForwardBody('GET')).toBe(false);
    });

    it('should return false for HEAD requests', () => {
      expect(shouldForwardBody('HEAD')).toBe(false);
    });

    it('should return true for POST requests', () => {
      expect(shouldForwardBody('POST')).toBe(true);
    });

    it('should return true for PUT requests', () => {
      expect(shouldForwardBody('PUT')).toBe(true);
    });

    it('should return true for PATCH requests', () => {
      expect(shouldForwardBody('PATCH')).toBe(true);
    });

    it('should return true for DELETE requests', () => {
      expect(shouldForwardBody('DELETE')).toBe(true);
    });
  });
});
