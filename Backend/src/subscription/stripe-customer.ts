/**
 * The one Stripe customer a person has, found or made once and then remembered.
 *
 * There were three copies of "look for a customer, otherwise create one", and
 * not one of them saved what it created. The id was only ever written by the
 * buyer-plan path, onto `UserSubscription` — a row that exists only for people
 * who have bought a buyer plan. A seller who only ever buys listing packages
 * has no such row, so every checkout made them a brand-new Stripe customer.
 *
 * That is not untidy, it loses money. Cancelling an add-on to take a different
 * one credits the unused days back to the customer's Stripe balance, and the
 * next purchase went to a different customer where the credit could not be
 * reached. Saved cards were lost the same way, and the billing portal could not
 * find anyone. One person in this database had four.
 *
 * A plain function rather than a service because the listing module and the
 * subscription module both need it and cannot import each other.
 */

interface Db {
  user: {
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  userSubscription: { findUnique(args: any): Promise<any> };
}

interface StripeLike {
  createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<{ id: string }>;
  getStripe(): { customers: { list(args: any): Promise<{ data: Array<{ id: string }> }> } };
}

export async function ensureStripeCustomer(
  db: Db,
  stripe: StripeLike,
  userId: string,
): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`User ${userId} not found`);

  if (user.stripeCustomerId) return user.stripeCustomerId;

  /*
   * Where the id used to live, for accounts that bought a buyer plan before
   * this moved. Adopted rather than ignored: creating a second customer for
   * someone Stripe already bills would split their history in two.
   */
  const legacy = await db.userSubscription.findUnique({ where: { userId } });
  if (legacy?.stripeCustomerId) {
    await remember(db, userId, legacy.stripeCustomerId);
    return legacy.stripeCustomerId;
  }

  /*
   * Ask Stripe whether this person is already a customer.
   *
   * They very likely are: every checkout before this made one. Adopting the
   * newest reunites the account with its cards and its credit balance instead
   * of starting a fifth. One extra call, and only ever on a user whose id we
   * do not yet hold.
   */
  const found = await stripe
    .getStripe()
    .customers.list({ email: user.email, limit: 1 })
    .catch(() => ({ data: [] as Array<{ id: string }> }));

  if (found.data.length > 0) {
    await remember(db, userId, found.data[0].id);
    return found.data[0].id;
  }

  const created = await stripe.createCustomer(
    user.email,
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
    { userId },
  );
  await remember(db, userId, created.id);
  return created.id;
}

/**
 * Remembering it must never cost the seller their checkout.
 *
 * They are standing in front of a payment. If this one write fails, the caller
 * still holds a usable customer id and the purchase goes through; the worst
 * case is that the next checkout looks the customer up by email again.
 */
async function remember(db: Db, userId: string, stripeCustomerId: string) {
  try {
    await db.user.update({ where: { id: userId }, data: { stripeCustomerId } });
  } catch {
    // Deliberately silent, for the reason above.
  }
}
