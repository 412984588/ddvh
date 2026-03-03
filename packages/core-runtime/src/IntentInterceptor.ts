/**
 * IntentInterceptor - Intercepts and routes intents
 *
 * Responsibilities:
 * - Analyze incoming audio/text for intent
 * - Route intents to appropriate handlers
 * - Augment prompts with memory bank context
 */

import pino from 'pino';
import { ToolIntent, type ToolResult } from '@voice-hub/shared-config';
import type { Pitfall, SuccessfulPattern, TaskRun } from '@voice-hub/shared-config';
import { PitfallQueries, PatternQueries, TaskRunQueries } from '@voice-hub/memory-bank';
import { getDatabaseManager } from '@voice-hub/memory-bank';

const logger = pino({ name: 'IntentInterceptor' });

// Memory bank database instance (lazy initialized)
let memoryBankDb: ReturnType<typeof getDatabaseManager> | null = null;

export interface IntentDetectionConfig {
  enableMemoryBank: boolean;
  maxPitfalls: number;
  maxPatterns: number;
  maxHistory: number;
}

export interface InterceptedIntent {
  intent: ToolIntent;
  confidence: number;
  originalInput: string;
  augmentedPrompt?: string;
  context?: {
    pitfalls: Pitfall[];
    patterns: SuccessfulPattern[];
    previousRuns: TaskRun[];
  };
}

export interface IntentHandler {
  (intent: InterceptedIntent, sessionId: string): Promise<ToolResult>;
}

/**
 * Intercepts and processes intents
 */
export class IntentInterceptor {
  private readonly config: IntentDetectionConfig;
  private handlers: Map<ToolIntent, IntentHandler> = new Map();

  constructor(config: IntentDetectionConfig) {
    this.config = config;
    logger.info({ config }, 'IntentInterceptor initialized');
  }

  /**
   * Register handler for intent
   */
  on(intent: ToolIntent, handler: IntentHandler): void {
    this.handlers.set(intent, handler);
    logger.debug({ intent }, 'Intent handler registered');
  }

  /**
   * Intercept and process incoming text
   */
  async intercept(sessionId: string, input: string): Promise<ToolResult | null> {
    logger.debug({ sessionId, input: input.slice(0, 100) }, 'Intercepting input');

    // Detect intent
    const detected = await this.detectIntent(sessionId, input);

    if (!detected) {
      logger.debug('No intent detected');
      return null;
    }

    logger.info(
      {
        sessionId,
        intent: detected.intent,
        confidence: detected.confidence,
      },
      'Intent detected'
    );

    // Get handler
    const handler = this.handlers.get(detected.intent);
    if (!handler) {
      logger.warn({ intent: detected.intent }, 'No handler registered for intent');
      return {
        intent: detected.intent,
        success: false,
        error: `No handler registered for intent: ${detected.intent}`,
      };
    }

    // Execute handler
    try {
      return await handler(detected, sessionId);
    } catch (error) {
      logger.error({ error, intent: detected.intent }, 'Handler execution failed');
      return {
        intent: detected.intent,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Detect intent from input
   */
  private async detectIntent(sessionId: string, input: string): Promise<InterceptedIntent | null> {
    const lowerInput = input.toLowerCase();

    // Check for development-related keywords with scoring
    const devKeywords = [
      'code',
      'function',
      'bug',
      'error',
      'implement',
      'refactor',
      'test',
      'api',
      'database',
      'deploy',
      'build',
      'debug',
      'fix',
      'write',
      'create',
      'update',
      'class',
      'method',
      'variable',
      'loop',
      'array',
      'object',
      'string',
      'number',
    ];

    // Count matching keywords for confidence calculation
    const matchedKeywords = devKeywords.filter((kw) => lowerInput.includes(kw));
    const matchCount = matchedKeywords.length;

    if (matchCount === 0) {
      return null;
    }

    // Calculate confidence based on:
    // - Number of matching keywords
    // - Length of input (more context = higher confidence)
    // - Presence of specific action verbs
    const actionVerbs = ['implement', 'create', 'write', 'fix', 'build', 'deploy', 'test'];
    const hasActionVerb = actionVerbs.some((verb) => lowerInput.includes(verb));

    const keywordScore = Math.min((matchCount / devKeywords.length) * 2, 0.6);
    const lengthScore = Math.min(input.length / 200, 0.2);
    const actionScore = hasActionVerb ? 0.2 : 0;

    const confidence = Math.min(keywordScore + lengthScore + actionScore, 0.95);

    // Map to dispatch intent
    const intent: ToolIntent = ToolIntent.DISPATCH_TASK_TO_BACKEND;

    // Augment with memory bank if enabled
    let augmentedPrompt: string | undefined;
    let context: InterceptedIntent['context'] | undefined;

    if (this.config.enableMemoryBank) {
      const keywords = this.extractKeywords(input);
      context = await this.gatherContext(sessionId, keywords);

      if (context && (context.pitfalls.length > 0 || context.patterns.length > 0)) {
        augmentedPrompt = this.buildAugmentedPrompt(input, context);
      }
    }

    return {
      intent,
      confidence,
      originalInput: input,
      augmentedPrompt,
      context,
    };
  }

  /**
   * Gather context from memory bank
   */
  private async gatherContext(
    sessionId: string,
    keywords: string[]
  ): Promise<InterceptedIntent['context']> {
    try {
      // Initialize memory bank database if not already done
      if (!memoryBankDb) {
        memoryBankDb = getDatabaseManager({
          path: './data/memory-bank.db',
        });
        if (!memoryBankDb.isInitialized()) {
          memoryBankDb.migrate();
        }
      }

      const db = memoryBankDb.getConnection();

      const pitfallQueries = new PitfallQueries(db);
      const patternQueries = new PatternQueries(db);
      const taskRunQueries = new TaskRunQueries(db);

      const [pitfalls, patterns, previousRuns] = await Promise.all([
        Promise.resolve(pitfallQueries.findRelevantPitfalls(keywords, this.config.maxPitfalls)),
        Promise.resolve(patternQueries.findSuccessfulPatterns(keywords, this.config.maxPatterns)),
        Promise.resolve(taskRunQueries.getRecentForSession(sessionId, this.config.maxHistory)),
      ]);

      return {
        pitfalls,
        patterns,
        previousRuns,
      };
    } catch (error) {
      logger.error({ error, sessionId, keywords }, 'Failed to gather context from memory bank');
      // Return empty context on error
      return {
        pitfalls: [],
        patterns: [],
        previousRuns: [],
      };
    }
  }

  /**
   * Build augmented prompt with context
   */
  private buildAugmentedPrompt(
    original: string,
    context: NonNullable<InterceptedIntent['context']>
  ): string {
    const sections: string[] = [original];

    // Add pitfalls
    if (context.pitfalls.length > 0) {
      sections.push('\n## Common Pitfalls to Avoid\n');
      for (const pitfall of context.pitfalls) {
        sections.push(
          `**${pitfall.category}**: ${pitfall.description}\n` + `- Solution: ${pitfall.solution}\n`
        );
      }
    }

    // Add successful patterns
    if (context.patterns.length > 0) {
      sections.push('\n## Successful Approaches\n');
      for (const pattern of context.patterns) {
        sections.push(`**${pattern.category}**: ${pattern.approach}\n`);
      }
    }

    // Add previous runs
    if (context.previousRuns.length > 0) {
      sections.push('\n## Recent Similar Tasks\n');
      for (const run of context.previousRuns) {
        sections.push(`- ${run.intent}: ${run.success ? 'Success' : 'Failed'}\n`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Extract keywords from input
   */
  private extractKeywords(input: string): string[] {
    // Enhanced keyword extraction with basic NLP

    const words = input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Extended stop words list
    const stopWords = new Set([
      // Articles
      'a',
      'an',
      'the',
      // Pronouns
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'my',
      'your',
      'his',
      'her',
      'its',
      'our',
      'their',
      'this',
      'that',
      'these',
      'those',
      // Prepositions
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'from',
      'by',
      'about',
      'against',
      'between',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      // Conjunctions
      'and',
      'but',
      'or',
      'nor',
      'so',
      'yet',
      'both',
      // Auxiliary verbs
      'is',
      'am',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      // Common words
      'not',
      'no',
      'yes',
      'all',
      'any',
      'some',
      'many',
      'few',
      'more',
      'most',
      'such',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'now',
    ]);

    // Filter stop words and deduplicate
    const uniqueWords = new Set(words.filter((w) => !stopWords.has(w)));

    return Array.from(uniqueWords);
  }
}
