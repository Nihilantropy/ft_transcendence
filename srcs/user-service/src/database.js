/**
 * @file Database connection for User Service
 * @description SQLite database connection using better-sqlite3
 */

import Database from 'better-sqlite3'
import { logger } from './logger.js'

const dbLogger = logger.child({ module: 'database' })

// Database file path from environment
const DATABASE_PATH = process.env.DATABASE_PATH || '/app/db-data/transcendence.db'

dbLogger.info(`📂 Connecting to database: ${DATABASE_PATH}`)

let db

try {
  // Open database connection
  db = new Database(DATABASE_PATH, {
    verbose: process.env.NODE_ENV === 'development' ? dbLogger.debug.bind(dbLogger) : null
  })

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Set WAL mode for better concurrency
  db.pragma('journal_mode = WAL')

  // Optimize for performance
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = 10000')
  db.pragma('temp_store = MEMORY')

  dbLogger.info('✅ Database connected successfully')

  // Test query (wait for tables to exist)
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get()
    dbLogger.info(`📊 Database has ${result.count} users`)
  } catch (queryError) {
    dbLogger.warn(`⚠️  Database query failed (tables may not exist yet): ${queryError.message}`)
  }

} catch (error) {
  dbLogger.error('❌ Failed to connect to database:', error.message)
  process.exit(1)
}

// Graceful shutdown
process.on('exit', () => {
  if (db) {
    db.close()
    dbLogger.info('Database connection closed')
  }
})

process.on('SIGINT', () => {
  if (db) {
    db.close()
    dbLogger.info('Database connection closed (SIGINT)')
    process.exit(0)
  }
})

export default db
