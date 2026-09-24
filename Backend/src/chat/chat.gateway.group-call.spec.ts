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

  function setup(roles: Record<string, string>, online: string[] = ['buyer-1', 'seller-1']) {
    const sent: Array<{ room: string; event: string; payload: any }> = [];
    const io = {
      to: (room: string) => ({ emit: (event: string, payload: any) => sent.push({ room, event, payload }) }),
      // Who has the site open: each connection sits in group-ring:<id>.
      sockets: { adapter: { rooms: new Map(online.map((id) => [`group-ring:${id}`, new Set(['s'])])) } },
    };
    const db = {
      chat: { findUnique: jest.fn().mockResolvedValue(chat) },
      user: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(roles[where.id] ? { role: roles[where.id] } : null)),
        findMany: jest.fn(async () => [
          { id: 'buyer-1', first_name: 'Bea', last_name: 'Buyer' },
          { id: 'admin-1', first_name: 'Hello', last_name: 'Rao' },
          { id: 'seller-1', first_name: 'Sam', last_name: 'Seller' },
        ]),
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
      'group-ring:buyer-1',
      'group-ring:seller-1',
    ]);
    // Names travel with the ring, so the call screen can label everyone anywhere.
    expect(reply.people).toEqual({ 'admin-1': 'EX-Support', 'buyer-1': 'Bea Buyer', 'seller-1': 'Sam Seller' });
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
  describe('between two people', () => {
    it('lets the buyer ring the seller, wherever the seller is on the site', async () => {
      const { gateway, sent } = setup({});
      const reply: any = await gateway.handleGroupCallStart({ chatId: 'c1', to: 'seller-1' }, socket('buyer-1'));
      expect(reply).toEqual(expect.objectContaining({ ok: true, kind: 'direct', invited: ['seller-1'] }));
      expect(sent.filter((e) => e.event === 'group-call:incoming').map((e) => e.room)).toEqual(['group-ring:seller-1']);
      // A member calling is named, not "EX-Support".
      expect(reply.people['buyer-1']).toBe('Bea Buyer');
    });

    it('says at once when the other person is not on the site, and logs a missed call', async () => {
      const { gateway, chatService } = setup({}, []);
      const reply: any = await gateway.handleGroupCallStart({ chatId: 'c1', to: 'seller-1' }, socket('buyer-1'));
      expect(reply).toEqual(expect.objectContaining({ ok: false, offline: true }));
      expect(reply.error).toMatch(/Sam Seller is not online/);
      expect(JSON.parse(chatService.createMessage.mock.calls[0][0].content)).toEqual(
        expect.objectContaining({ type: 'missed_video_call', receiverId: 'seller-1', reason: 'offline' }),
      );
    });

    it('does not let an outsider ring into a conversation', async () => {
      const { gateway } = setup({ 'stranger-1': 'USER' });
      const reply: any = await gateway.handleGroupCallStart({ chatId: 'c1', to: 'seller-1' }, socket('stranger-1'));
      expect(reply.ok).toBe(false);
    });

    it('ends when the person called says no', async () => {
      const { gateway, sent } = setup({});
      const started: any = await gateway.handleGroupCallStart({ chatId: 'c1', to: 'seller-1' }, socket('buyer-1'));
      gateway.handleGroupCallDecline({ chatId: 'c1', callId: started.callId }, socket('seller-1'));
      await new Promise((resolve) => setImmediate(resolve));
      expect(sent).toContainEqual(
        expect.objectContaining({ event: 'group-call:ended', payload: expect.objectContaining({ reason: 'declined' }) }),
      );
    });

    it('stops ringing after a minute with no answer, and logs a missed call', async () => {
      jest.useFakeTimers();
      try {
        const { gateway, sent, chatService } = setup({});
        await gateway.handleGroupCallStart({ chatId: 'c1', to: 'seller-1' }, socket('buyer-1'));
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();
        await Promise.resolve();
        expect(sent).toContainEqual(
          expect.objectContaining({ event: 'group-call:ended', payload: expect.objectContaining({ reason: 'no_answer' }) }),
        );
        await Promise.resolve();
        const logged = chatService.createMessage.mock.calls.map(([m]: any) => JSON.parse(m.content));
        expect(logged).toContainEqual(expect.objectContaining({ type: 'missed_video_call', reason: 'no_answer' }));
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
