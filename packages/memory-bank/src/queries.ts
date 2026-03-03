/**
 * Database queries for memory bank operations
 */

import Database from 'better-sqlite3';
import pino from 'pino';
import type { Pitfall, SuccessfulPattern, TaskRun } from '@voice-hub/shared-config';

// Type for better-sqlite3 Database
type BetterSqlite3Database = Database.Database;
type QueryRow = Record<string, unknown>;

const logger = pino({ name: 'MemoryBankQueries' });

function toRow(value: unknown): QueryRow {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return value as QueryRow;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseStringArray(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Query operations for pitfalls
 */
export class PitfallQueries {
  constructor(private readonly db: BetterSqlite3Database) {}

  /**
   * Find relevant pitfalls based on keywords
   */
  findRelevantPitfalls(keywords: string[], limit = 5): Pitfall[] {
    if (keywords.length === 0) {
      return [];
    }

    const placeholders = keywords.map(() => '?').join(',');
    const query = `
      SELECT DISTINCT p.*
      FROM pitfalls p
      LEFT JOIN pitfall_keyword_index ki ON p.id = ki.pitfall_id
      WHERE ki.keyword IN (${placeholders})
      ORDER BY p.occurrence_count DESC, p.severity DESC
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(...keywords, limit) as unknown[];
      return rows.map((row) => this.rowToPitfall(toRow(row)));
    } catch (error) {
      logger.error({ error }, 'Failed to query pitfalls');
      return [];
    }
  }

  /**
   * Find pitfalls by category
   */
  findByCategory(category: string, limit = 10): Pitfall[] {
    const query = `
      SELECT * FROM pitfalls
      WHERE category = ?
      ORDER BY occurrence_count DESC
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(category, limit) as unknown[];
      return rows.map((row) => this.rowToPitfall(toRow(row)));
    } catch (error) {
      logger.error({ error, category }, 'Failed to query pitfalls by category');
      return [];
    }
  }

  /**
   * Insert new pitfall
   */
  insert(pitfall: Pitfall): void {
    const query = `
      INSERT INTO pitfalls (id, category, description, symptoms, solution, keywords, severity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      this.db
        .prepare(query)
        .run(
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
      this.insertKeywordIndex(pitfall.id, pitfall.keywords, 'pitfall');

      logger.debug({ id: pitfall.id }, 'Inserted pitfall');
    } catch (error) {
      logger.error({ error }, 'Failed to insert pitfall');
    }
  }

  /**
   * Increment occurrence count for pitfall
   */
  incrementOccurrence(id: string): void {
    const query = `
      UPDATE pitfalls
      SET occurrence_count = occurrence_count + 1, updated_at = ?
      WHERE id = ?
    `;

    try {
      this.db.prepare(query).run(Date.now(), id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to increment pitfall occurrence');
    }
  }

  /**
   * Insert keyword index entries for a pitfall
   */
  private insertKeywordIndex(id: string, keywords: string[], type: 'pitfall' | 'pattern'): void {
    const tableName = type === 'pitfall' ? 'pitfall_keyword_index' : 'pattern_keyword_index';
    const idColumn = type === 'pitfall' ? 'pitfall_id' : 'pattern_id';

    const query = `
      INSERT INTO ${tableName} (${idColumn}, keyword)
      VALUES (?, ?)
    `;

    const stmt = this.db.prepare(query);
    const insertMany = this.db.transaction((keywords: string[]) => {
      for (const keyword of keywords) {
        stmt.run(id, keyword);
      }
    });

    try {
      insertMany(keywords);
    } catch (error) {
      logger.error({ error, id, type }, 'Failed to insert keyword index');
    }
  }

  private rowToPitfall(row: QueryRow): Pitfall {
    return {
      id: asString(row.id),
      category: asString(row.category),
      description: asString(row.description),
      symptoms: parseStringArray(row.symptoms),
      solution: asString(row.solution),
      keywords: parseStringArray(row.keywords),
      severity: asString(row.severity, 'low') as Pitfall['severity'],
      createdAt: asNumber(row.created_at),
    };
  }
}

/**
 * Query operations for successful patterns
 */
export class PatternQueries {
  constructor(private readonly db: BetterSqlite3Database) {}

  /**
   * Find successful patterns based on keywords
   */
  findSuccessfulPatterns(keywords: string[], limit = 5): SuccessfulPattern[] {
    if (keywords.length === 0) {
      return [];
    }

    const placeholders = keywords.map(() => '?').join(',');
    const query = `
      SELECT DISTINCT p.*
      FROM successful_patterns p
      LEFT JOIN pattern_keyword_index ki ON p.id = ki.pattern_id
      WHERE ki.keyword IN (${placeholders})
      ORDER BY p.effectiveness DESC, p.use_count DESC
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(...keywords, limit) as unknown[];
      return rows.map((row) => this.rowToPattern(toRow(row)));
    } catch (error) {
      logger.error({ error }, 'Failed to query patterns');
      return [];
    }
  }

  /**
   * Find patterns by category
   */
  findByCategory(category: string, limit = 10): SuccessfulPattern[] {
    const query = `
      SELECT * FROM successful_patterns
      WHERE category = ?
      ORDER BY effectiveness DESC
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(category, limit) as unknown[];
      return rows.map((row) => this.rowToPattern(toRow(row)));
    } catch (error) {
      logger.error({ error, category }, 'Failed to query patterns by category');
      return [];
    }
  }

  /**
   * Insert new pattern
   */
  insert(pattern: SuccessfulPattern): void {
    const query = `
      INSERT INTO successful_patterns (id, category, description, approach, keywords, effectiveness, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      this.db
        .prepare(query)
        .run(
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
      this.insertKeywordIndex(pattern.id, pattern.keywords, 'pattern');

      logger.debug({ id: pattern.id }, 'Inserted pattern');
    } catch (error) {
      logger.error({ error }, 'Failed to insert pattern');
    }
  }

  /**
   * Update pattern effectiveness
   */
  updateEffectiveness(id: string, newEffectiveness: number): void {
    const query = `
      UPDATE successful_patterns
      SET effectiveness = ?, use_count = use_count + 1, updated_at = ?
      WHERE id = ?
    `;

    try {
      this.db.prepare(query).run(newEffectiveness, Date.now(), id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to update pattern effectiveness');
    }
  }

  /**
   * Insert keyword index entries for a pattern
   */
  private insertKeywordIndex(id: string, keywords: string[], type: 'pitfall' | 'pattern'): void {
    const tableName = type === 'pitfall' ? 'pitfall_keyword_index' : 'pattern_keyword_index';
    const idColumn = type === 'pitfall' ? 'pitfall_id' : 'pattern_id';

    const query = `
      INSERT INTO ${tableName} (${idColumn}, keyword)
      VALUES (?, ?)
    `;

    const stmt = this.db.prepare(query);
    const insertMany = this.db.transaction((keywords: string[]) => {
      for (const keyword of keywords) {
        stmt.run(id, keyword);
      }
    });

    try {
      insertMany(keywords);
    } catch (error) {
      logger.error({ error, id, type }, 'Failed to insert keyword index');
    }
  }

  private rowToPattern(row: QueryRow): SuccessfulPattern {
    return {
      id: asString(row.id),
      category: asString(row.category),
      description: asString(row.description),
      approach: asString(row.approach),
      keywords: parseStringArray(row.keywords),
      effectiveness: asNumber(row.effectiveness),
      createdAt: asNumber(row.created_at),
    };
  }
}

/**
 * Query operations for task runs
 */
export class TaskRunQueries {
  constructor(private readonly db: BetterSqlite3Database) {}

  /**
   * Insert new task run
   */
  insert(task: TaskRun): void {
    const query = `
      INSERT INTO task_runs (id, session_id, intent, prompt, result, error, duration, success, created_at, pitfall_ids, pattern_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      this.db
        .prepare(query)
        .run(
          task.id,
          task.sessionId,
          task.intent,
          task.prompt,
          task.result ?? null,
          task.error ?? null,
          task.duration,
          task.success ? 1 : 0,
          task.createdAt,
          task.result ? JSON.stringify([]) : null,
          task.result ? JSON.stringify([]) : null
        );

      logger.debug({ id: task.id }, 'Inserted task run');
    } catch (error) {
      logger.error({ error }, 'Failed to insert task run');
    }
  }

  /**
   * Get recent task runs for session
   */
  getRecentForSession(sessionId: string, limit = 10): TaskRun[] {
    const query = `
      SELECT * FROM task_runs
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(query).all(sessionId, limit) as unknown[];
      return rows.map((row) => this.rowToTaskRun(toRow(row)));
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to query recent tasks');
      return [];
    }
  }

  /**
   * Get task statistics
   */
  getStats(): { total: number; successful: number; failed: number; avgDuration: number } {
    const query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        AVG(duration) as avg_duration
      FROM task_runs
    `;

    try {
      const row = toRow(this.db.prepare(query).get());
      return {
        total: asNumber(row.total),
        successful: asNumber(row.successful),
        failed: asNumber(row.failed),
        avgDuration: asNumber(row.avg_duration),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get task stats');
      return { total: 0, successful: 0, failed: 0, avgDuration: 0 };
    }
  }

  private rowToTaskRun(row: QueryRow): TaskRun {
    return {
      id: asString(row.id),
      sessionId: asString(row.session_id),
      intent: asString(row.intent),
      prompt: asString(row.prompt),
      result: typeof row.result === 'string' ? row.result : undefined,
      error: typeof row.error === 'string' ? row.error : undefined,
      duration: asNumber(row.duration),
      success: asNumber(row.success) === 1,
      createdAt: asNumber(row.created_at),
    };
  }
}

/**
 * Build augmented prompt with context
 */
export function buildAugmentedPrompt(
  basePrompt: string,
  pitfalls: Pitfall[],
  patterns: SuccessfulPattern[],
  previousRuns: TaskRun[]
): string {
  const sections: string[] = [basePrompt];

  // Add pitfalls section
  if (pitfalls.length > 0) {
    sections.push('\n## Common Pitfalls to Avoid\n');
    for (const pitfall of pitfalls) {
      sections.push(
        `**${pitfall.category}**: ${pitfall.description}\n` +
          `- Symptoms: ${pitfall.symptoms.join(', ')}\n` +
          `- Solution: ${pitfall.solution}\n`
      );
    }
  }

  // Add patterns section
  if (patterns.length > 0) {
    sections.push('\n## Successful Approaches\n');
    for (const pattern of patterns) {
      sections.push(
        `**${pattern.category}**: ${pattern.description}\n` + `- Approach: ${pattern.approach}\n`
      );
    }
  }

  // Add previous runs section
  if (previousRuns.length > 0) {
    sections.push('\n## Recent Similar Tasks\n');
    for (const run of previousRuns.slice(0, 3)) {
      sections.push(
        `- ${run.intent}: ${run.success ? 'Success' : 'Failed'}\n` +
          `  ${run.error ? `Error: ${run.error}` : `Result: ${run.result?.slice(0, 100)}...`}\n`
      );
    }
  }

  return sections.join('\n');
}
