import { Prisma } from '@prisma/client';

/**
 * A conversation cannot go while rows still point at it. These three had no
 * delete rule, so a listing with any conversation refused to delete: "would
 * violate the required relation 'ChatToChatLabel'".
 *
 * Deleting a listing no longer takes its conversations: ListingService.delete
 * unhooks them first (listing-delete.spec.ts). The cascade below stays as the
 * rule for anything that would remove a listing some other way.
 */
describe('what goes with a deleted conversation', () => {
  const onDelete = (model: string, field: string) =>
    Prisma.dmmf.datamodel.models
      .find((m) => m.name === model)
      ?.fields.find((f) => f.name === field)?.relationOnDelete;

  it.each([
    ['ChatLabel', 'chat'],
    ['Message', 'chat'],
    ['ChatMonitor', 'Chat'],
  ])('%s.%s is deleted with its conversation', (model, field) => {
    expect(onDelete(model, field)).toBe('Cascade');
  });

  it('a conversation still goes with its listing', () => {
    expect(onDelete('Chat', 'listing')).toBe('Cascade');
  });
});
