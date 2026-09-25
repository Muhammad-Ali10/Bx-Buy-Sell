import { AuthService } from './auth.service';

/**
 * A guest's listing used to live only in the browser it was typed in, so
 * confirming the account a day later on another device — or after clearing
 * the browser — lost everything they had entered. The listing now travels
 * with the sign-up and becomes a DRAFT in the account when the code is
 * confirmed, wherever that happens.
 */
const build = () => {
  const pendings = new Map<string, any>();
  const users: any[] = [];
  const db = {
    pendingSignup: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = pendings.get(where.email);
        const row = existing
          ? Object.assign(existing, update)
          : { id: `p-${pendings.size + 1}`, otp_code: null, otp_expires_at: null, otp_attempts: 0, ...create };
        pendings.set(where.email, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => pendings.get(where.email) ?? null),
      delete: jest.fn(async ({ where }: any) => {
        for (const [email, row] of pendings) if (row.id === where.id) pendings.delete(email);
      }),
    },
  };
  const userService = {
    findOneByEmail: jest.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
    createUser: jest.fn(async (data: any) => {
      const user = { id: `u-${users.length + 1}`, ...data };
      users.push(user);
      return user;
    }),
    updateUser: jest.fn(async (id: string, data: any) => Object.assign(users.find((u) => u.id === id), data)),
  };
  const inboxCode = {
    send: jest.fn(async () => ({ expiresInSeconds: 600 })),
    check: jest.fn(async (_holder: unknown, code: string) => {
      if (code !== '123456') throw new Error('That code is not right.');
    }),
  };
  const jwt = { signAsync: jest.fn(async () => 'a-token') };
  const listings = { create: jest.fn(async () => ({ id: 'listing-7' })) };
  const service = new AuthService(
    userService as any,
    jwt as any,
    inboxCode as any,
    db as any,
    undefined,
    listings as any,
  );
  return { service, pendings, listings };
};

const form = {
  first_name: 'Naeem',
  last_name: 'Bhai',
  email: 'new@example.com',
  password: 'secret1',
  confirm_password: 'secret1',
};

/** The body "create listing" takes, as the Packages step builds it. */
const listingBody = (over: Record<string, unknown> = {}) => ({
  status: 'PUBLISH',
  brand: [{ question: 'Business Location', answer: 'Germany', answer_type: 'TEXT', answer_for: 'BRAND' }],
  category: [{ name: 'E-Commerce' }],
  tools: [],
  financials: [],
  statistics: [],
  productQuestion: [],
  managementQuestion: [],
  social_account: [],
  advertisement: [{ question: 'Title', answer: 'Gift Shop', answer_type: 'TEXT', answer_for: 'ADVERTISMENT' }],
  handover: [],
  selectedPackage: 'MINIMUM',
  ...over,
});

describe("a guest's listing sent with the sign-up", () => {
  it('waits beside the sign-up, always as a draft', async () => {
    const { service, pendings } = build();
    await service.signUp({ ...form, listing_draft: listingBody() } as any);
    const kept = pendings.get('new@example.com').listing_draft;
    expect(kept).toMatchObject({ status: 'DRAFT', category: [{ name: 'E-Commerce' }] });
  });

  it('becomes a DRAFT listing in the new account when the code is confirmed', async () => {
    const { service, listings } = build();
    await service.signUp({ ...form, listing_draft: listingBody() } as any);
    const result: any = await service.verifyOTP({ email: 'new@example.com', otp_code: '123456' } as any);

    expect(listings.create).toHaveBeenCalledWith('u-1', expect.objectContaining({ status: 'DRAFT' }));
    expect(result.draftListingId).toBe('listing-7');
    expect(result.tokens).toBeDefined();
  });

  it('is kept when the form is sent again without it', async () => {
    const { service, pendings } = build();
    await service.signUp({ ...form, listing_draft: listingBody() } as any);
    await service.signUp(form as any);
    expect(pendings.get('new@example.com').listing_draft).toBeTruthy();
  });

  it('is dropped, not a reason to refuse the sign-up, when it is not a listing', async () => {
    const { service, pendings } = build();
    const result: any = await service.signUp({ ...form, listing_draft: { nonsense: true } } as any);
    expect(result.pending).toBe(true);
    expect(pendings.get('new@example.com').listing_draft).toBeUndefined();
  });

  it('leaves the account made even if the draft cannot be created', async () => {
    const { service, listings } = build();
    listings.create.mockRejectedValueOnce(new Error('database down'));
    await service.signUp({ ...form, listing_draft: listingBody() } as any);
    const result: any = await service.verifyOTP({ email: 'new@example.com', otp_code: '123456' } as any);
    expect(result.user).toBeDefined();
    expect(result.draftListingId).toBeUndefined();
  });

  it('changes nothing for a sign-up without a listing', async () => {
    const { service, listings } = build();
    await service.signUp(form as any);
    const result: any = await service.verifyOTP({ email: 'new@example.com', otp_code: '123456' } as any);
    expect(listings.create).not.toHaveBeenCalled();
    expect(result.draftListingId).toBeUndefined();
  });
});
