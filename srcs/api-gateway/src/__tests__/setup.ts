/**
 * @file Test Setup
 * @description Global test configuration and utilities
 */

// Global test environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-key';
process.env['LOG_LEVEL'] = 'silent'; // Suppress logs during tests
process.env['CORS_ORIGIN'] = 'http://localhost:3000';
process.env['AUTH_SERVICE_URL'] = 'http://localhost:9001';
process.env['USER_SERVICE_URL'] = 'http://localhost:9002';
process.env['GAME_SERVICE_URL'] = 'http://localhost:9003';
process.env['PORT'] = '9000';
process.env['HOST'] = '127.0.0.1';
