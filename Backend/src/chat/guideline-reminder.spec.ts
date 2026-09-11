import { ChatService } from './chat.service';

/**
 * "After every 20 messages the users should get such an auto system message."
 *
 * The prompt existed, and almost never appeared. It fired only if the check
 * happened to run when the count was exactly 20, 40, 60 — and anything that
 * moved the count without running it stepped over the milestone for good. A
 * video call is saved with a sender, so it counts, but it does not go through
 * the path that runs this check; one call landing as the twentieth entry took
 * the count from 19 to 21, and the prompt for 20 was never written. Across this
 * database fifteen prompts were due and one was.
 */
describe('ChatService.maybePostGuidelineReminder', () => {
  const CHAT = 'chat-1';

  /**
   * A message store that behaves like MongoDB where it matters here: a
   * metadata lookup matches on shape, and a second document with the same
   * `_id` is refused.
   */
  const build = (opts: {
    humanMessages: number;
    isOffered?: boolean;
    existing?: Array<{ id: string; metadata: unknown }>;
    /** Make every lookup miss, as two simultaneous requests both would. */
    lookupsMiss?: boolean;
    /** The two participants' roles; two ordinary members unless said otherwise. */
    roles?: string[];
  }) => {
    const store = [...(opts.existing ?? [])];
    const db = {
      chat: {
        findUnique: jest.fn().mockResolvedValue({
          isOffered: Boolean(opts.isOffered),
          userId: 'buyer-1',
          sellerId: 'seller-1',
        }),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue((opts.roles ?? ['USER', 'USER']).map((role) => ({ role }))),
      },
      message: {
        count: jest.fn().mockResolvedValue(opts.humanMessages),
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          if (opts.lookupsMiss) return null;
          const want = JSON.stringify(where.metadata.equals);
          return store.find((m) => JSON.stringify(m.metadata) === want) ?? null;
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          if (store.some((m) => m.id === data.id)) {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          store.push({ id: data.id, metadata: data.metadata });
          return data;
        }),
      },
    };
    const service = new ChatService(db as any, {} as any);
    return { db, store, post: () => service.maybePostGuidelineReminder(CHAT) };
  };

  const prompt = (atMessage: number, id = `reminder-${CHAT}-${atMessage}`) => ({
    id,
    metadata: { kind: 'DEAL_PROMPT', atMessage },
  });

  it('posts at the twentieth message', async () => {
    const { post, store } = build({ humanMessages: 20 });
    const posted: any = await post();
    expect(posted.metadata).toEqual({ kind: 'DEAL_PROMPT', atMessage: 20 });
    expect(store).toHaveLength(1);
  });

  it('says nothing before twenty', async () => {
    const { post, store } = build({ humanMessages: 19 });
    expect(await post()).toBeNull();
    expect(store).toHaveLength(0);
  });

  it('still posts when the count stepped over twenty', async () => {
    // The bug. A video call was the twentieth entry, the check next ran at 21,
    // and the old `21 % 20 !== 0` meant the prompt for 20 was never written.
    const { post } = build({ humanMessages: 21 });
    const posted: any = await post();
    expect(posted?.metadata).toEqual({ kind: 'DEAL_PROMPT', atMessage: 20 });
  });

  it('does not post the same milestone twice', async () => {
    const { post, store } = build({ humanMessages: 25, existing: [prompt(20)] });
    expect(await post()).toBeNull();
    expect(store).toHaveLength(1);
  });

  it('moves on to forty once twenty is done', async () => {
    const { post } = build({ humanMessages: 40, existing: [prompt(20)] });
    const posted: any = await post();
    expect(posted.metadata).toEqual({ kind: 'DEAL_PROMPT', atMessage: 40 });
  });

  it('recognises a prompt the old code wrote under a random id', async () => {
    /*
     * One conversation in this database already has its prompt for 20, stored
     * under an ordinary uuid. Relying on the fixed id alone would never find it
     * and would post a second prompt for the same milestone.
     */
    const legacy = prompt(20, '7f3c1e2a-0000-4000-8000-000000000000');
    const { post, store } = build({ humanMessages: 20, existing: [legacy] });
    expect(await post()).toBeNull();
    expect(store).toHaveLength(1);
  });

  it('writes one prompt when two messages arrive at once', async () => {
    // Both requests look before either writes, so both find nothing. The fixed
    // id is what stops the second: MongoDB refuses a repeated `_id`.
    const { post, store } = build({ humanMessages: 20, lookupsMiss: true });
    const [a, b] = await Promise.all([post(), post()]);
    expect(store).toHaveLength(1);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('treats that refused second write as success, not an error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { post } = build({ humanMessages: 20, lookupsMiss: true });
    await post();
    await post();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('gives a long-quiet conversation one prompt, not five', async () => {
    // A chat stopped at 108 messages before this existed. When it resumes, it
    // is told once, for where it stands — not for every milestone it passed.
    const { post, store } = build({ humanMessages: 108 });
    const posted: any = await post();
    expect(posted.metadata.atMessage).toBe(100);
    expect(store).toHaveLength(1);
  });

  it('stops once the two of them have started the deal process', async () => {
    const { post, db } = build({ humanMessages: 40, isOffered: true });
    expect(await post()).toBeNull();
    expect(db.message.count).not.toHaveBeenCalled();
  });

  it('counts only what people wrote, never its own notices', async () => {
    // Counting the platform's posts would let the prompt trigger itself.
    const { post, db } = build({ humanMessages: 20 });
    await post();
    expect(db.message.count).toHaveBeenCalledWith({
      where: { chatId: CHAT, senderId: { not: null } },
    });
  });

  describe('in a conversation with the platform team', () => {
    /*
     * A support chat has no deal in it to start. One conversation here is a
     * member and an admin, 108 messages long; without this it would have been
     * sent a deal prompt the next time either of them wrote.
     */
    it('says nothing when one side is an admin', async () => {
      const { post, store, db } = build({ humanMessages: 108, roles: ['USER', 'ADMIN'] });
      expect(await post()).toBeNull();
      expect(store).toHaveLength(0);
      expect(db.message.count).not.toHaveBeenCalled();
    });

    it('says nothing when one side is a moderator', async () => {
      const { post } = build({ humanMessages: 20, roles: ['MONITER', 'USER'] });
      expect(await post()).toBeNull();
    });

    it('still prompts two members', async () => {
      const { post } = build({ humanMessages: 20, roles: ['USER', 'SELLER'] });
      const posted: any = await post();
      expect(posted?.metadata.atMessage).toBe(20);
    });
  });
});
