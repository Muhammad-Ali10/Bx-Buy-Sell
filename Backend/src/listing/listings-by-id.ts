import { Prisma } from '@prisma/client';

/** The relations of a listing that the conversation list and Favourites show. */
export type ListingRelation =
  | 'brand'
  | 'advertisement'
  | 'statistics'
  | 'category'
  | 'financials';

/** The column on each related row that names its listing. */
const LISTING_KEY: Record<ListingRelation, string> = {
  brand: 'brandQuestionId',
  advertisement: 'advertisementId',
  statistics: 'statisticsId',
  category: 'listingId',
  financials: 'listingId',
};

type Db = {
  listing: { findMany(args: any): Promise<any[]> };
  listingQuestion: { findMany(args: any): Promise<any[]> };
  listingCategory: { findMany(args: any): Promise<any[]> };
  revenue: { findMany(args: any): Promise<any[]> };
};

const relatedRows = (db: Db, relation: ListingRelation, ids: string[]) => {
  const where = { [LISTING_KEY[relation]]: { in: ids } };
  if (relation === 'category') return db.listingCategory.findMany({ where });
  if (relation === 'financials') return db.revenue.findMany({ where });
  return db.listingQuestion.findMany({ where });
};

/**
 * Listings by id, each with the relations asked for, the same shape a Prisma
 * `include` gives.
 *
 * On MongoDB Prisma resolves an include one relation at a time, one database
 * trip each, one after another. A conversation list with its listing's brand,
 * advertisement and category was ten trips; from the server that was about a
 * second and a half before a single chat could show. Every relation here is
 * keyed by the listing's id, which the caller already holds, so they all go
 * out together with the listings themselves: one trip's wait instead of five.
 *
 * `user` is the listing owner's fields to include, when wanted.
 */
export async function listingsById(
  db: Db,
  ids: Array<string | null | undefined>,
  relations: ListingRelation[],
  user?: Prisma.UserSelect,
): Promise<Map<string, any>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const [listings, ...related] = await Promise.all([
    db.listing.findMany({
      where: { id: { in: unique } },
      ...(user ? { include: { user: { select: user } } } : {}),
    }),
    ...relations.map((relation) => relatedRows(db, relation, unique)),
  ]);

  const byId = new Map<string, any>();
  for (const listing of listings) {
    const full: any = { ...listing };
    for (const relation of relations) full[relation] = [];
    byId.set(listing.id, full);
  }
  relations.forEach((relation, index) => {
    const key = LISTING_KEY[relation];
    for (const row of related[index]) byId.get(row[key])?.[relation].push(row);
  });
  return byId;
}
