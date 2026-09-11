import { ChatService } from './chat.service';

/**
 * The client: "the search currently only works if the last message of the chat
 * contains that word ... it should return all chats where that word appears
 * anywhere in the conversation history."
 */
describe('ChatService.searchChats', () => {
  const like = (text: string) => ({ contains: text, mode: 'insensitive' });

  const build = (messages: any[] = []) => {
    const db = {
      message: { findMany: jest.fn(async () => messages) },
      chat: { findMany: jest.fn(async () => [] as any[]) },
      listingQuestion: { findMany: jest.fn(async () => [] as any[]) },
    };
    return { db, service: new ChatService(db as any, {} as any) };
  };

  it('looks through every conversation the word was said in', async () => {
    const { db, service } = build();
    await service.searchChats('contract', 'member-1', 'USER');
    const args = (db.message.findMany.mock.calls[0] as any[])[0];
    // One row per conversation. A cap on messages dropped older chats once a
    // word had been used often enough in recent ones.
    expect(args.distinct).toEqual(['chatId']);
    expect(args.take).toBeUndefined();
    expect(args.where).toEqual({
      content: like('contract'),
      chat: { OR: [{ userId: 'member-1' }, { sellerId: 'member-1' }] },
    });
  });

  it('shows each conversation with the place the word came up', async () => {
    const { service } = build([
      { chatId: 'chat-a', content: 'Could you send me the contract before Friday?' },
      { chatId: 'chat-b', content: 'Contract signed.' },
    ]);
    const result = await service.searchChats('contract', 'member-1', 'USER');
    expect(result.chatIds).toEqual(['chat-a', 'chat-b']);
    expect(result.snippets['chat-a']).toContain('the contract');
    expect(result.snippets['chat-b']).toBe('Contract signed.');
  });

  it("finds a member's conversations by the other person's name, and only theirs", async () => {
    // The member's scope used to be overwritten here, so this lookup ran
    // across every conversation on the platform.
    const { db, service } = build();
    await service.searchChats('ali', 'member-1', 'USER');
    const named = { OR: [{ first_name: like('ali') }, { last_name: like('ali') }] };
    expect((db.chat.findMany.mock.calls[0] as any[])[0].where).toEqual({
      OR: [
        { userId: 'member-1', seller: named },
        { sellerId: 'member-1', user: named },
      ],
    });
  });

  it('lets the platform team look people up by email', async () => {
    const { db, service } = build();
    await service.searchChats('johnnyjohn.de', 'staff-1', 'MONITER');
    expect(JSON.stringify((db.chat.findMany.mock.calls[0] as any[])[0].where)).toContain('email');
  });

  it('does not search on fewer than two letters', async () => {
    const { db, service } = build();
    await expect(service.searchChats(' a ', 'member-1', 'USER')).resolves.toEqual({
      query: 'a',
      chatIds: [],
      snippets: {},
    });
    expect(db.message.findMany).not.toHaveBeenCalled();
  });
});
