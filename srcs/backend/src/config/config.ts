/**
 * @brief Configuration management for the application
 * 
 * @description Loads and validates environment variables
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * @brief Validate and export configuration
 */
export const config = {
  // Server
  PORT: parseInt(process.env.API_PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-here',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '24h',
  BCRYPT_ROUNDS: 10,
  
  // Database
  DB_PATH: process.env.DB_DATABASE || '/data/transcendence.db',
  
  // CORS
  CORS_ORIGIN: process.env.APP_URL || 'https://localhost',
  
  // OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  
  // 2FA
  TWO_FACTOR_SECRET: process.env.TWO_FACTOR_SECRET || '',
  
  // Blockchain
  AVALANCHE_RPC_URL: process.env.AVALANCHE_RPC_URL || '',
  AVALANCHE_PRIVATE_KEY: process.env.AVALANCHE_PRIVATE_KEY || '',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;

/**
 * @brief Validate required configuration
 * 
 * @throws Error if required configuration is missing
 */
export const validateConfig = () => {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};