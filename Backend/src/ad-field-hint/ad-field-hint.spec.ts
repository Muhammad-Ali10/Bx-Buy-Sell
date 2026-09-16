import { AdFieldHintService } from './ad-field-hint.service';

/**
 * The wording beside the ad's worked-out figures.
 *
 * An administrator filled the hint boxes in and the ad showed none of it: the
 * figures they were looking at — the margin, the profit, the multiple — have no
 * question behind them, so there was nowhere for their words to be kept and
 * nothing for the page to read. This is that place.
 */
function build(rows: { id: string; text: string }[] = []) {
  let store = [...rows];
  const db = {
    adFieldHint: {
      findMany: jest.fn(async () => store),
      deleteMany: jest.fn(async ({ where }: any) => {
        store = store.filter((row) => row.id !== where.id);
        return {};
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const found = store.find((row) => row.id === where.id);
        if (found) found.text = update.text;
        else store.push({ ...create });
        return {};
      }),
    },
  };
  return { service: new AdFieldHintService(db as any), db, store: () => store };
}

describe('the sentences beside the ad’s figures', () => {
  it('gives back what an administrator wrote, by figure', async () => {
    const { service } = build([{ id: 'profitMargin', text: 'What the business keeps.' }]);

    expect(await service.find()).toEqual({ profitMargin: 'What the business keeps.' });
  });

  it('saves the figures it is sent and leaves the rest alone', async () => {
    const { service, store } = build([
      { id: 'profitMargin', text: 'kept from before' },
      { id: 'businessAge', text: 'also from before' },
    ]);

    await service.save({ profitMargin: 'rewritten' });

    expect(store()).toEqual([
      { id: 'profitMargin', text: 'rewritten' },
      { id: 'businessAge', text: 'also from before' },
    ]);
  });

  /*
   * Emptying the box is how an administrator asks for the page's own sentence
   * back, so it has to leave nothing behind — an empty row would read as "the
   * wording is blank" and the ⓘ would say nothing at all.
   */
  it('clearing a box puts the page’s own sentence back', async () => {
    const { service, store } = build([{ id: 'profitMargin', text: 'written once' }]);

    await service.save({ profitMargin: '   ' });

    expect(store()).toEqual([]);
    expect(await service.find()).toEqual({});
  });

  it('ignores a figure the page no longer has', async () => {
    const { service } = build([
      { id: 'profitMargin', text: 'a real figure' },
      { id: 'somethingRemoved', text: 'from an older page' },
    ]);

    expect(await service.find()).toEqual({ profitMargin: 'a real figure' });
  });

  it('will not write a key that is not a figure on the page', async () => {
    const { service, db } = build();

    await service.save({ nonsense: 'anything' } as any);

    expect(db.adFieldHint.upsert).not.toHaveBeenCalled();
  });

  it('trims what it stores, so a space is not a sentence', async () => {
    const { service, store } = build();

    await service.save({ businessAge: '  How old the business is.  ' });

    expect(store()).toEqual([{ id: 'businessAge', text: 'How old the business is.' }]);
  });
});
