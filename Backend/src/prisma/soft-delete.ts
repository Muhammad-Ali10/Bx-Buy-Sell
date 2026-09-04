/**
 * "This row has not been soft-deleted."
 *
 * Prisma on MongoDB draws a line where SQL does not: `deleted_at: null` matches
 * only documents where the key is present and explicitly null. A document that
 * never had the key at all — which is every row written before the field was
 * added to the schema — does not match.
 *
 * That is not a hypothetical. Every listing in the database predates the field,
 * so `deleted_at: null` matched nothing: the trending categories on the home
 * page came back empty, and a seller with 23 listings counted as 0 against
 * their plan limit, so the limit never applied.
 *
 * Both shapes mean the same thing, so ask for both.
 *
 * A function rather than a constant, so every caller spreads its own object
 * and no two queries share one array.
 *
 *   where: { status: 'PUBLISH', ...notDeleted() }
 */
export const notDeleted = () => ({
  OR: [{ deleted_at: null }, { deleted_at: { isSet: false } }],
});
