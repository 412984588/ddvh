import { describe, expect, it, vi } from 'vitest';
import { DiscordBot } from './discord-bot.js';

type InternalDiscordBot = {
  handleVoiceStateUpdate: (oldState: unknown, newState: unknown) => void;
};

function createVoiceState(params: {
  userId: string;
  channelId: string | null;
  guildId?: string;
  isBot?: boolean;
}): unknown {
  return {
    id: params.userId,
    channelId: params.channelId,
    guild: {
      id: params.guildId ?? 'guild-1',
    },
    member: {
      user: {
        bot: params.isBot ?? false,
      },
    },
  };
}

describe('DiscordBot voice state filtering', () => {
  it('ignores voice state updates from bot users', () => {
    const bot = new DiscordBot({ token: 'token', clientId: 'client' });
    const voiceHandler = {
      handleUserJoin: vi.fn(),
      handleUserLeave: vi.fn(),
      disconnectAll: vi.fn(),
    };

    bot.setVoiceHandler(voiceHandler as never);

    const internal = bot as unknown as InternalDiscordBot;

    internal.handleVoiceStateUpdate(
      createVoiceState({ userId: 'bot-user', channelId: null, isBot: true }),
      createVoiceState({ userId: 'bot-user', channelId: 'channel-1', isBot: true })
    );

    internal.handleVoiceStateUpdate(
      createVoiceState({ userId: 'bot-user', channelId: 'channel-1', isBot: true }),
      createVoiceState({ userId: 'bot-user', channelId: null, isBot: true })
    );

    expect(voiceHandler.handleUserJoin).not.toHaveBeenCalled();
    expect(voiceHandler.handleUserLeave).not.toHaveBeenCalled();
  });

  it('handles human user join and leave events', () => {
    const bot = new DiscordBot({ token: 'token', clientId: 'client' });
    const voiceHandler = {
      handleUserJoin: vi.fn(),
      handleUserLeave: vi.fn(),
      disconnectAll: vi.fn(),
    };

    bot.setVoiceHandler(voiceHandler as never);

    const internal = bot as unknown as InternalDiscordBot;

    internal.handleVoiceStateUpdate(
      createVoiceState({ userId: 'user-1', channelId: null }),
      createVoiceState({ userId: 'user-1', channelId: 'channel-1' })
    );

    internal.handleVoiceStateUpdate(
      createVoiceState({ userId: 'user-1', channelId: 'channel-1' }),
      createVoiceState({ userId: 'user-1', channelId: null })
    );

    expect(voiceHandler.handleUserJoin).toHaveBeenCalledWith('user-1', 'guild-1', 'channel-1');
    expect(voiceHandler.handleUserLeave).toHaveBeenCalledWith('user-1');
  });

  it('handles human user channel switch as leave then join', () => {
    const bot = new DiscordBot({ token: 'token', clientId: 'client' });
    const voiceHandler = {
      handleUserJoin: vi.fn(),
      handleUserLeave: vi.fn(),
      disconnectAll: vi.fn(),
    };

    bot.setVoiceHandler(voiceHandler as never);

    const internal = bot as unknown as InternalDiscordBot;

    internal.handleVoiceStateUpdate(
      createVoiceState({ userId: 'user-1', channelId: 'channel-1' }),
      createVoiceState({ userId: 'user-1', channelId: 'channel-2' })
    );

    expect(voiceHandler.handleUserLeave).toHaveBeenCalledWith('user-1');
    expect(voiceHandler.handleUserJoin).toHaveBeenCalledWith('user-1', 'guild-1', 'channel-2');
  });
});
