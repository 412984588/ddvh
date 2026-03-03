#!/usr/bin/env node
/**
 * Smoke test - Verify basic project setup
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const results = [];

function test(name, check) {
  try {
    const result = check();
    if (typeof result === 'boolean') {
      results.push({ name, passed: result, message: result ? 'OK' : 'Failed' });
    } else {
      results.push({ name, ...result });
    }
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Run tests
console.log('Running smoke tests...\n');

test('Root package.json exists', () => existsSync(join(ROOT, 'package.json')));
test('pnpm-workspace.yaml exists', () => existsSync(join(ROOT, 'pnpm-workspace.yaml')));
test('tsconfig.base.json exists', () => existsSync(join(ROOT, 'tsconfig.base.json')));

test('Shared config package exists', () => existsSync(join(ROOT, 'packages/shared-config/package.json')));
test('Audio engine package exists', () => existsSync(join(ROOT, 'packages/audio-engine/package.json')));
test('Provider package exists', () => existsSync(join(ROOT, 'packages/provider-volcengine-omni/package.json')));
test('Memory bank package exists', () => existsSync(join(ROOT, 'packages/memory-bank/package.json')));
test('Backend dispatcher package exists', () => existsSync(join(ROOT, 'packages/backend-dispatcher/package.json')));
test('Core runtime package exists', () => existsSync(join(ROOT, 'packages/core-runtime/package.json')));
test('Bridge daemon app exists', () => existsSync(join(ROOT, 'apps/bridge-daemon/package.json')));

test('.env.example exists', () => existsSync(join(ROOT, '.env.example')));
test('.gitignore exists', () => existsSync(join(ROOT, '.gitignore')));

// Check workspace references
test('Shared config has workspace reference', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/shared-config/package.json'), 'utf-8'));
  return pkg.name.startsWith('@voice-hub/');
});

// Output results
console.log('\nTest Results:');
console.log('─'.repeat(60));

let passed = 0;
let failed = 0;

for (const result of results) {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.passed) passed++;
  else failed++;
}

console.log('─'.repeat(60));
console.log(`\n${passed} passed, ${failed} failed`);

process.exit(failed > 0 ? 1 : 0);
