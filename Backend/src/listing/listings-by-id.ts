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

/** The people a listing points at, and the column on the listing that names each. */
export type ListingPerson = 'user' | 'responsible';

const PERSON_KEY: Record<ListingPerson, string> = {
  user: 'userId',
  responsible: 'responsibleId',
};

/**
 * Listings already fetched, given their relations: the same shape a Prisma
 * `include` gives, in the same order they came in.
 *
 * For a list whose ids are not known until it has been read — a filtered,
 * sorted page such as the feed — so `listingsById` cannot fetch the listings
 * alongside their relations. What it can still do is send every relation at
 * once: one trip's wait after the listings, where the feed's include of seven
 * relations was seven trips more, one after another.
 *
 * `people` names the user relations to add and which fields of each; one
 * that the listing does not point at comes back null, as an include gives it.
 */
export async function withListingRelations<T extends { id: string }>(
  db: Db & { user: { findMany(args: any): Promise<any[]> } },
  listings: T[],
  relations: ListingRelation[],
  people: Partial<Record<ListingPerson, Prisma.UserSelect>> = {},
): Promise<Array<T & Record<string, any>>> {
  if (listings.length === 0) return [];
  const ids = [...new Set(listings.map((listing) => listing.id))];
  const personRelations = Object.keys(people) as ListingPerson[];
  // One request for everyone, whichever relation names them.
  const personIds = [
    ...new Set(
      personRelations.flatMap((relation) =>
        listings.map((listing: any) => listing[PERSON_KEY[relation]]).filter(Boolean),
      ),
    ),
  ];
  const personSelect = Object.assign({}, ...personRelations.map((relation) => people[relation]), {
    id: true,
  });

  const [persons, ...related] = await Promise.all([
    personIds.length
      ? db.user.findMany({ where: { id: { in: personIds } }, select: personSelect })
      : Promise.resolve([]),
    ...relations.map((relation) => relatedRows(db, relation, ids)),
  ]);

  const personById = new Map<string, any>(persons.map((person) => [person.id, person]));
  // Each relation keeps only the fields it asked for, though they were fetched together.
  const pick = (person: any, select: Prisma.UserSelect) =>
    person
      ? Object.fromEntries(
          Object.entries(select)
            .filter(([, wanted]) => wanted)
            .map(([field]) => [field, person[field]]),
        )
      : null;

  const grouped = relations.map((relation, index) => {
    const key = LISTING_KEY[relation];
    const byListing = new Map<string, any[]>();
    for (const row of related[index]) {
      const rows = byListing.get(row[key]) ?? [];
      rows.push(row);
      byListing.set(row[key], rows);
    }
    return byListing;
  });

  return listings.map((listing: any) => {
    const full: any = { ...listing };
    for (const relation of personRelations) {
      full[relation] = pick(personById.get(listing[PERSON_KEY[relation]]), people[relation]!);
    }
    relations.forEach((relation, index) => {
      full[relation] = grouped[index].get(listing.id) ?? [];
    });
    return full;
  });
}
