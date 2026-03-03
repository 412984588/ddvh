import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function loadTsconfig(path: string): { compilerOptions?: { emitDeclarationOnly?: boolean } } {
  return JSON.parse(readFileSync(path, 'utf-8')) as {
    compilerOptions?: { emitDeclarationOnly?: boolean };
  };
}

describe('build contract', () => {
  it('does not declaration-only compile packages that expose dist/*.js as main', () => {
    const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
    const tsconfigPaths = [
      'packages/shared-config/tsconfig.json',
      'packages/audio-engine/tsconfig.json',
      'packages/backend-dispatcher/tsconfig.json',
      'packages/claude-mcp-server/tsconfig.json',
      'packages/core-runtime/tsconfig.json',
      'packages/memory-bank/tsconfig.json',
      'packages/openclaw-plugin/tsconfig.json',
      'packages/provider-volcengine-omni/tsconfig.json',
      'apps/bridge-daemon/tsconfig.json',
    ].map((relativePath) => resolve(root, relativePath));

    for (const path of tsconfigPaths) {
      const config = loadTsconfig(path);
      expect(config.compilerOptions?.emitDeclarationOnly).not.toBe(true);
    }
  });

  it('avoids CommonJS require in ESM TypeScript sources', () => {
    const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
    const sourcePaths = [
      'packages/claude-mcp-server/src/tools.ts',
      'packages/claude-mcp-server/src/index.ts',
    ].map((relativePath) => resolve(root, relativePath));

    for (const path of sourcePaths) {
      const source = readFileSync(path, 'utf-8');
      expect(source).not.toMatch(/\brequire\(/);
    }
  });
});
