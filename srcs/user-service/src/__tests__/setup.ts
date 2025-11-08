/**
 * @file Test Setup
 * @description Global test configuration and utilities
 */

import { afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

export const TEST_DB_PATH = ':memory:';
export const TEST_DB_FILE_PATH = path.join(__dirname, 'test.db');

afterEach(() => {
  if (fs.existsSync(TEST_DB_FILE_PATH)) {
    fs.unlinkSync(TEST_DB_FILE_PATH);
  }
});

process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key';
process.env['LOG_LEVEL'] = 'silent';
