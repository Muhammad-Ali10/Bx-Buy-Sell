import { Prisma } from '@prisma/client';

/**
 * Deleting a listing takes its conversations with it — the confirm dialog says
 * so — and a conversation cannot go while rows still point at it. These three
 * had no delete rule, so a listing with any conversation refused to delete:
 * "would violate the required relation 'ChatToChatLabel'".
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
