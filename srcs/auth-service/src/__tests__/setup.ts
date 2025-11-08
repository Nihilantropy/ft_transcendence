/**
 * @file Test Setup
 * @description Global test configuration and utilities
 */

import { beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Test database path (in-memory for most tests)
export const TEST_DB_PATH = ':memory:';
export const TEST_DB_FILE_PATH = path.join(__dirname, 'test.db');

// Clean up file-based test database after each test
afterEach(() => {
  if (fs.existsSync(TEST_DB_FILE_PATH)) {
    fs.unlinkSync(TEST_DB_FILE_PATH);
  }
});

// Global test environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key';
process.env['JWT_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['COOKIE_SECRET'] = 'test-cookie-secret';
process.env['LOG_LEVEL'] = 'silent'; // Suppress logs during tests
