import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type { Pitfall, SuccessfulPattern, TaskRun } from '@voice-hub/shared-config';
import { PitfallQueries, PatternQueries, buildAugmentedPrompt } from '../src/queries.js';

describe('PitfallQueries', () => {
  it('returns empty list without querying database when keywords are empty', () => {
    const prepare = vi.fn();
    const db = { prepare } as unknown as Database.Database;

    const queries = new PitfallQueries(db);
    const result = queries.findRelevantPitfalls([]);

    expect(result).toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('PatternQueries', () => {
  it('returns empty list without querying database when keywords are empty', () => {
    const prepare = vi.fn();
    const db = { prepare } as unknown as Database.Database;

    const queries = new PatternQueries(db);
    const result = queries.findSuccessfulPatterns([]);

    expect(result).toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('buildAugmentedPrompt', () => {
  it('includes pitfalls, patterns, and recent run summaries when provided', () => {
    const pitfalls: Pitfall[] = [
      {
        id: 'pitfall-1',
        category: 'errors',
        description: 'Unhandled exception',
        symptoms: ['crash'],
        solution: 'Add try/catch',
        keywords: ['error'],
        severity: 'high',
        createdAt: Date.now(),
      },
    ];
    const patterns: SuccessfulPattern[] = [
      {
        id: 'pattern-1',
        category: 'testing',
        description: 'Add unit tests',
        approach: 'Write tests before refactoring',
        keywords: ['test'],
        effectiveness: 0.9,
        createdAt: Date.now(),
      },
    ];
    const previousRuns: TaskRun[] = [
      {
        id: 'run-1',
        sessionId: 'session-1',
        intent: 'fix-bug',
        prompt: 'fix issue',
        result: 'done',
        duration: 1200,
        success: true,
        createdAt: Date.now(),
      },
    ];

    const prompt = buildAugmentedPrompt('Base prompt', pitfalls, patterns, previousRuns);

    expect(prompt).toContain('Base prompt');
    expect(prompt).toContain('## Common Pitfalls to Avoid');
    expect(prompt).toContain('## Successful Approaches');
    expect(prompt).toContain('## Recent Similar Tasks');
  });
});
