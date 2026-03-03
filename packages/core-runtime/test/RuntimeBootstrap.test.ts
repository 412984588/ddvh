import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeBootstrap } from '../src/RuntimeBootstrap.js';

type InternalRuntimeBootstrap = {
  cleanupInterval: ReturnType<typeof setInterval> | null;
  startCleanup: () => void;
};

function createDependencies() {
  return {
    backendClient: {
      dispatchTask: vi.fn().mockResolvedValue({
        taskId: 'task-1',
        success: true,
      }),
      handleWebhookResult: vi.fn(),
      cleanup: vi.fn(),
    },
    omniClient: {
      sendToolResult: vi.fn(),
    },
  } as never;
}

describe('RuntimeBootstrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rolls back cleanup timer when initialize fails after timer allocation', async () => {
    const runtime = new RuntimeBootstrap({});
    const internal = runtime as unknown as InternalRuntimeBootstrap;

    vi.spyOn(internal, 'startCleanup').mockImplementation(() => {
      internal.cleanupInterval = setInterval(() => undefined, 60000);
      throw new Error('cleanup boot failure');
    });

    await expect(runtime.initialize(createDependencies())).rejects.toThrow('cleanup boot failure');
    expect(runtime.getStatus().initialized).toBe(false);
    expect(internal.cleanupInterval).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects processing input for unknown session', async () => {
    const runtime = new RuntimeBootstrap({});
    await runtime.initialize(createDependencies());

    await expect(runtime.processInput('missing-session', 'hello')).rejects.toThrow(
      'Session not found: missing-session'
    );
  });

  it('keeps a single cleanup interval when startCleanup is called repeatedly', () => {
    const runtime = new RuntimeBootstrap({});
    const internal = runtime as unknown as InternalRuntimeBootstrap;

    internal.startCleanup();
    expect(vi.getTimerCount()).toBe(1);

    internal.startCleanup();
    expect(vi.getTimerCount()).toBe(1);
  });
});
