import { mayPlaceVideoCall } from './video-call-rules';

/**
 * The client asked for video calls on the admin's All Chats screen. The button
 * had been taken away because a call there could never connect: the gateway
 * rang only the buyer and the seller of a conversation, and a moderator reading
 * it is neither.
 */
describe('who may ring whom about a conversation', () => {
  const chat = { userId: 'buyer-1', sellerId: 'seller-1' };

  it('lets the buyer and the seller call each other, as always', () => {
    expect(mayPlaceVideoCall(chat, 'buyer-1', 'seller-1', 'USER')).toBe(true);
    expect(mayPlaceVideoCall(chat, 'seller-1', 'buyer-1', 'USER')).toBe(true);
  });

  it('lets the team call either side of any conversation', () => {
    expect(mayPlaceVideoCall(chat, 'admin-1', 'buyer-1', 'ADMIN')).toBe(true);
    expect(mayPlaceVideoCall(chat, 'monitor-1', 'seller-1', 'MONITER')).toBe(true);
  });

  it('does not let an outsider call into a conversation', () => {
    expect(mayPlaceVideoCall(chat, 'someone-else', 'buyer-1', 'USER')).toBe(false);
    expect(mayPlaceVideoCall(chat, 'staff-1', 'buyer-1', 'STAFF')).toBe(false);
  });

  it('only rings the two people in the conversation — never the team', () => {
    expect(mayPlaceVideoCall(chat, 'buyer-1', 'admin-1', 'USER')).toBe(false);
    expect(mayPlaceVideoCall(chat, 'admin-1', 'monitor-1', 'ADMIN')).toBe(false);
  });

  it('refuses a call to oneself, or about a conversation that is not there', () => {
    expect(mayPlaceVideoCall(chat, 'buyer-1', 'buyer-1', 'USER')).toBe(false);
    expect(mayPlaceVideoCall(null, 'admin-1', 'buyer-1', 'ADMIN')).toBe(false);
  });
});
