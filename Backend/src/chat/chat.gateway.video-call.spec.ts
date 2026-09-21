import { WsException } from '@nestjs/websockets';
import { ChatGateway } from './chat.gateway';

/**
 * The `video:call-user` handler itself, with the database and socket server
 * stubbed out — the rule is in video-call-rules.ts; this checks the gateway
 * applies it, reads the caller's role from the database, and rings the right
 * person.
 */
describe('ChatGateway video:call-user', () => {
  const chat = { userId: 'buyer-1', sellerId: 'seller-1' };

  function setup(roles: Record<string, string>) {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const db = {
      chat: { findUnique: jest.fn().mockResolvedValue(chat) },
      user: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(roles[where.id] ? { role: roles[where.id] } : null),
        ),
      },
    };
    const gateway = new ChatGateway({} as any, {} as any, {} as any, db as any, {} as any);
    // The person being rung is online in their own room.
    gateway.io = {
      to,
      sockets: { adapter: { rooms: new Map([['user:buyer-1', new Set(['s1'])], ['user:seller-1', new Set(['s2'])]]) } },
    } as any;
    return { gateway, db, to, emit };
  }

  const client = (userId: string) => ({ userId, emit: jest.fn() }) as any;
  const call = (from: string, to: string) => ({ from, to, channelName: 'chat-c1', chatId: 'c1' });

  it('rings the buyer when an admin calls from All Chats', async () => {
    const { gateway, to, emit } = setup({ 'admin-1': 'ADMIN' });
    await gateway.handleCallUserForVideoCall(call('admin-1', 'buyer-1'), client('admin-1'));
    expect(to).toHaveBeenCalledWith('user:buyer-1');
    expect(emit).toHaveBeenCalledWith('video:incoming-call', expect.objectContaining({ from: 'admin-1', to: 'buyer-1' }));
  });

  it('refuses someone outside the conversation who is not on the team', async () => {
    const { gateway, emit } = setup({ 'staff-1': 'STAFF' });
    await expect(
      gateway.handleCallUserForVideoCall(call('staff-1', 'buyer-1'), client('staff-1')),
    ).rejects.toBeInstanceOf(WsException);
    expect(emit).not.toHaveBeenCalled();
  });

  it('leaves buyer-to-seller calls as they were, without a role lookup', async () => {
    const { gateway, db, emit } = setup({});
    await gateway.handleCallUserForVideoCall(call('buyer-1', 'seller-1'), client('buyer-1'));
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('video:incoming-call', expect.objectContaining({ to: 'seller-1' }));
  });

  it('does not take the caller from the message: the socket must be theirs', async () => {
    const { gateway } = setup({ 'admin-1': 'ADMIN' });
    await expect(
      gateway.handleCallUserForVideoCall(call('admin-1', 'buyer-1'), client('buyer-1')),
    ).rejects.toBeInstanceOf(WsException);
  });
});
