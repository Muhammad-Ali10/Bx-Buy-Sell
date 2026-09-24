import { ChatGateway } from './chat.gateway';

/**
 * The group-call handlers, with the database, the socket server and the chat
 * service stubbed. The bookkeeping itself is tested in group-call.spec.ts.
 */
describe('ChatGateway group calls', () => {
  const chat = { userId: 'buyer-1', sellerId: 'seller-1' };
  const env = { ...process.env };

  beforeAll(() => {
    process.env.AGORA_APP_ID = '0123456789abcdef0123456789abcdef';
    process.env.AGORA_APP_CERTIFICATE = 'fedcba9876543210fedcba9876543210';
  });
  afterAll(() => {
    process.env = env;
  });

  function setup(roles: Record<string, string>) {
    const sent: Array<{ room: string; event: string; payload: any }> = [];
    const io = {
      to: (room: string) => ({ emit: (event: string, payload: any) => sent.push({ room, event, payload }) }),
    };
    const db = {
      chat: { findUnique: jest.fn().mockResolvedValue(chat) },
      user: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(roles[where.id] ? { role: roles[where.id] } : null)),
      },
    };
    const chatService = {
      createMessage: jest.fn(async (m: any) => ({ id: 'm' + Math.random(), createdAt: new Date(), ...m })),
    };
    const gateway = new ChatGateway({} as any, {} as any, chatService as any, db as any, {} as any);
    gateway.io = io as any;
    return { gateway, sent, chatService };
  }
  const socket = (userId: string, id = `s-${userId}`) => ({ id, userId, join: jest.fn(), leave: jest.fn() }) as any;

  it('lets only the team start one', async () => {
    const { gateway, sent } = setup({ 'buyer-1': 'USER' });
    const reply = await gateway.handleGroupCallStart({ chatId: 'c1' }, socket('buyer-1'));
    expect(reply).toEqual({ ok: false, error: 'Only the team can start a group call' });
    expect(sent).toHaveLength(0);
  });

  it('rings the buyer and the seller, and hands the host a token', async () => {
    const { gateway, sent } = setup({ 'admin-1': 'ADMIN' });
    const reply: any = await gateway.handleGroupCallStart({ chatId: 'c1' }, socket('admin-1'));
    expect(reply.ok).toBe(true);
    expect(reply.token.length).toBeGreaterThan(50);
    expect(reply.uid).toBe('admin-1');
    expect(sent.filter((e) => e.event === 'group-call:incoming').map((e) => e.room)).toEqual([
      'user:buyer-1',
      'user:seller-1',
    ]);
  });

  it('lets the invited in, and no one else', async () => {
    const { gateway } = setup({ 'admin-1': 'MONITER' });
    const started: any = await gateway.handleGroupCallStart({ chatId: 'c1' }, socket('admin-1'));
    const stranger: any = gateway.handleGroupCallJoin({ chatId: 'c1', callId: started.callId }, socket('someone'));
    expect(stranger.ok).toBe(false);
    const buyer: any = gateway.handleGroupCallJoin({ chatId: 'c1', callId: started.callId }, socket('buyer-1'));
    expect(buyer.ok).toBe(true);
    expect(buyer.uid).toBe('buyer-1');
    expect(buyer.channel).toBe(started.channel);
  });

  it('ends for everyone when the host leaves, and logs it in the conversation', async () => {
    const { gateway, sent, chatService } = setup({ 'admin-1': 'ADMIN' });
    const started: any = await gateway.handleGroupCallStart({ chatId: 'c1' }, socket('admin-1'));
    gateway.handleGroupCallJoin({ chatId: 'c1', callId: started.callId }, socket('buyer-1'));
    gateway.handleGroupCallDecline({ chatId: 'c1', callId: started.callId }, socket('seller-1'));

    const reply: any = gateway.handleGroupCallLeave({ chatId: 'c1', callId: started.callId }, socket('admin-1'));
    expect(reply.ended).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));

    expect(sent.some((e) => e.event === 'group-call:ended' && e.room === `group-call:${started.callId}`)).toBe(true);
    const logged = chatService.createMessage.mock.calls.map(([m]: any) => JSON.parse(m.content));
    expect(logged).toEqual([
      expect.objectContaining({ type: 'video_call_completed', group: true, participants: 2 }),
      expect.objectContaining({ type: 'missed_video_call', group: true, receiverId: 'seller-1', reason: 'declined' }),
    ]);
  });

  it('ends the call when the host drops off', async () => {
    const { gateway, sent } = setup({ 'admin-1': 'ADMIN' });
    await gateway.handleGroupCallStart({ chatId: 'c1' }, socket('admin-1', 'host-socket'));
    // A socket that is not tracked for presence, so only the call logic runs.
    gateway.handleDisconnect({ id: 'host-socket' } as any);
    await new Promise((resolve) => setImmediate(resolve));
    expect(sent.some((e) => e.event === 'group-call:ended')).toBe(true);
  });
});
