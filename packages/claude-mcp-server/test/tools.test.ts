import { describe, expect, it } from 'vitest';
import { normalizePackageName } from '../src/tools.js';

describe('normalizePackageName', () => {
  it('accepts simple package names', () => {
    expect(normalizePackageName('backend-dispatcher')).toBe('backend-dispatcher');
    expect(normalizePackageName('provider-volcengine-omni')).toBe('provider-volcengine-omni');
  });

  it('rejects unsafe package names', () => {
    expect(() => normalizePackageName('backend-dispatcher; rm -rf /')).toThrow(
      'Invalid package name'
    );
    expect(() => normalizePackageName('backend dispatcher')).toThrow('Invalid package name');
    expect(() => normalizePackageName('../escape')).toThrow('Invalid package name');
  });
});
