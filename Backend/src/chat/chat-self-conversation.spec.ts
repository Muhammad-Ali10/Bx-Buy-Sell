import { HttpException } from '@nestjs/common';
import { ChatService } from './chat.service';

/**
 * Nobody can start a conversation with themselves.
 *
 * Contact Seller on one's own listing went through: eight chats had the same
 * account as buyer and seller, and one of them — a seller with himself on his
 * own listing — put a third picture in the admin's Details panel.
 */
describe('ChatService.createChatRoom', () => {
  const build = () => {
    const db = {
      chat: {
        create: jest.fn().mockResolvedValue({ id: 'new-chat' }),
        update: jest.fn(),
      },
    };
    const service = new ChatService(db as any, {} as any);
    const lookup = jest.spyOn(service, 'getChatRoom').mockResolvedValue(null as any);
    return { service, db, lookup };
  };

  it('refuses a chat whose buyer is also its seller, and writes nothing', async () => {
    const { service, db, lookup } = build();

    const error = await service.createChatRoom('user-1', 'user-1', 'listing-1').catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe('You cannot start a conversation with yourself');
    expect(lookup).not.toHaveBeenCalled();
    expect(db.chat.create).not.toHaveBeenCalled();
  });

  it('still opens a chat between two different people', async () => {
    const { service, db } = build();

    await expect(service.createChatRoom('buyer-1', 'seller-1', 'listing-1')).resolves.toEqual({
      id: 'new-chat',
    });
    expect(db.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'buyer-1', sellerId: 'seller-1', listingId: 'listing-1' },
      }),
    );
  });
});
