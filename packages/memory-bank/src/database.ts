/**
 * Database initialization and connection management
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino from 'pino';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname as importDirname } from 'node:path';

const logger = pino({ name: 'MemoryBankDatabase' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = importDirname(__filename);

// Type for better-sqlite3 Database
type BetterSqlite3Database = Database.Database;

export interface DatabaseConfig {
  path: string;
  migrate?: boolean;
  seed?: boolean;
}

/**
 * Database connection manager
 */
export class DatabaseManager {
  private readonly dbPath: string;
  private db: BetterSqlite3Database | null = null;

  constructor(config: DatabaseConfig) {
    this.dbPath = config.path;
    this.ensureDirectoryExists();
  }

  /**
   * Get or create database connection
   */
  getConnection(): BetterSqlite3Database {
    if (!this.db) {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      logger.info({ path: this.dbPath }, 'Database connection established');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Run database migrations
   */
  migrate(): void {
    const db = this.getConnection();
    const schemaPath = `${__dirname}/schema.sql`;

    try {
      const schema = readFileSync(schemaPath, 'utf-8');
      db.exec(schema);
      logger.info('Database migrations completed');
    } catch (error) {
      logger.error({ error }, 'Failed to run migrations');
      throw error;
    }
  }

  /**
   * Seed database with initial data
   */
  async seed(): Promise<void> {
    const { seedDatabase } = await import('./seed.js');
    await seedDatabase(this.getConnection());
    logger.info('Database seeded with initial data');
  }

  /**
   * Ensure database directory exists
   */
  private ensureDirectoryExists(): void {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info({ dir }, 'Created database directory');
    }
  }

  /**
   * Check if database exists and has tables
   */
  isInitialized(): boolean {
    if (!existsSync(this.dbPath)) {
      return false;
    }

    try {
      const db = this.getConnection();
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pitfalls'")
        .get();
      return !!result;
    } catch {
      return false;
    }
  }
}

/**
 * Get singleton database instance
 */
let dbManager: DatabaseManager | null = null;

export function getDatabaseManager(config?: DatabaseConfig): DatabaseManager {
  if (!dbManager) {
    if (!config) {
      throw new Error('Database config required for first initialization');
    }
    dbManager = new DatabaseManager(config);
  }
  return dbManager;
}

export function closeDatabase(): void {
  if (dbManager) {
    dbManager.close();
    dbManager = null;
  }
}
