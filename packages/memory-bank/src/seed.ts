/**
 * Seed data for memory bank
 */

import Database from 'better-sqlite3';
import pino from 'pino';
import type { Pitfall, SuccessfulPattern } from '@voice-hub/shared-config';

// Type for better-sqlite3 Database
type BetterSqlite3Database = Database.Database;

const logger = pino({ name: 'MemoryBankSeed' });

const pitfallSeedData: Pitfall[] = [
  {
    id: 'pitfall_001',
    category: 'async-concurrency',
    description: 'Mixing async/await with forEach does not wait for promises',
    symptoms: ['Race conditions', 'Incomplete execution', 'Unhandled promises'],
    solution: 'Use Promise.all() or for...of loop instead of forEach with async callbacks',
    keywords: ['async', 'await', 'foreach', 'promise', 'concurrency', 'race'],
    severity: 'high',
    createdAt: Date.now(),
  },
  {
    id: 'pitfall_002',
    category: 'typescript-types',
    description: 'Using `any` type loses type safety',
    symptoms: ['Runtime errors', 'No autocomplete', 'Type mismatches'],
    solution: 'Use specific types or `unknown` with type guards',
    keywords: ['typescript', 'any', 'type', 'safety', 'typing'],
    severity: 'medium',
    createdAt: Date.now(),
  },
  {
    id: 'pitfall_003',
    category: 'memory-leaks',
    description: 'Event listeners not removed cause memory leaks',
    symptoms: ['Memory usage increases', 'Performance degrades', 'Browser crashes'],
    solution: 'Always remove event listeners or use AbortController',
    keywords: ['memory', 'leak', 'event', 'listener', 'cleanup', 'removeEventListener'],
    severity: 'high',
    createdAt: Date.now(),
  },
  {
    id: 'pitfall_004',
    category: 'websocket',
    description: 'Assuming WebSocket is always open',
    symptoms: ['Errors when sending', 'Connection lost', 'Messages not delivered'],
    solution: 'Check readyState before sending and handle reconnection',
    keywords: ['websocket', 'connection', 'send', 'readyState', 'reconnect'],
    severity: 'medium',
    createdAt: Date.now(),
  },
  {
    id: 'pitfall_005',
    category: 'error-handling',
    description: 'Silent errors in try-catch without logging',
    symptoms: ['Debugging difficulty', 'Hidden failures', 'Poor observability'],
    solution: 'Always log errors with context for debugging',
    keywords: ['error', 'try', 'catch', 'logging', 'debug', 'silent'],
    severity: 'medium',
    createdAt: Date.now(),
  },
];

const patternSeedData: SuccessfulPattern[] = [
  {
    id: 'pattern_001',
    category: 'async-patterns',
    description: 'Parallel execution with Promise.all for independent operations',
    approach: 'Use Promise.all() when operations are independent and order does not matter',
    keywords: ['promise.all', 'parallel', 'async', 'concurrency', 'performance'],
    effectiveness: 0.9,
    createdAt: Date.now(),
  },
  {
    id: 'pattern_002',
    category: 'error-handling',
    description: 'Result type pattern instead of throwing exceptions',
    approach: 'Return { success, data, error } objects instead of throwing for expected failures',
    keywords: ['result', 'type', 'error', 'handling', 'pattern', 'functional'],
    effectiveness: 0.85,
    createdAt: Date.now(),
  },
  {
    id: 'pattern_003',
    category: 'state-management',
    description: 'Immutable state updates prevent bugs',
    approach: 'Always create new objects/arrays instead of mutating existing ones',
    keywords: ['immutable', 'state', 'redux', 'functional', 'spread'],
    effectiveness: 0.88,
    createdAt: Date.now(),
  },
  {
    id: 'pattern_004',
    category: 'testing',
    description: 'Arrange-Act-Assert pattern for clear tests',
    approach: 'Structure tests with setup, execution, and assertion sections',
    keywords: ['test', 'aaa', 'arrange', 'act', 'assert', 'pattern'],
    effectiveness: 0.8,
    createdAt: Date.now(),
  },
  {
    id: 'pattern_005',
    category: 'api-design',
    description: 'Consistent error response format',
    approach: 'Return errors with { code, message, details } structure for all API endpoints',
    keywords: ['api', 'error', 'response', 'format', 'rest', 'consistent'],
    effectiveness: 0.87,
    createdAt: Date.now(),
  },
];

/**
 * Seed database with initial data
 */
export function seedDatabase(db: BetterSqlite3Database): void {
  // Seed pitfalls
  for (const pitfall of pitfallSeedData) {
    try {
      const query = `
        INSERT OR REPLACE INTO pitfalls (id, category, description, symptoms, solution, keywords, severity, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.prepare(query).run(
        pitfall.id,
        pitfall.category,
        pitfall.description,
        JSON.stringify(pitfall.symptoms),
        pitfall.solution,
        JSON.stringify(pitfall.keywords),
        pitfall.severity,
        pitfall.createdAt,
        pitfall.createdAt
      );

      // Insert keyword index
      for (const keyword of pitfall.keywords) {
        const keywordQuery = `
          INSERT OR IGNORE INTO pitfall_keyword_index (pitfall_id, keyword)
          VALUES (?, ?)
        `;
        db.prepare(keywordQuery).run(pitfall.id, keyword);
      }

      logger.info({ pitfallId: pitfall.id }, 'Seeded pitfall');
    } catch (error) {
      logger.error({ error, pitfallId: pitfall.id }, 'Failed to seed pitfall');
    }
  }

  // Seed patterns
  for (const pattern of patternSeedData) {
    try {
      const query = `
        INSERT OR REPLACE INTO successful_patterns (id, category, description, approach, keywords, effectiveness, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.prepare(query).run(
        pattern.id,
        pattern.category,
        pattern.description,
        pattern.approach,
        JSON.stringify(pattern.keywords),
        pattern.effectiveness,
        pattern.createdAt,
        pattern.createdAt
      );

      // Insert keyword index
      for (const keyword of pattern.keywords) {
        const keywordQuery = `
          INSERT OR IGNORE INTO pattern_keyword_index (pattern_id, keyword)
          VALUES (?, ?)
        `;
        db.prepare(keywordQuery).run(pattern.id, keyword);
      }

      logger.info({ patternId: pattern.id }, 'Seeded pattern');
    } catch (error) {
      logger.error({ error, patternId: pattern.id }, 'Failed to seed pattern');
    }
  }

  logger.info('Database seeding completed');
}
