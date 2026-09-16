import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AD_FIELD_HINT_KEYS, isAdFieldHintKey, type AdFieldHintKey } from './dto/ad-field-hint.dto';

@Injectable()
export class AdFieldHintService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Every sentence an administrator has written, by figure.
   *
   * A figure nobody has written about is simply absent rather than empty, so
   * the page can tell "left alone" from "cleared" and keep the wording it
   * already had.
   */
  async find(): Promise<Record<string, string>> {
    const rows = await this.db.adFieldHint.findMany();
    const out: Record<string, string> = {};
    for (const row of rows) {
      // A key that is no longer a figure on the page is left out rather than
      // deleted: the page it belonged to may come back, and nothing reads it
      // meanwhile.
      if (!isAdFieldHintKey(row.id)) continue;
      const text = String(row.text || '').trim();
      if (text) out[row.id] = text;
    }
    return out;
  }

  /**
   * Save the sentences the panel sent, and only those.
   *
   * Clearing a box deletes the row rather than storing an empty string, which
   * is what puts the page's own sentence back.
   */
  async save(hints: Partial<Record<AdFieldHintKey, string>>): Promise<Record<string, string>> {
    for (const key of AD_FIELD_HINT_KEYS) {
      const sent = hints[key];
      if (sent === undefined) continue;
      const text = String(sent).trim();
      if (!text) {
        await this.db.adFieldHint.deleteMany({ where: { id: key } });
        continue;
      }
      await this.db.adFieldHint.upsert({
        where: { id: key },
        create: { id: key, text },
        update: { text },
      });
    }
    return this.find();
  }
}
