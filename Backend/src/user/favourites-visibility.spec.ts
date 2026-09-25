import { UserService } from './user.service';

/**
 * Photos on the Favourites page. The client found listings blurred there that
 * the listing page showed in full: the page never said who was looking, so an
 * admin was masked as an ordinary member. And a request still waiting counted
 * as unlocked here, while the listing page waited for the seller's approval.
 */
describe('photos on the Favourites page', () => {
  const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/shop.jpg';
  const build = (accessStatus: 'APPROVED' | 'PENDING' | null) => {
    const db = {
      favourite: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f1',
            listing: {
              id: 'l1',
              userId: 'seller-1',
              status: 'PUBLISH',
              category: [{ name: 'Software' }],
              advertisement: [{ question: 'Photos', answer: JSON.stringify([PHOTO]), answer_type: 'PHOTO' }],
              brand: [],
              financials: [],
              statistics: [],
            },
          },
        ]),
      },
      listingConfidentialAccess: {
        findMany: jest.fn().mockResolvedValue(accessStatus ? [{ listingId: 'l1', status: accessStatus }] : []),
      },
    };
    return new UserService(db as any);
  };
  const photoOf = (rows: any[]) => rows[0].listing.advertisement[0];

  it('shows an admin every photo, as the listing page does', async () => {
    const rows = await build(null).getAllFavourite('admin-1', { userId: 'admin-1', role: 'ADMIN' });
    expect(photoOf(rows).locked).toBeFalsy();
    expect(photoOf(rows).answer).toContain(PHOTO);
  });

  it('keeps it blurred for a member who has not been let in', async () => {
    const rows = await build(null).getAllFavourite('buyer-1', { userId: 'buyer-1', role: 'USER' });
    expect(photoOf(rows).locked).toBe(true);
  });

  it('keeps it blurred while the request is still waiting for the seller', async () => {
    const rows = await build('PENDING').getAllFavourite('buyer-1', { userId: 'buyer-1', role: 'USER' });
    expect(photoOf(rows).locked).toBe(true);
  });

  it('shows it once the seller has approved', async () => {
    const rows = await build('APPROVED').getAllFavourite('buyer-1', { userId: 'buyer-1', role: 'USER' });
    expect(photoOf(rows).locked).toBeFalsy();
  });
});
