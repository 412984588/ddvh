import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@voice-hub/shared-config': path.resolve(__dirname, 'packages/shared-config/src'),
      '@voice-hub/audio-engine': path.resolve(__dirname, 'packages/audio-engine/src'),
      '@voice-hub/provider-volcengine-omni': path.resolve(
        __dirname,
        'packages/provider-volcengine-omni/src'
      ),
      '@voice-hub/backend-dispatcher': path.resolve(__dirname, 'packages/backend-dispatcher/src'),
      '@voice-hub/core-runtime': path.resolve(__dirname, 'packages/core-runtime/src'),
      '@voice-hub/memory-bank': path.resolve(__dirname, 'packages/memory-bank/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/dist/**', '**/node_modules/**'],
    },
  },
});
