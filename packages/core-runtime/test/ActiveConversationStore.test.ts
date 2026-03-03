import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveConversationStore } from '../src/ActiveConversationStore.js';

describe('ActiveConversationStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty messages when limit is zero', () => {
    const store = new ActiveConversationStore();
    store.addMessage('session-1', 'user', 'hello');

    expect(store.getMessages('session-1', 0)).toEqual([]);
  });

  it('returns empty messages when limit is negative', () => {
    const store = new ActiveConversationStore();
    store.addMessage('session-1', 'user', 'hello');
    store.addMessage('session-1', 'assistant', 'world');

    expect(store.getMessages('session-1', -1)).toEqual([]);
  });

  it('refreshes lastActivity when adding a pending task', () => {
    const store = new ActiveConversationStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const conversation = store.getConversation('session-1');
    const before = conversation.lastActivity;

    vi.setSystemTime(new Date('2026-01-01T00:05:00.000Z'));
    store.addPendingTask('session-1', 'task-1', 'intent', 'prompt');

    expect(store.getConversation('session-1').lastActivity).toBeGreaterThan(before);
  });
});
